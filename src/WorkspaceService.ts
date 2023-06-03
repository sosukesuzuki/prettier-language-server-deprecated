import { Connection } from "vscode-languageserver/node";
import type {
  ExecuteNpmPackageManagerCommand,
  PackageManagers,
  PrettierVSCodeConfig,
} from "./types";
import { URI } from "vscode-uri";
import { LoggingService } from "./LoggingService";

/**
 * Cache for document uri to configuration
 */
const document2Setting: Map<
  /* uri */ string,
  Promise<PrettierVSCodeConfig>
> = new Map();

export class WorkspaceService {
  private loggingService: LoggingService;

  constructor(
    private connection: Connection,
    loggingService: LoggingService,
    public isTrusted: () => boolean
  ) {
    this.loggingService = loggingService;
  }

  public getConfig(uri: URI): Promise<PrettierVSCodeConfig> {
    let resultPromise = document2Setting.get(uri.fsPath);
    if (resultPromise) {
      return resultPromise;
    }
    resultPromise = this.connection.workspace
      .getConfiguration()
      .then((config) => {
        if (this.isTrusted()) {
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
    document2Setting.set(uri.fsPath, resultPromise);
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
}
