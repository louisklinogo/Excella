import type { LoggerConfig } from "../config";

export const shouldSample = (config: LoggerConfig): boolean =>
  Math.random() < config.sampleRate;
