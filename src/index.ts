import { TextDocument } from "vscode-languageserver-textdocument";
import {
  ProposedFeatures,
  TextDocuments,
  createConnection,
} from "vscode-languageserver/node";
import { WorkspaceService } from "./WorkspaceService";
import { RegistrationService } from "./RegistrationService";
import { ConsoleLoggingService } from "./LoggingService";
import { ModuleResolver } from "./ModuleResolver";
import { PrettierEditService } from "./PrettierEditService";

export function createPrettierLanguageServer() {
  const connection = createConnection(ProposedFeatures.all);
  const documents = new TextDocuments(TextDocument);

  const loggingService = new ConsoleLoggingService(connection);

  const registrationService = new RegistrationService(
    connection,
    documents,
    loggingService
  );

  registrationService
    .registerOnInitialize()
    .then(({ workspaceFolders, hasConfigurationCapability }) => {
      registrationService.registerOnInitialized(hasConfigurationCapability);

      // =============== isTrusted registration ================
      let isTrusted = false;
      registrationService.onNotificationWorkspaceDidChangeTrust((params) => {
        isTrusted = params.isTrusted;
      });
      const getIsTrusted = () => isTrusted;
      // =======================================================

      const workspaceService = new WorkspaceService(
        connection,
        loggingService,
        getIsTrusted
      );

      const moduleResolver = new ModuleResolver(
        loggingService,
        workspaceFolders,
        workspaceService
      );

      const prettierEditService = new PrettierEditService(
        loggingService,
        workspaceService,
        moduleResolver
      );

      registrationService.regsiterOnDocumentFormatting(prettierEditService);
      registrationService.registerOnDocumentRangeFormatting(
        prettierEditService
      );
    });

  connection.listen();
  documents.listen(connection);
}
