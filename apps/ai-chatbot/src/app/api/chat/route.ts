import { createModel, type ModelFactoryOptions } from "@excella/core";
import type { ModelProvider } from "@excella/core/model-config";
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

const isSupportedProvider = (provider: string): provider is ModelProvider => {
  return provider === "google" || provider === "anthropic" || provider === "openai";
};

const parseModelSelection = (value?: string): ModelFactoryOptions => {
  if (!value) {
    return {};
  }

  const [rawProvider, ...rest] = value.split("/");
  const modelId = rest.join("/");

  if (!rawProvider || !modelId) {
    return {};
  }

  if (!isSupportedProvider(rawProvider)) {
    return {};
  }

  return { provider: rawProvider, modelId } satisfies ModelFactoryOptions;
};

export async function POST(request: Request): Promise<Response> {
  const { messages, body, data } = (await request.json()) as ChatRequestBody;

  const extras: ChatRequestExtras = body ?? data ?? {};
  const modelOptions = parseModelSelection(extras.model);

  const result = await streamText({
    model: createModel(modelOptions),
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
