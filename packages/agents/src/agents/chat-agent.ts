import { createModel, type ModelFactoryOptions } from "@excella/core";
import type { ModelProvider } from "@excella/core/model-config";
import { Agent } from "@mastra/core/agent";

const getChatModelOptions = (): ModelFactoryOptions => {
  const provider =
    (process.env.CHAT_AGENT_PROVIDER as ModelProvider | undefined) ??
    (process.env.MODEL_PROVIDER as ModelProvider | undefined);

  const modelId =
    process.env.CHAT_AGENT_MODEL_ID ?? process.env.MODEL_ID ?? undefined;

  const options: ModelFactoryOptions = {};

  if (provider) {
    options.provider = provider;
  }

  if (modelId) {
    options.modelId = modelId;
  }

  return options;
};

export const chatAgent = new Agent({
  name: "Excella Chat Assistant",
  instructions: `
    You are a concise, helpful assistant for Excella.

    - Answer user questions clearly and directly.
    - Use tools only when strictly necessary.
    - Focus on conversational answers while we validate streaming and UI.
  `,
  model: createModel(getChatModelOptions()),
  tools: {},
});
