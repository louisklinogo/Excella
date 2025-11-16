import { createModel, type ModelFactoryOptions } from "@excella/core";
import type { ModelProvider } from "@excella/core/model-config";
import { seedRequestContext, startTimer } from "@excella/logging";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

type ChatRequestExtras = {
  model?: string;
  webSearch?: boolean;
};

type ChatRequestBody = {
  messages: UIMessage[];
  body?: ChatRequestExtras;
  data?: ChatRequestExtras;
};

const isSupportedProvider = (provider: string): provider is ModelProvider =>
  provider === "google" || provider === "anthropic" || provider === "openai";

const parseModelSelection = (value?: string): ModelFactoryOptions => {
  if (!value) {
    return {};
  }

  const [rawProvider, ...rest] = value.split("/");
  const modelId = rest.join("/");

  if (!(rawProvider && modelId)) {
    return {};
  }

  if (!isSupportedProvider(rawProvider)) {
    return {};
  }

  return { provider: rawProvider, modelId } satisfies ModelFactoryOptions;
};

export function POST(request: Request): Promise<Response> {
  return seedRequestContext(request, async ({ logger: requestLogger }) => {
    const { messages, body, data } = (await request.json()) as ChatRequestBody;

    const extras: ChatRequestExtras = body ?? data ?? {};
    const modelOptions = parseModelSelection(extras.model);

    const timer = startTimer();
    const provider = modelOptions.provider ?? "unknown";
    const modelId = modelOptions.modelId ?? "default";

    requestLogger.info("ai.request.start", {
      provider,
      model: modelId,
    });

    try {
      const result = await streamText({
        model: createModel(modelOptions),
        messages: convertToModelMessages(messages),
      });

      const durationMs = Date.now() - timer.start;

      requestLogger.info("ai.request.done", {
        provider,
        model: modelId,
        durationMs,
        status: "ok",
      });

      return result.toUIMessageStreamResponse();
    } catch (error) {
      const durationMs = Date.now() - timer.start;

      requestLogger.error("ai.request.done", {
        provider,
        model: modelId,
        durationMs,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  });
}
