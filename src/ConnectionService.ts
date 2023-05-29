import { TextDocument } from "vscode-languageserver-textdocument";
import {
  Connection,
  DidChangeConfigurationNotification,
  InitializeResult,
  Range,
  TextDocumentSyncKind,
  TextDocuments,
  TextEdit,
} from "vscode-languageserver/node";
import type {
  ExecuteNpmPackageManagerCommand,
  PackageManagers,
  PrettierVSCodeConfig,
} from "./types";
import { URI } from "vscode-uri";
import { PrettierEditService } from "./PrettierEditService";

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

  constructor(
    private connection: Connection,
    private documents: TextDocuments<TextDocument>
  ) {}

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
    this.connection.onInitialize(({ capabilities }) => {
      this.hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
      );

      const result: InitializeResult = {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          documentFormattingProvider: true,
          documentRangeFormattingProvider: true,
        },
      };
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
      const text = document.getText();
      const pos0 = document.positionAt(0);
      const pos1 = document.positionAt(text.length);
      return [TextEdit.replace(Range.create(pos0, pos1), text.toUpperCase())];
    });

    this.connection.onDocumentRangeFormatting(async (params) => {
      const document = this.documents.get(params.textDocument.uri);
      if (document === undefined) {
        return [];
      }
      const text = document.getText(params.range);
      return [TextEdit.replace(params.range, text.toUpperCase())];
    });
  }
}
