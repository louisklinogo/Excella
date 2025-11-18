import { createModel } from "@excella/core";
import { BasicPlanValidator } from "@excella/core/excel/basic-plan-validator";
import type { ExcelContextSnapshot } from "@excella/core/excel/context-snapshot";
import type {
  AgentPlan,
  PlanValidationResult,
} from "@excella/core/excel/plan-types";
import { createTool } from "@mastra/core/tools";
import { generateObject, Output } from "ai";
import { z } from "zod";

const agentPlanStepSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  description: z.string().min(1),
  targetWorksheet: z.string().min(1),
  targetRange: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

const agentPlanSchema = z.object({
  snapshotId: z.string().min(1),
  steps: z.array(agentPlanStepSchema).min(1),
});

export const proposeExcelPlanTool = createTool({
  id: "excel_planning.propose_plan",
  description:
    "Given a user goal and an Excel context snapshot, propose a structured plan of steps to apply to the workbook.",
  inputSchema: z.object({
    goal: z.string().min(1).describe("The user's goal in natural language."),
    snapshot: z
      .custom<ExcelContextSnapshot>()
      .describe("The ExcelContextSnapshot the plan should be based on."),
    maxSteps: z
      .number()
      .int()
      .positive()
      .default(10)
      .describe("Maximum number of steps to include in the plan."),
  }),
  outputSchema: z.object({
    plan: agentPlanSchema,
    summary: z.string(),
  }),
  async execute({ context }) {
    const { goal, snapshot, maxSteps } = context as {
      goal: string;
      snapshot: ExcelContextSnapshot;
      maxSteps: number;
    };

    const model = createModel();

    const { object } = await generateObject({
      model,
      experimental_output: Output.object({ schema: agentPlanSchema }),
      system:
        "You are an expert Excel assistant. Given a user goal and a structured description of a workbook, " +
        "produce a safe, step-by-step plan of operations that can later be executed by another tool. \n" +
        "Each step should reference worksheet names and ranges that exist in the snapshot.",
      prompt: [
        "User goal:",
        goal,
        "\nExcel context snapshot (JSON):",
        JSON.stringify(snapshot),
        "\nConstraints:",
        `- Maximum steps: ${maxSteps}`,
        "\nReturn only the JSON object for the plan, no additional text.",
      ].join("\n"),
    });

    const plan = object as AgentPlan;

    const summary = `Plan with ${plan.steps.length} step(s) for snapshot ${plan.snapshotId}.`;

    return {
      plan,
      summary,
    };
  },
});

export const validateExcelPlanTool = createTool({
  id: "excel_planning.validate_plan",
  description:
    "Validate an Excel agent plan against the current workbook snapshot and safety configuration.",
  inputSchema: z.object({
    plan: agentPlanSchema,
    snapshot: z
      .custom<ExcelContextSnapshot>()
      .describe(
        "The current ExcelContextSnapshot to validate the plan against."
      ),
  }),
  outputSchema: z.custom<PlanValidationResult>(),
  execute({ context }) {
    const { plan, snapshot } = context as {
      plan: AgentPlan;
      snapshot: ExcelContextSnapshot;
    };

    const validator = new BasicPlanValidator();
    const result = validator.validate(plan, snapshot);

    return result;
  },
});
