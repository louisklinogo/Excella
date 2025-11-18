import type { LoggerConfig } from "./config";
import { loadConfig } from "./config";
import { getContext, runWithContext } from "./core/context";
import { clearLogBuffer, createRootLogger, getLogBuffer } from "./core/logger";
import { shouldSample } from "./core/sampling";
import { startTimer, withTimer } from "./core/timer";
import { trunc } from "./core/trunc";
import type { Fields, Logger, Transport } from "./core/types";
import { serializeError } from "./serialize-error";
import { createConsoleTransport } from "./transports/console";
import { createPinoTransport } from "./transports/pino";

const createBufferOptions = (config: LoggerConfig) =>
  ({
    enabled: config.enableBuffer,
    limit: config.bufferLimit,
  }) as const;

const selectTransport = (config: LoggerConfig): Transport => {
  if (config.usePino && config.format === "json") {
    try {
      return createPinoTransport(config);
    } catch (error) {
      console.warn(
        "[@excella/logging] Failed to initialize pino transport, falling back to console",
        error
      );
    }
  }
  return createConsoleTransport(config);
};

let currentConfig: LoggerConfig = loadConfig();
let currentTransport: Transport = selectTransport(currentConfig);
let rootLogger: Logger = createRootLogger({
  config: currentConfig,
  transport: currentTransport,
  buffer: createBufferOptions(currentConfig),
  bindings: { service: currentConfig.serviceName },
});

const loggerProxy: Logger = {
  debug(event, fields) {
    rootLogger.debug(event, fields);
  },
  info(event, fields) {
    rootLogger.info(event, fields);
  },
  warn(event, fields) {
    rootLogger.warn(event, fields);
  },
  error(event, fields) {
    rootLogger.error(event, fields);
  },
  child(bindings) {
    return rootLogger.child(bindings);
  },
};

export const configureLogging = (overrides: Partial<LoggerConfig>): void => {
  currentConfig = loadConfig({ ...currentConfig, ...overrides });
  currentTransport = selectTransport(currentConfig);
  rootLogger = createRootLogger({
    config: currentConfig,
    transport: currentTransport,
    buffer: createBufferOptions(currentConfig),
    bindings: { service: currentConfig.serviceName },
  });
};

export const createLogger = (
  bindings?: Fields,
  overrides?: Partial<LoggerConfig>
): Logger => {
  if (overrides) {
    const merged = loadConfig({ ...currentConfig, ...overrides });
    const transport = selectTransport(merged);
    return createRootLogger({
      config: merged,
      transport,
      buffer: createBufferOptions(merged),
      bindings: { service: merged.serviceName, ...(bindings ?? {}) },
    });
  }
  return rootLogger.child(bindings);
};

export const getLogger = (): Logger => {
  const ctx = getContext();
  if (ctx?.logger) return ctx.logger;
  return rootLogger;
};

export const withRequestContext = <T>(
  bindings: Fields,
  fn: (logger: Logger) => Promise<T> | T,
  metadata?: Record<string, unknown>
): Promise<T> | T => {
  const contextLogger = rootLogger.child(bindings);
  return runWithContext({ bindings, metadata, logger: contextLogger }, () =>
    fn(contextLogger)
  );
};

export { loggerProxy as logger };
export {
  shouldSample,
  trunc,
  startTimer,
  withTimer,
  serializeError,
  loadConfig,
  getLogBuffer,
  clearLogBuffer,
};
export type { Logger, LoggerConfig };

export const getCurrentConfig = (): LoggerConfig => currentConfig;

export const getRequestContext = () => getContext();

export { getRequestId, seedRequestContext } from "./adapters/next";
export {
  EventSchemas,
  type KnownEvent,
  validateEvent,
} from "./events/schemas";
export {
  type AiTelemetryControls,
  type AiTelemetryOptions,
  createAiTelemetryOptions,
} from "./telemetry";
