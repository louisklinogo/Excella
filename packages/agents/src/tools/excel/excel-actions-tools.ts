import { BasicPlanValidator } from "@excella/core/excel/basic-plan-validator";
import type { AgentMemoryRepository } from "@excella/core/excel/context-manager";
import type {
  AgentActionLogEntry,
  AgentErrorLogEntry,
  AgentMemory,
  ExcelContextSnapshot,
  RiskAssessment,
} from "@excella/core/excel/context-snapshot";
import { ContextUpdater } from "@excella/core/excel/context-updater";
import type { ActionExecutor, AgentPlan } from "@excella/core/excel/plan-types";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const agentActionLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  description: z.string(),
  targetRange: z.string().optional(),
  targetWorksheet: z.string().optional(),
  kind: z.string(),
  status: z.enum(["success", "failed", "partial"]),
});

const agentErrorLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  message: z.string(),
  operation: z.string().optional(),
  details: z.string().optional(),
});

const riskAssessmentSchema = z.object({
  level: z.enum(["low", "medium", "high"]),
  reasons: z.array(z.string()),
  estimatedCellsAffected: z.number().optional(),
  touchesFormulas: z.boolean().optional(),
  touchesTables: z.boolean().optional(),
  touchesNamedRanges: z.boolean().optional(),
});

const executionResultSchema = z.object({
  actions: z.array(agentActionLogEntrySchema),
  errors: z.array(agentErrorLogEntrySchema),
  summary: z.string(),
  updatedMemory: z.unknown(),
  risk: riskAssessmentSchema.optional(),
  estimatedCellsAffected: z.number().optional(),
});

export const executeExcelPlanTool = createTool({
  id: "excel_actions.execute_plan",
  description:
    "Execute an approved Excel agent plan. For now this is a non-destructive dry-run that records planned actions to memory.",
  inputSchema: z.object({
    plan: z.object({
      snapshotId: z.string(),
      steps: z
        .array(
          z.object({
            id: z.string(),
            kind: z.string(),
            description: z.string(),
            targetWorksheet: z.string(),
            targetRange: z.string(),
            parameters: z.record(z.string(), z.unknown()).optional(),
          })
        )
        .min(1),
    }),
    snapshot: z.custom<ExcelContextSnapshot>(),
    requireValidation: z
      .boolean()
      .default(true)
      .describe("If true, the plan must be valid before execution proceeds."),
  }),
  outputSchema: executionResultSchema,
  async execute({ context }) {
    const { plan, snapshot, requireValidation } = context as {
      plan: AgentPlan;
      snapshot: ExcelContextSnapshot;
      requireValidation: boolean;
    };

    let risk: RiskAssessment | undefined;

    if (requireValidation) {
      const validator = new BasicPlanValidator();
      const validation = validator.validate(plan, snapshot);

       risk = validation.risk;

      if (!validation.isValid) {
        const now = new Date().toISOString();
        const error: AgentErrorLogEntry = {
          id: `validation-${now}`,
          timestamp: now,
          message: `Plan validation failed: ${validation.issues.join("; ")}`,
          operation: undefined,
          details: JSON.stringify(validation),
        };

        return {
          actions: [],
          errors: [error],
          summary: "Plan validation failed; no actions were executed.",
          updatedMemory: snapshot.memory,
          risk,
          estimatedCellsAffected: validation.risk.estimatedCellsAffected,
        };
      }
    } else {
      risk = snapshot.safety.currentRisk ?? undefined;
    }

    const now = new Date().toISOString();
    const actions: AgentActionLogEntry[] = plan.steps.map((step, index) => ({
      id: `${step.id || `step-${index}`}-dry-run`,
      timestamp: now,
      description: step.description,
      targetRange: step.targetRange,
      targetWorksheet: step.targetWorksheet,
      kind: step.kind as AgentActionLogEntry["kind"],
      status: "success",
    }));

    const errors: AgentErrorLogEntry[] = [];

    const memoryRepository = context.memoryRepository as
      | AgentMemoryRepository
      | undefined;

    let updatedMemory: AgentMemory = snapshot.memory;

    if (memoryRepository) {
      const updater = new ContextUpdater(memoryRepository);

      // For the initial version, record only the first action as the executed
      // action in memory while retaining the prior history. This keeps the
      // implementation simple and avoids inflating memory with synthetic steps.
      const primaryAction = actions[0];

      updatedMemory = await updater.applyActionUpdate({
        previousSnapshot: snapshot,
        executedAction: primaryAction,
      });
    }

    const summary = `Dry-run execution recorded ${actions.length} planned action(s) for snapshot ${snapshot.meta.snapshotId}.`;

    return {
      actions,
      errors,
      summary,
      updatedMemory,
      risk,
      estimatedCellsAffected: risk?.estimatedCellsAffected,
    };
  },
});

export const applyExcelPlanTool = createTool({
  id: "excel_actions.apply_plan",
  description:
    "Execute an approved Excel agent plan against the live workbook. This performs real mutations and records actions/errors to memory.",
  inputSchema: z.object({
    plan: z.object({
      snapshotId: z.string(),
      steps: z
        .array(
          z.object({
            id: z.string(),
            kind: z.string(),
            description: z.string(),
            targetWorksheet: z.string(),
            targetRange: z.string(),
            parameters: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .min(1),
    }),
    snapshot: z.custom<ExcelContextSnapshot>(),
    requireValidation: z
      .boolean()
      .default(true)
      .describe("If true, the plan must be valid before execution proceeds."),
  }),
  outputSchema: executionResultSchema,
  async execute({ context }) {
    const { plan, snapshot, requireValidation } = context as {
      plan: AgentPlan;
      snapshot: ExcelContextSnapshot;
      requireValidation: boolean;
    };

    let risk: RiskAssessment | undefined;

    if (requireValidation) {
      const validator = new BasicPlanValidator();
      const validation = validator.validate(plan, snapshot);

      risk = validation.risk;

      if (!validation.isValid) {
        const now = new Date().toISOString();
        const error: AgentErrorLogEntry = {
          id: `validation-${now}`,
          timestamp: now,
          message: `Plan validation failed: ${validation.issues.join("; ")}`,
          operation: undefined,
          details: JSON.stringify(validation),
        };

        return {
          actions: [] as AgentActionLogEntry[],
          errors: [error],
          summary: "Plan validation failed; no actions were executed.",
          updatedMemory: snapshot.memory,
          risk,
          estimatedCellsAffected: validation.risk.estimatedCellsAffected,
        };
      }
    } else {
      risk = snapshot.safety.currentRisk ?? undefined;
    }

    const executor =
      (context.actionExecutor as ActionExecutor | undefined) ?? undefined;

    if (!executor) {
      const now = new Date().toISOString();
      const error: AgentErrorLogEntry = {
        id: `executor-missing-${now}`,
        timestamp: now,
        message:
          "No ActionExecutor available in context. Cannot apply plan to workbook.",
        operation: undefined,
      };

      return {
        actions: [] as AgentActionLogEntry[],
        errors: [error],
        summary:
          "Failed to execute plan because no ActionExecutor was provided.",
        updatedMemory: snapshot.memory,
        risk,
        estimatedCellsAffected: risk?.estimatedCellsAffected,
      };
    }

    let actions: AgentActionLogEntry[] = [];
    let errors: AgentErrorLogEntry[] = [];

    try {
      actions = await executor.execute(plan, snapshot);
    } catch (err) {
      const now = new Date().toISOString();
      const error: AgentErrorLogEntry = {
        id: `execution-error-${now}`,
        timestamp: now,
        message: err instanceof Error ? err.message : String(err),
        operation: undefined,
        details:
          err instanceof Error && err.stack ? err.stack : undefined,
      };

      errors = [error];
    }

    const memoryRepository = context.memoryRepository as
      | AgentMemoryRepository
      | undefined;

    let updatedMemory: AgentMemory = snapshot.memory;

    if (memoryRepository && actions.length > 0) {
      const updater = new ContextUpdater(memoryRepository);

      const primaryAction = actions[0];

      updatedMemory = await updater.applyActionUpdate({
        previousSnapshot: snapshot,
        executedAction: primaryAction,
        error: errors[0],
      });
    }

    const summary = errors.length
      ? `Applied plan with ${actions.length} action(s) and ${errors.length} error(s) for snapshot ${snapshot.meta.snapshotId}.`
      : `Successfully applied ${actions.length} action(s) for snapshot ${snapshot.meta.snapshotId}.`;

    return {
      actions,
      errors,
      summary,
      updatedMemory,
      risk,
      estimatedCellsAffected: risk?.estimatedCellsAffected,
    };
  },
});

