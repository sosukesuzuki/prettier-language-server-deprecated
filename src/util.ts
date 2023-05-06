import * as os from "node:os";
import * as path from "node:path";
import type { WorkspaceFolder } from "vscode-languageserver/node";
import { URI } from "vscode-uri";

/**
 * Alternative of workspace.getWorkspaceFolder
 */
export function getWorkspaceFolder(
  workspaceFolders: WorkspaceFolder[],
  fsPath: string
): WorkspaceFolder | undefined {
  return workspaceFolders.find((workspaceFolder) => {
    const fileUri = URI.file(fsPath);
    return fileUri.toString() === workspaceFolder.uri;
  });
}

export function getWorkspaceRelativePath(
  filePath: string,
  pathToResolve: string,
  workspaceFolders: WorkspaceFolder[] | null | undefined
): string | undefined {
  // In case the user wants to use ~/.prettierrc on Mac
  if (
    process.platform === "darwin" &&
    pathToResolve.indexOf("~") === 0 &&
    os.homedir()
  ) {
    return pathToResolve.replace(/^~(?=$|\/|\\)/, os.homedir());
  }

  if (workspaceFolders) {
    const folder = getWorkspaceFolder(workspaceFolders, filePath);
    return folder
      ? path.isAbsolute(pathToResolve)
        ? pathToResolve
        : path.join(URI.parse(folder.uri).fsPath, pathToResolve)
      : undefined;
  }
}
