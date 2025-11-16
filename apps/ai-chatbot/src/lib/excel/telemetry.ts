import {
  getCurrentConfig,
  getRequestId,
  logger,
  shouldSample,
} from "@excella/logging";

export type ExcelBatchStatus = "ok" | "error" | "timeout";

export interface ExcelBatchDetails {
  action: string;
  rows?: number;
  cols?: number;
}

export const withExcelBatchTelemetry = async <T>(
  details: ExcelBatchDetails,
  fn: () => Promise<T> | T,
): Promise<T> => {
  const { action, rows, cols } = details;
  const requestId = getRequestId();
  const config = getCurrentConfig();
  const sampled = shouldSample(config);

  if (sampled) {
    logger.info("excel.batch", {
      action,
      rows,
      cols,
      requestId,
    });
  }

  const start = Date.now();

  try {
    const result = await fn();
    const durationMs = Date.now() - start;

    if (sampled) {
      logger.info("excel.batch.done", {
        action,
        rows,
        cols,
        durationMs,
        status: "ok" as ExcelBatchStatus,
        requestId,
      });
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - start;

    logger.error("excel.batch.done", {
      action,
      rows,
      cols,
      durationMs,
      status: "error" as ExcelBatchStatus,
      requestId,
      error,
    });

    throw error;
  }
};

interface ToolTelemetryOptions {
  paramsSize?: number;
  estimateResultSize?: (result: unknown) => number | undefined;
}

export const withToolTelemetry = async <T>(
  tool: string,
  fn: () => Promise<T> | T,
  options?: ToolTelemetryOptions,
): Promise<T> => {
  const requestId = getRequestId();
  const config = getCurrentConfig();
  const sampled = shouldSample(config);

  if (sampled) {
    logger.info("tool.call", {
      tool,
      paramsSize: options?.paramsSize,
      sampled,
      requestId,
    });
  }

  const start = Date.now();

  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    const resultSize = options?.estimateResultSize?.(result);

    if (sampled) {
      logger.info("tool.result", {
        tool,
        resultSize,
        durationMs,
        status: "ok",
        requestId,
      });
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - start;

    logger.error("tool.result", {
      tool,
      durationMs,
      status: "error",
      requestId,
      error,
    });

    throw error;
  }
};

export const withGetExcelContextSnapshotTelemetry = async <T>(
  fn: () => Promise<T> | T,
  options?: ToolTelemetryOptions,
): Promise<T> => withToolTelemetry("getExcelContextSnapshot", fn, options);

export const withExecuteExcelPlanTelemetry = async <T>(
  fn: () => Promise<T> | T,
  options?: ToolTelemetryOptions,
): Promise<T> => withToolTelemetry("executeExcelPlan", fn, options);

export const withPlanBatchTelemetry = async <T>(
  fn: () => Promise<T> | T,
  details?: Partial<ExcelBatchDetails>,
): Promise<T> =>
  withExcelBatchTelemetry(
    {
      action: "execute-plan",
      ...details,
    },
    fn,
  );
