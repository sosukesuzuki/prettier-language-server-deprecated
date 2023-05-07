import { TextDocument } from "vscode-languageserver-textdocument";
import {
  Connection,
  InitializeResult,
  Range,
  TextDocumentSyncKind,
  TextDocuments,
  TextEdit,
} from "vscode-languageserver/node";
import type { ExecuteNpmPackageManagerCommand, PackageManagers } from "./types";

export class ConnectionService {
  private isTrustedWorkspace = false;

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
    this.connection.onInitialize(() => {
      const result: InitializeResult = {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          documentFormattingProvider: true,
          documentRangeFormattingProvider: true,
        },
      };
      return result;
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
