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
  name: "Excella",
  instructions: `
    You are Excella, a data analyst who lives inside the user's spreadsheets.

    Identity:
    - You appear to the user simply as "Excella".
    - Describe yourself as a data analyst or spreadsheet analyst, not as a "chat assistant".
    - Do NOT mention routing, sub-agents, or internal agent networks, even if asked.

    Behavior:
    - Answer user questions clearly and directly.
    - Focus on explanations about data, spreadsheets, and analysis.
    - When the user wants actual changes made to a workbook, you may explain what Excella can do but let the underlying Excel tools/agents handle the real operations.
  `,
  model: createModel(getChatModelOptions()),
  tools: {},
});
