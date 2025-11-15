import { useAssistantState } from "@assistant-ui/react";
import type { ToolCallMessagePart } from "@assistant-ui/react";

interface Todo {
  text: string;
  status: "new" | "pending" | "in-progress" | "done";
}

interface TodosResult {
  todos: Todo[];
}

export const useLatestTodos = () => {
  return useAssistantState(({ thread }) => {
    // Find all updateTodosTool and ask-for-plan-approval tool calls with results
    const assistantToolCalls = thread.messages
      .filter((message) => message.role === "assistant")
      .flatMap((message) =>
        message.content.filter(
          (content): content is ToolCallMessagePart =>
            content.type === "tool-call" &&
            (content.toolName === "updateTodosTool" ||
             content.toolName === "ask-for-plan-approval") &&
            content.result !== undefined,
        ),
      );

    if (assistantToolCalls.length === 0) {
      return [];
    }

    // Get the most recent tool call result
    const latestToolCall = assistantToolCalls[assistantToolCalls.length - 1];

    try {
      const result = latestToolCall.result as TodosResult;
      if (result?.todos && Array.isArray(result.todos)) {
        return result.todos;
      }
    } catch (e) {
      console.error("Failed to parse todos from tool result:", e);
    }

    return [];
  });
};