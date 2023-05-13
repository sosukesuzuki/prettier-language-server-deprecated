import { Connection } from "vscode-languageserver";

export interface LoggingService {
  logDebug(message: string, data?: unknown): void;
  logInfo(message: string, data?: unknown): void;
  logWarning(message: string, data?: unknown): void;
  logError(message: string, data?: unknown): void;
}

export class ConsoleLoggingService implements LoggingService {
  constructor(private connection: Connection) {}

  logDebug(message: string, data?: unknown): void {
    this.connection.console.log(message);
    if (data != null) {
      this.logObj(data, "log");
    }
  }

  logInfo(message: string, data?: unknown): void {
    this.connection.console.info(message);
    if (data != null) {
      this.logObj(data, "info");
    }
  }

  logWarning(message: string, data?: unknown): void {
    this.connection.console.warn(message);
    if (data != null) {
      this.logObj(data, "warn");
    }
  }
  logError(message: string, data?: unknown): void {
    this.connection.console.error(message);
    if (data != null) {
      this.logObj(data, "error");
    }
  }

  private logObj(data: unknown, loglevel: "log" | "info" | "warn" | "error") {
    this.connection.console[loglevel](JSON.stringify(data, null, 2));
  }
}
