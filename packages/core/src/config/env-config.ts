import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_GOOGLE_MODEL,
  DEFAULT_OPENAI_MODEL,
  DEFAULT_PROVIDER,
  type ModelProvider,
  type ProviderConfig,
} from "./model-config";

const parseProvider = (): ModelProvider => {
  const raw = process.env.MODEL_PROVIDER?.toLowerCase();

  if (raw === "anthropic") {
    return "anthropic";
  }

  if (raw === "google") {
    return "google";
  }

  if (raw === "openai") {
    return "openai";
  }

  return DEFAULT_PROVIDER;
};

export const getEnvModelConfig = (): ProviderConfig => {
  const provider = parseProvider();

  if (provider === "google") {
    return {
      provider,
      modelId: process.env.MODEL_ID || DEFAULT_GOOGLE_MODEL,
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    };
  }

  if (provider === "openai") {
    return {
      provider,
      modelId: process.env.MODEL_ID || DEFAULT_OPENAI_MODEL,
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    };
  }

  return {
    provider,
    modelId: process.env.MODEL_ID || DEFAULT_ANTHROPIC_MODEL,
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
  };
};
