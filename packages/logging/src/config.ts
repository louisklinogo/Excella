import { env } from "node:process";
import type { LogLevel } from "./core/types";
import { DEFAULT_REDACT_KEYS, mergeRedactKeys } from "./presets";

export type LogFormat = "json" | "pretty";

export interface LoggerConfig {
  level: LogLevel;
  format: LogFormat;
  serviceName: string;
  sampleRate: number;
  truncLength: number;
  usePino: boolean;
  enableBuffer: boolean;
  bufferLimit: number;
  redactKeys: string[];
  redactionMask: string;
  correlationHeader: string;
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: "info",
  format: env.NODE_ENV === "production" ? "json" : "pretty",
  serviceName: env.EXCELLA_SERVICE_NAME ?? "excella",
  sampleRate: Number.parseFloat(env.EXCELLA_LOG_SAMPLE ?? "1"),
  truncLength: Number.parseInt(env.EXCELLA_LOG_TRUNC ?? "20000", 10),
  usePino: env.EXCELLA_USE_PINO !== "false",
  enableBuffer: env.EXCELLA_LOG_ENABLE_BUFFER !== "false",
  bufferLimit: Number.parseInt(env.EXCELLA_LOG_BUFFER_MAX ?? "500", 10),
  redactKeys: mergeRedactKeys(
    DEFAULT_REDACT_KEYS,
    env.EXCELLA_LOG_REDACT_KEYS?.split(",")
      .map((key) => key.trim().toLowerCase())
      .filter(Boolean) ?? []
  ),
  redactionMask: env.EXCELLA_LOG_REDACTION_MASK ?? "[redacted]",
  correlationHeader: env.EXCELLA_LOG_CORRELATION_HEADER ?? "x-request-id",
};

const clampNumber = (
  value: number,
  fallback: number,
  min: number,
  max: number
): number => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
};

export const loadConfig = (
  overrides: Partial<LoggerConfig> = {}
): LoggerConfig => {
  const sampleRate = clampNumber(
    overrides.sampleRate ?? DEFAULT_CONFIG.sampleRate,
    DEFAULT_CONFIG.sampleRate,
    0,
    1
  );
  const truncLength = Math.max(
    256,
    overrides.truncLength ?? DEFAULT_CONFIG.truncLength
  );
  const bufferLimit = Math.max(
    1,
    overrides.bufferLimit ?? DEFAULT_CONFIG.bufferLimit
  );

  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    sampleRate,
    truncLength,
    bufferLimit,
  } satisfies LoggerConfig;
};
