import { TextDocument } from "vscode-languageserver-textdocument";
import {
  Connection,
  DidChangeConfigurationNotification,
  InitializeResult,
  TextDocumentSyncKind,
  TextDocuments,
  WorkspaceFolder,
} from "vscode-languageserver";
import { PrettierEditService } from "./PrettierEditService";
import { LoggingService } from "./LoggingService";

type RegisterOnInitializeResult = {
  workspaceFolders: WorkspaceFolder[] | null;
  hasConfigurationCapability: boolean;
};

export class RegistrationService {
  private connection: Connection;
  private documents: TextDocuments<TextDocument>;

  // Services
  private loggingService: LoggingService;

  constructor(
    connection: Connection,
    documents: TextDocuments<TextDocument>,
    loggingService: LoggingService
  ) {
    this.connection = connection;
    this.documents = documents;
    this.loggingService = loggingService;
  }

  public registerOnInitialize(): Promise<RegisterOnInitializeResult> {
    let resolve: (value: RegisterOnInitializeResult) => void;
    const promise = new Promise<RegisterOnInitializeResult>((res) => {
      resolve = res;
    });
    this.connection.onInitialize(({ capabilities, workspaceFolders }) => {
      this.loggingService.logInfo("onInitialize");

      const result: InitializeResult = {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          documentFormattingProvider: true,
          documentRangeFormattingProvider: true,
        },
      };

      resolve({
        workspaceFolders: workspaceFolders || null,
        hasConfigurationCapability: !!(
          capabilities.workspace && !!capabilities.workspace.configuration
        ),
      });

      return result;
    });
    return promise;
  }

  public registerOnInitialized(hasConfigurationCapability: boolean) {
    this.connection.onInitialized(() => {
      this.loggingService.logInfo("OnInitialized");

      if (hasConfigurationCapability) {
        // Register for all configuration changes.
        this.connection.client.register(
          DidChangeConfigurationNotification.type,
          undefined
        );
      }
    });
  }

  public regsiterOnDocumentFormatting(
    prettierEditService: PrettierEditService
  ) {
    this.connection.onDocumentFormatting(async (params) => {
      const document = this.documents.get(params.textDocument.uri);
      if (document === undefined) {
        return [];
      }
      const edits = await prettierEditService.provideEdits(document, {
        force: false,
      });
      return edits;
    });
  }

  public registerOnDocumentRangeFormatting(
    prettierEditService: PrettierEditService
  ) {
    this.connection.onDocumentRangeFormatting(async (params) => {
      const document = this.documents.get(params.textDocument.uri);
      if (document === undefined) {
        return [];
      }
      const edits = await prettierEditService.provideEdits(document, {
        rangeStart: params.range.start.character,
        rangeEnd: params.range.end.character,
        force: false,
      });
      return edits;
    });
  }

  public onNotificationWorkspaceDidChangeTrust(
    onDidChangeTrust: (params: { isTrusted: boolean }) => void
  ) {
    this.connection.onNotification(
      "workspace/didChangeTrust",
      onDidChangeTrust
    );
  }
}
