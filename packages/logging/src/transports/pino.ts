import pino from "pino";
import type { LoggerConfig } from "../config";
import type { LogEntry, Transport } from "../core/types";

export const createPinoTransport = (config: LoggerConfig): Transport => {
  const logger = pino({
    level: config.level,
    name: config.serviceName,
  });

  return {
    log(entry: LogEntry) {
      logger[entry.level](
        {
          ...entry.bindings,
          ...(entry.data ?? {}),
        },
        entry.event
      );
    },
  };
};
