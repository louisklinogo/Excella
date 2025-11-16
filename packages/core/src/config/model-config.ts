export type ModelProvider = "google" | "anthropic" | "openai";

export const DEFAULT_PROVIDER: ModelProvider = "google";

export const DEFAULT_GOOGLE_MODEL = "gemini-2.5-pro" as const;

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5" as const;

export const DEFAULT_OPENAI_MODEL = "gpt-4o" as const;

export type BaseModelConfig = {
  provider: ModelProvider;
  modelId: string;
};

export type GoogleConfig = BaseModelConfig & {
  provider: "google";
  apiKey?: string;
};

export type AnthropicConfig = BaseModelConfig & {
  provider: "anthropic";
  apiKey?: string;
  baseURL?: string;
};
export type OpenAIConfig = BaseModelConfig & {
  provider: "openai";
  apiKey?: string;
  baseURL?: string;
};

export type ProviderConfig = GoogleConfig | AnthropicConfig | OpenAIConfig;
