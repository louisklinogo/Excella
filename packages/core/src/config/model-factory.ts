import { createAnthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import { getEnvModelConfig } from "./env-config";
import type { ModelProvider } from "./model-config";

export type ModelFactoryOptions = {
  provider?: ModelProvider;
  modelId?: string;
};

export const createModel = (options?: ModelFactoryOptions): LanguageModel => {
  const envConfig = getEnvModelConfig();
  const provider = options?.provider ?? envConfig.provider;
  const modelId = options?.modelId ?? envConfig.modelId;

  if (provider === "google") {
    const apiKey =
      envConfig.provider === "google"
        ? envConfig.apiKey
        : process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GOOGLE_GENERATIVE_AI_API_KEY is required when using Google as MODEL_PROVIDER."
      );
    }

    return google(modelId);
  }
  if (provider === "openai") {
    const apiKey =
      envConfig.provider === "openai"
        ? envConfig.apiKey
        : process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is required when using OpenAI as MODEL_PROVIDER."
      );
    }

    const openai = createOpenAI({
      apiKey,
      baseURL:
        envConfig.provider === "openai"
          ? envConfig.baseURL
          : process.env.OPENAI_BASE_URL,
    });

    return openai(modelId);
  }

  const apiKey =
    envConfig.provider === "anthropic"
      ? envConfig.apiKey
      : process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is required when using Anthropic as MODEL_PROVIDER."
    );
  }

  const anthropic = createAnthropic({
    apiKey,
    baseURL:
      envConfig.provider === "anthropic"
        ? envConfig.baseURL
        : process.env.ANTHROPIC_BASE_URL,
  });

  return anthropic(modelId);
};
