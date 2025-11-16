import { createTool } from "@mastra/core/tools";
import { z } from "zod";

type TodoStatus = "new" | "pending" | "in-progress" | "done";

type Todo = {
  text: string;
  status: TodoStatus;
};

type UpdateTodosContext = {
  new: string[];
  inProgress: number[];
  done: number[];
  clearPreviouslyDone: boolean;
  insertAt?: number;
};

const todoSchema = z.object({
  text: z.string(),
  status: z.enum(["new", "pending", "in-progress", "done"]),
});

const outputSchema = z.object({
  todos: z.array(todoSchema),
});

const findPreviousTodos = (messages: unknown[] | undefined): Todo[] => {
  if (!(messages && Array.isArray(messages))) {
    return [];
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const todos = extractTodosFromMessage(messages[i]);
    if (todos.length > 0) {
      return todos;
    }
  }

  return [];
};

const extractTodosFromMessage = (message: unknown): Todo[] => {
  const maybeMessage = message as { content?: unknown };
  if (!(maybeMessage?.content && Array.isArray(maybeMessage.content))) {
    return [];
  }

  for (const content of maybeMessage.content) {
    if (isUpdateTodosResult(content)) {
      try {
        const result = outputSchema.parse(
          (content as { output?: { value?: unknown } }).output?.value
        );
        if (Array.isArray(result.todos)) {
          return result.todos;
        }
      } catch {
        // Ignore parse failures and continue searching
      }
    }
  }

  return [];
};

const isUpdateTodosResult = (content: unknown): boolean => {
  const maybeContent = content as { type?: string; toolName?: string };
  return (
    maybeContent?.type === "tool-result" &&
    (maybeContent.toolName === "updateTodosTool" ||
      maybeContent.toolName === "askForPlanApprovalTool")
  );
};

const applyTodoUpdates = (
  currentTodos: Todo[],
  updates: UpdateTodosContext
): Todo[] => {
  let updatedTodos = [...currentTodos];

  updatedTodos = updatedTodos.map((todo, index) => {
    if (updates.inProgress.includes(index) || updates.done.includes(index)) {
      return todo;
    }

    if (todo.status === "new") {
      return { ...todo, status: "pending" };
    }

    return todo;
  });

  if (updates.clearPreviouslyDone) {
    updatedTodos = updatedTodos.filter((todo) => todo.status !== "done");
  }

  const newTodos: Todo[] = updates.new.map((text) => ({
    text,
    status: "new",
  }));

  if (updates.insertAt !== undefined && updates.insertAt >= 0) {
    const insertPosition = Math.min(updates.insertAt, updatedTodos.length);
    updatedTodos.splice(insertPosition, 0, ...newTodos);
  } else {
    updatedTodos.push(...newTodos);
  }

  updateTodoStatuses(updatedTodos, updates.inProgress, "in-progress");
  updateTodoStatuses(updatedTodos, updates.done, "done");

  return updatedTodos;
};

const updateTodoStatuses = (
  todos: Todo[],
  indices: number[],
  status: TodoStatus
): void => {
  for (const index of indices) {
    if (isValidIndex(index, todos)) {
      todos[index].status = status;
    }
  }
};

const isValidIndex = (index: number, array: unknown[]): boolean =>
  index >= 0 && index < array.length;

export const updateTodosTool = createTool({
  id: "update-todos",
  description:
    "Manage and update a task list to communicate progress and planned actions. Keep the list current throughout the interaction to maintain transparency about ongoing and planned work.",
  inputSchema: z.object({
    new: z.array(z.string()).describe("Array of new todo items to add"),
    inProgress: z
      .array(z.number())
      .describe("Array of indices of todos to mark as in progress"),
    done: z
      .array(z.number())
      .describe("Array of indices of todos to mark as done"),
    clearPreviouslyDone: z
      .boolean()
      .default(false)
      .describe(
        "Whether to remove all previously completed todos from the list"
      ),
    insertAt: z
      .number()
      .describe(
        "Index at which to insert new items (0 for beginning, defaults to end of list)"
      ),
  }),
  outputSchema,
  execute: ({ context }, options) => {
    const messages = options?.messages as unknown[] | undefined;
    const currentTodos = findPreviousTodos(messages);
    const updatedTodos = applyTodoUpdates(
      currentTodos,
      context as UpdateTodosContext
    );

    return {
      todos: updatedTodos,
    };
  },
});
