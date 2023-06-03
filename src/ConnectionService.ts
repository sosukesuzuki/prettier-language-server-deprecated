import { TextDocument } from "vscode-languageserver-textdocument";
import {
  Connection,
  DidChangeConfigurationNotification,
  InitializeResult,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node";
import type {
  ExecuteNpmPackageManagerCommand,
  PackageManagers,
  PrettierVSCodeConfig,
} from "./types";
import { URI } from "vscode-uri";
import { PrettierEditService } from "./PrettierEditService";
import { ConsoleLoggingService, LoggingService } from "./LoggingService";
import { ModuleResolver } from "./ModuleResolver";

/**
 * Manage a connection with clients.
 * E.g. register handlers, requests to clients, ...
 */
export class ConnectionService {
  public hasConfigurationCapability = false;
  private isTrustedWorkspace = false;
  /**
   * Cache for document uri to configuration
   */
  private document2Setting: Map<
    /* uri */ string,
    Promise<PrettierVSCodeConfig>
  > = new Map();

  private prettierEditService: PrettierEditService | undefined = undefined;

  private loggingService: LoggingService;

  constructor(
    private connection: Connection,
    private documents: TextDocuments<TextDocument>
  ) {
    this.loggingService = new ConsoleLoggingService(this.connection);
  }

  public listen() {
    this.documents.listen(this.connection);
    this.connection.listen();
  }

  public get isTrusted() {
    return this.isTrustedWorkspace;
  }

  public getConfig(uri: URI): Promise<PrettierVSCodeConfig> {
    let resultPromise = this.document2Setting.get(uri.fsPath);
    if (resultPromise) {
      return resultPromise;
    }
    resultPromise = this.connection.workspace
      .getConfiguration()
      .then((config) => {
        if (this.isTrusted) {
          return config;
        }
        return {
          ...config,
          prettierPath: undefined,
          configPath: undefined,
          ignorePath: ".prettierignore",
          documentSelectors: [],
          useEditorConfig: false,
          withNodeModules: false,
          resolveGlobalModules: false,
        };
      });
    this.document2Setting.set(uri.fsPath, resultPromise);
    return resultPromise;
  }

  /**
   * This intended for executing "npm.packageManager" command in client.
   * The handler for this custom request should be implemented in client.
   */
  public executeNpmPackageManagerCommand: ExecuteNpmPackageManagerCommand =
    async (workspaceFolderUri) => {
      try {
        const result = await this.connection.sendRequest(
          "custom/executeNpmPackageCommand",
          { workspaceFolderUri }
        );
        return result as PackageManagers;
      } catch {
        return undefined;
      }
    };

  public registerHandlers() {
    this.connection.onInitialize(({ capabilities, workspaceFolders }) => {
      this.hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
      );

      this.prettierEditService = new PrettierEditService(
        this.getConfig,
        this.loggingService,
        new ModuleResolver(
          this.loggingService,
          workspaceFolders,
          () => this.isTrusted,
          this.executeNpmPackageManagerCommand,
          this.getConfig
        )
      );

      const result: InitializeResult = {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          documentFormattingProvider: true,
          documentRangeFormattingProvider: true,
        },
      };

      this.loggingService.logInfo("onInitialize");
      return result;
    });

    this.connection.onInitialized(() => {
      if (this.hasConfigurationCapability) {
        // Register for all configuration changes.
        this.connection.client.register(
          DidChangeConfigurationNotification.type,
          undefined
        );
      }

      this.loggingService.logInfo("OnInitialized");
    });

    this.connection.onNotification(
      "workspace/didChangeTrust",
      (params: { isTrusted: boolean }) => {
        this.isTrustedWorkspace = params.isTrusted;
      }
    );

    this.connection.onDocumentFormatting(async (params) => {
      const document = this.documents.get(params.textDocument.uri);
      if (document === undefined) {
        return [];
      }
      if (!this.prettierEditService) {
        throw new Error("");
      }
      const edits = await this.prettierEditService.provideEdits(document, {
        force: false,
      });
      return edits;
    });

    this.connection.onDocumentRangeFormatting(async (params) => {
      const document = this.documents.get(params.textDocument.uri);
      if (document === undefined) {
        return [];
      }
      if (!this.prettierEditService) {
        throw new Error("");
      }
      const edits = await this.prettierEditService.provideEdits(document, {
        rangeStart: params.range.start.character,
        rangeEnd: params.range.end.character,
        force: false,
      });
      return edits;
    });
  }
}
