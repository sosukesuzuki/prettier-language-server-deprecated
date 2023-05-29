import { TextDocument } from "vscode-languageserver-textdocument";
import { LoggingService } from "./LoggingService";
import {
  ExtensionFormattingOptions,
  ModuleResolverInterface,
  PrettierBuiltInParserName,
  PrettierFileInfoResult,
  PrettierOptions,
  RangeFormattingOptions,
} from "./types";
import { ConnectionService } from "./ConnectionService";
import { URI } from "vscode-uri";
import { getParserFromLanguageId } from "./languageFilter";

export class PrettierEditService {
  constructor(
    private connectionService: ConnectionService,
    private loggingService: LoggingService,
    private moduleResolver: ModuleResolverInterface
  ) {}

  private async format(
    text: string,
    document: TextDocument,
    options: ExtensionFormattingOptions
  ) {
    const uri = URI.parse(document.uri);

    this.loggingService.logInfo(`Formatting ${uri}`);

    const vscodeConfig = await this.connectionService.getConfig(uri);

    const resolvedConfig = await this.moduleResolver.getResolvedConfig(
      document,
      vscodeConfig
    );

    if (resolvedConfig === "error" || resolvedConfig === "disabled") {
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

    let resolvedIgnorePath: string | undefined;
    if (vscodeConfig.ignorePath) {
      resolvedIgnorePath = await this.moduleResolver.getResolvedIgnorePath(
        uri.fsPath,
        vscodeConfig.ignorePath
      );
      if (resolvedIgnorePath) {
        this.loggingService.logInfo(
          `Using ignore file (if present) at ${resolvedIgnorePath}`
        );
      }
    }

    let fileInfo: PrettierFileInfoResult | undefined;
    if (uri.fsPath) {
      fileInfo = await prettierInstance.getFileInfo(uri.fsPath, {
        ignorePath: resolvedIgnorePath,
        resolveConfig: true,
        withNodeModules: vscodeConfig.withNodeModules,
      });
      this.loggingService.logInfo("File Info:", fileInfo);
    }

    if (!options.force && fileInfo && fileInfo.ignored) {
      this.loggingService.logInfo("File is ignored, skipping.");
      // this.statusBar.update(FormatterStatus.Ignore);
      return;
    }

    const { languageId } = document;

    let parser: PrettierBuiltInParserName | string | undefined;
    if (fileInfo && fileInfo.inferredParser) {
      parser = fileInfo.inferredParser;
    } else if (languageId !== "plaintext") {
      // Don't attempt VS Code language for plaintext because we never have
      // a formatter for plaintext and most likely the reason for this is
      // somebody has registered a custom file extension without properly
      // configuring the parser in their prettier config.
      this.loggingService.logWarning(
        `Parser not inferred, trying VS Code language.`
      );
      const { languages } = await prettierInstance.getSupportInfo();
      parser = getParserFromLanguageId(languages, uri, languageId);
    }

    if (!parser) {
      this.loggingService.logError(
        `Failed to resolve a parser, skipping file. If you registered a custom file extension, be sure to configure the parser.`
      );
      // this.statusBar.update(FormatterStatus.Error);
      return;
    }

    const prettierOptions = this.getPrettierOptions(
      uri.fsPath,
      parser as PrettierBuiltInParserName,
      vscodeConfig,
      resolvedConfig,
      options
    );

    this.loggingService.logInfo("Prettier Options:", prettierOptions);

    try {
      // Since Prettier v3, `format` returns Promise.
      const formattedText = await prettierInstance.format(
        text,
        prettierOptions
      );
      // this.statusBar.update(FormatterStatus.Success);

      return formattedText;
    } catch (error) {
      this.loggingService.logError("Error formatting document.", error);
      // this.statusBar.update(FormatterStatus.Error);

      return text;
    }
  }

  private async getPrettierOptions(
    fileName: string,
    parser: PrettierBuiltInParserName,
    vsCodeConfig: PrettierOptions,
    configOptions: PrettierOptions | null,
    extensionFormattingOptions: ExtensionFormattingOptions
  ) {
    const fallbackToVSCodeConfig = configOptions === null;

    const vsOpts: PrettierOptions = {};
    if (fallbackToVSCodeConfig) {
      vsOpts.arrowParens = vsCodeConfig.arrowParens;
      vsOpts.bracketSpacing = vsCodeConfig.bracketSpacing;
      vsOpts.endOfLine = vsCodeConfig.endOfLine;
      vsOpts.htmlWhitespaceSensitivity = vsCodeConfig.htmlWhitespaceSensitivity;
      vsOpts.insertPragma = vsCodeConfig.insertPragma;
      vsOpts.singleAttributePerLine = vsCodeConfig.singleAttributePerLine;
      vsOpts.bracketSameLine = vsCodeConfig.bracketSameLine;
      vsOpts.jsxBracketSameLine = vsCodeConfig.jsxBracketSameLine;
      vsOpts.jsxSingleQuote = vsCodeConfig.jsxSingleQuote;
      vsOpts.printWidth = vsCodeConfig.printWidth;
      vsOpts.proseWrap = vsCodeConfig.proseWrap;
      vsOpts.quoteProps = vsCodeConfig.quoteProps;
      vsOpts.requirePragma = vsCodeConfig.requirePragma;
      vsOpts.semi = vsCodeConfig.semi;
      vsOpts.singleQuote = vsCodeConfig.singleQuote;
      vsOpts.tabWidth = vsCodeConfig.tabWidth;
      vsOpts.trailingComma = vsCodeConfig.trailingComma;
      vsOpts.useTabs = vsCodeConfig.useTabs;
      vsOpts.embeddedLanguageFormatting =
        vsCodeConfig.embeddedLanguageFormatting;
      vsOpts.vueIndentScriptAndStyle = vsCodeConfig.vueIndentScriptAndStyle;
    }

    this.loggingService.logInfo(
      fallbackToVSCodeConfig
        ? "No local configuration (i.e. .prettierrc or .editorconfig) detected, falling back to VS Code configuration"
        : "Detected local configuration (i.e. .prettierrc or .editorconfig), VS Code configuration will not be used"
    );

    let rangeFormattingOptions: RangeFormattingOptions | undefined;
    if (
      extensionFormattingOptions.rangeEnd &&
      extensionFormattingOptions.rangeStart
    ) {
      rangeFormattingOptions = {
        rangeEnd: extensionFormattingOptions.rangeEnd,
        rangeStart: extensionFormattingOptions.rangeStart,
      };
    }

    const options: PrettierOptions = {
      ...(fallbackToVSCodeConfig ? vsOpts : {}),
      ...{
        /* cspell: disable-next-line */
        filepath: fileName,
        parser: parser as PrettierBuiltInParserName,
      },
      ...(rangeFormattingOptions || {}),
      ...(configOptions || {}),
    };

    if (extensionFormattingOptions.force && options.requirePragma === true) {
      options.requirePragma = false;
    }

    return options;
  }
}
