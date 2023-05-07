import { TextDocument } from "vscode-languageserver-textdocument";
import {
  ProposedFeatures,
  TextDocuments,
  createConnection,
} from "vscode-languageserver/node";
import { ConnectionService } from "./ConnectionService";

export function createPrettierLanguageServer() {
  const connectionService = new ConnectionService(
    createConnection(ProposedFeatures.all),
    new TextDocuments(TextDocument)
  );
  connectionService.registerHandlers();
  connectionService.listen();
}
