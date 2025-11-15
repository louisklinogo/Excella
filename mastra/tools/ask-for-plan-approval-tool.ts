import { z } from "zod";
import { createTool } from "@mastra/core/tools";

export const askForPlanApprovalTool = createTool({
  id: "ask-for-plan-approval",
  description:
    "Request user approval before executing planned actions. Presents pending tasks for review, allowing the user to approve, reject, or modify the plan. Returns the updated task list after user review, which may include modifications made by the user. Always use the returned task list as the authoritative version for execution.",
  inputSchema: z.object({
    explainer: z
      .string()
      .describe("One-line explanation of the plan."),
  }),
  outputSchema: z.object({
    todos: z.array(
      z.object({
        text: z.string(),
        status: z.enum(["new", "pending", "in-progress", "done"]),
      })
    ).describe("The updated task list after user review, which may include user modifications"),
  }),
});