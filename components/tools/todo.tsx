import { makeAssistantToolUI, useAssistantState } from "@assistant-ui/react";
import type { ToolCallMessagePart } from "@assistant-ui/react";
import { useMemo, useState } from "react";
import { CheckCircle2, Circle, ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Todo {
  text: string;
  status: "new" | "pending" | "in-progress" | "done";
}

interface UpdateTodosArgs {
  new?: string[];
  inProgress?: number[];
  done?: number[];
  clearPreviouslyDone?: boolean;
  insertAt?: number;
}

interface UpdateTodosResult {
  todos: Todo[];
}

export const UpdateTodosToolUI = makeAssistantToolUI<
  UpdateTodosArgs,
  UpdateTodosResult
>({
  toolName: "updateTodosTool",
  render: function Render({ args, result }) {
    const isMostRecentTodoUpdate = useAssistantState(({ thread, part }) => {
      if (part?.type !== "tool-call" || part.toolName !== "updateTodosTool") {
        return false;
      }

      const assistantToolCalls = thread.messages
        .filter((message) => message.role === "assistant")
        .flatMap((message) =>
          message.content.filter(
            (content): content is ToolCallMessagePart =>
              content.type === "tool-call" &&
              ((content.toolName === "updateTodosTool" &&
                content.result !== undefined) ||
                content.toolName === "askForPlanApprovalTool"),
          ),
        );

      if (assistantToolCalls.length === 0) {
        return false;
      }

      const latestToolCall = assistantToolCalls[assistantToolCalls.length - 1];
      return part.toolCallId === latestToolCall.toolCallId;
    });

    const todos = result?.todos ?? [];

    const [isManualOpen, setIsOpen] = useState<boolean>();
    const isOpen = isManualOpen ?? isMostRecentTodoUpdate;

    const emphasisedIndexes = useMemo(() => {
      const targets = new Set<number>();

      (args?.inProgress ?? []).forEach((index) => targets.add(index));
      (args?.done ?? []).forEach((index) => targets.add(index));

      return targets;
    }, [args]);

    if (!result) {
      return (
        <div className="my-2 flex w-full animate-pulse items-center gap-2 text-sm font-semibold text-slate-700">
          Updating Todos...
        </div>
      );
    }

    return (
      <div
        className="my-3"
        style={{
          animation: "fadeInUp 0.4s ease-out forwards",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setIsOpen((open) => !open);
          }}
          className="flex w-full items-center gap-2 text-sm font-semibold text-slate-700"
          aria-expanded={isOpen}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              !isOpen && "-rotate-90",
            )}
          />
          Tasks
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-in-out",
            isOpen ? "mt-2 grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
          aria-hidden={!isOpen}
        >
          <div className="flex flex-col gap-1 overflow-hidden pl-6">
            {todos.length === 0 ? (
              <div className="text-xs text-slate-500">Nothing queued yet</div>
            ) : (
              todos.map((todo, index) => {
                const isDone = todo.status === "done";
                const isInProgress = todo.status === "in-progress";
                const emphasised =
                  emphasisedIndexes.has(index) || todo.status === "new";

                return (
                  <div
                    key={`${todo.text}-${index}`}
                    className="flex items-center gap-2"
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : isInProgress ? (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-blue-500">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                      </div>
                    ) : (
                      <Circle className="h-4 w-4 text-slate-400" />
                    )}
                    <span
                      className={cn(
                        "text-sm text-slate-700",
                        isDone && "text-slate-400 line-through",
                        isInProgress && "text-blue-600",
                        emphasised && "font-semibold",
                      )}
                    >
                      {todo.text}
                    </span>
                    {todo.status === "new" && (
                      <Sparkles
                        aria-hidden
                        className="h-4 w-4 text-amber-500"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  },
});
