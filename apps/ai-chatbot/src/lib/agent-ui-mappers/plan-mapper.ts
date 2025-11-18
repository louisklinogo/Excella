import type { AgentPlan } from "@excella/core/excel/plan-types";

type WorkflowTodo = {
  text: string;
  status: "new" | "pending" | "in-progress" | "done";
};

export type UiTask = {
  id: string;
  title: string;
  status?: WorkflowTodo["status"];
  description?: string;
  meta?: Record<string, unknown>;
};

export type UiPlan = {
  title: string;
  description?: string;
  tasks: UiTask[];
};

export const mapWorkflowTodosToUiPlan = (todos: WorkflowTodo[]): UiPlan => ({
  title: "Plan for this request",
  tasks: todos.map((todo, index) => ({
    id: `todo-${index}`,
    title: todo.text,
    status: todo.status,
  })),
});

export const mapAgentPlanToUiPlan = (
  plan: AgentPlan,
  summary?: string
): UiPlan => ({
  title: "Excel plan",
  description: summary,
  tasks: plan.steps.map((step) => ({
    id: step.id,
    title: step.description,
    meta: {
      kind: step.kind,
      targetWorksheet: step.targetWorksheet,
      targetRange: step.targetRange,
      parameters: step.parameters,
    },
  })),
});
