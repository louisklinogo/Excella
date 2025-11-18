import type { ToolUIPart } from "ai";

type ToolMapperArgs = {
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: unknown;
  state: ToolUIPart["state"];
};

export const mapToolCallToToolUIPart = ({
  toolName,
  input,
  output,
  error,
  state,
}: ToolMapperArgs): ToolUIPart => ({
  type: toolName,
  state,
  input,
  output,
  errorText: error ? String(error) : undefined,
});
