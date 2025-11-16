import type { LoggerConfig } from "../config";
import { validateEvent } from "../events/schemas";
import { serializeError } from "../serialize-error";
import { type BufferOptions, pushToBuffer } from "./buffer";
import { type RedactionOptions, shouldRedact } from "./redaction";
import { isPlainObject, trunc } from "./trunc";
import type { Fields, LogEntry, Logger, LogLevel, Transport } from "./types";

type Sanitized =
  | Fields
  | string
  | number
  | boolean
  | null
  | undefined
  | unknown[];

const sanitizeValue = (
  value: unknown,
  keyPath: string,
  config: LoggerConfig,
  redaction: RedactionOptions
): Sanitized => {
  if (shouldRedact(keyPath, redaction)) {
    return redaction.mask ?? "[redacted]";
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    return trunc(value, config.truncLength);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizeValue(item, `${keyPath}[${index}]`, config, redaction)
    );
  }

  if (isPlainObject(value)) {
    return sanitizeObject(value as Fields, keyPath, config, redaction);
  }

  return value as Sanitized;
};

const sanitizeObject = (
  value: Fields,
  parentPath: string,
  config: LoggerConfig,
  redaction: RedactionOptions
): Fields => {
  const output: Fields = {};
  for (const [key, child] of Object.entries(value)) {
    const path = parentPath ? `${parentPath}.${key}` : key;
    if (shouldRedact(path, redaction)) {
      output[key] = redaction.mask ?? "[redacted]";
      continue;
    }
    output[key] = sanitizeValue(child, path, config, redaction);
  }
  return output;
};

const sanitizeBindings = (
  bindings: Fields | undefined,
  config: LoggerConfig,
  redaction: RedactionOptions
): Fields => {
  if (!bindings) return {};
  return sanitizeObject({ ...bindings }, "bindings", config, redaction);
};

const sanitizeData = (
  fields: Fields | undefined,
  config: LoggerConfig,
  redaction: RedactionOptions
): Fields | undefined => {
  if (!fields) return;
  return sanitizeObject({ ...fields }, "data", config, redaction);
};

export interface InternalLoggerOptions {
  config: LoggerConfig;
  transport: Transport;
  buffer: BufferOptions;
  bindings?: Fields;
}

class BoundLogger implements Logger {
  private readonly bindings: Fields;
  private readonly redaction: RedactionOptions;

  constructor(
    private readonly options: InternalLoggerOptions,
    bindings?: Fields
  ) {
    this.redaction = {
      redactKeys: options.config.redactKeys,
      mask: options.config.redactionMask,
    } satisfies RedactionOptions;
    this.bindings = sanitizeBindings(
      bindings ?? options.bindings ?? {},
      options.config,
      this.redaction
    );
  }

  child(bindings?: Fields): Logger {
    const merged = { ...this.bindings, ...(bindings ?? {}) } satisfies Fields;
    return new BoundLogger(this.options, merged);
  }

  debug(event: string, fields?: Fields): void {
    this.write("debug", event, fields);
  }

  info(event: string, fields?: Fields): void {
    this.write("info", event, fields);
  }

  warn(event: string, fields?: Fields): void {
    this.write("warn", event, fields);
  }

  error(event: string, fields?: Fields): void {
    this.write("error", event, fields);
  }

  private write(level: LogLevel, event: string, fields?: Fields): void {
    const safeEvent = event || "log";
    const data = sanitizeData(fields, this.options.config, this.redaction);
    const entry: LogEntry = {
      level,
      event: safeEvent,
      timestamp: new Date().toISOString(),
      bindings: this.bindings,
      data,
    } satisfies LogEntry;
    if (!validateEvent(safeEvent, data ?? {})) {
      console.warn("[@excella/logging] Invalid event payload", {
        event: safeEvent,
        data,
      });
    }
    this.options.transport.log(entry);
    pushToBuffer(entry, this.options.buffer);
  }
}

export const createRootLogger = (options: InternalLoggerOptions): Logger =>
  new BoundLogger(options, options.bindings ?? {});

export { clearLogBuffer, getLogBuffer } from "./buffer";
