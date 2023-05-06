export interface LoggingService {
  logDebug(message: string, data?: unknown): void;
  logInfo(message: string, data?: unknown): void;
  logWarning(message: string, data?: unknown): void;
  logError(message: string, data?: unknown): void;
}
