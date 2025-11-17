import type { Tracer } from "@opentelemetry/api";
import { trace } from "@opentelemetry/api";
import { getContext } from "./core/context";

export interface AiTelemetryOptions {
  isEnabled: true;
  functionId: string;
  recordInputs?: boolean;
  recordOutputs?: boolean;
  metadata?: Record<string, unknown>;
  tracer?: Tracer;
}

export interface AiTelemetryControls {
  recordInputs?: boolean;
  recordOutputs?: boolean;
  /**
   * Optionally override the tracer. If not provided, a default tracer
   * from `@opentelemetry/api` is used.
   */
  tracer?: Tracer;
}

const getCurrentRequestId = (): string | undefined => {
  const ctx = getContext();
  const bindings = ctx?.bindings as { requestId?: string } | undefined;
  return bindings?.requestId;
};

export const createAiTelemetryOptions = (
  functionId: string,
  metadata?: Record<string, unknown>,
  controls?: AiTelemetryControls
): AiTelemetryOptions => {
  const requestId = getCurrentRequestId();

  const tracer: Tracer | undefined = controls?.tracer ?? trace.getTracer("ai");

  return {
    isEnabled: true,
    functionId,
    recordInputs: controls?.recordInputs,
    recordOutputs: controls?.recordOutputs,
    tracer,
    metadata: {
      ...(requestId ? { requestId } : {}),
      ...(metadata ?? {}),
    },
  } satisfies AiTelemetryOptions;
};
