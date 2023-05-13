import { TextDocument } from "vscode-languageserver-textdocument";
import { LoggingService } from "./LoggingService";
import { ModuleResolverInterface } from "./types";
import { ConnectionService } from "./ConnectionService";
import { URI } from "vscode-uri";

export class PrettierEditService {
  constructor(
    private connectionService: ConnectionService,
    private loggingService: LoggingService,
    private moduleResolver: ModuleResolverInterface
  ) {}

  private async format(document: TextDocument) {
    const uri = URI.parse(document.uri);

    this.loggingService.logInfo(`Formatting ${uri}`);

    const vscodeConfig = await this.connectionService.getConfig(uri);

    const resolveConfig = await this.moduleResolver.getResolvedConfig(
      document,
      vscodeConfig
    );

    if (resolveConfig === "error" || resolveConfig === "disabled") {
      // TODO: 何かしらのエラーを throw してクライアントに伝える
      return;
    }

    const prettierInstance = await this.moduleResolver.getPrettierInstance(
      uri.fsPath
    );

    if (!prettierInstance) {
      this.loggingService.logError(
        "Prettier could not be loaded. See previous logs for more information."
      );
      // TODO: 何かしらのエラーを throw してクライアントに伝える
      return;
    }
  }
}
