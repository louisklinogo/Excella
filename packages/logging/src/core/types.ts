export type LogLevel = "debug" | "info" | "warn" | "error";

export type Fields = Record<string, unknown>;

export interface Logger {
  debug(event: string, fields?: Fields): void;
  info(event: string, fields?: Fields): void;
  warn(event: string, fields?: Fields): void;
  error(event: string, fields?: Fields): void;
  child(bindings?: Fields): Logger;
}

export interface LogEntry {
  level: LogLevel;
  event: string;
  timestamp: string;
  bindings: Fields;
  data?: Fields;
}

export interface Transport {
  log(entry: LogEntry): void;
}
