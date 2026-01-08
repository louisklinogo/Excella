"use client";

import type { ToolUIPart } from "ai";
import { isToolUIPart as isAiToolUIPart } from "ai";

export type ExcelPlanToolOutput = {
  plan: {
    snapshotId: string;
    steps: Array<{
      id?: string;
      kind?: string;
      description?: string;
      targetWorksheet?: string;
      targetRange?: string;
    }>;
  };
  summary?: string;
};

export type ResearchPlanToolOutput = {
  question: string;
  steps: Array<{
    id?: string;
    kind?: string;
    description?: string;
    query?: string;
    notes?: string;
  }>;
  summary?: string;
};

export type PlanToolEntry =
  | { kind: "excel"; part: ToolUIPart; output: ExcelPlanToolOutput }
  | { kind: "research"; part: ToolUIPart; output: ResearchPlanToolOutput };

export const isToolUIPart = (part: unknown): part is ToolUIPart => {
  // Delegate to the AI SDK's own type guard so we correctly detect
  // tool UI parts coming from the streaming layer.
  return isAiToolUIPart(part as never);
};

export const getPlanFromToolPart = (
  toolPart: ToolUIPart
): PlanToolEntry | null => {
  const { output, type } = toolPart;

  if (!output || typeof output !== "object") {
    return null;
  }

  const outputObject = output as { [key: string]: unknown };
  const toolName = type.startsWith("tool-") ? type.slice("tool-".length) : type;

  // Primary case: tool returns { plan, summary } at the top level.
  let maybePlanOutput: { plan: unknown; summary?: string } | null = null;

  if (outputObject.plan && typeof outputObject.plan === "object") {
    maybePlanOutput = {
      plan: outputObject.plan,
      summary:
        typeof outputObject.summary === "string"
          ? (outputObject.summary as string)
          : undefined,
    };
  } else if (
    toolName === "research_planning.propose_plan" ||
    toolName === "excel_planning.propose_plan"
  ) {
    // Fallback: some integrations may return the plan object directly as output
    // (without wrapping it in a { plan } envelope). In that case, treat the
    // whole output as the plan and look for question/snapshotId + steps.
    maybePlanOutput = {
      plan: outputObject,
      summary:
        typeof outputObject.summary === "string"
          ? (outputObject.summary as string)
          : undefined,
    };
  }

  if (!maybePlanOutput || typeof maybePlanOutput.plan !== "object") {
    return null;
  }

  const plan = maybePlanOutput.plan as {
    snapshotId?: unknown;
    question?: unknown;
    steps?: unknown;
  };

  if (typeof plan.snapshotId === "string" && Array.isArray(plan.steps)) {
    return {
      kind: "excel",
      part: toolPart,
      output: maybePlanOutput as ExcelPlanToolOutput,
    };
  }

  if (typeof plan.question === "string" && Array.isArray(plan.steps)) {
    const researchOutput: ResearchPlanToolOutput = {
      question: plan.question,
      steps: plan.steps as ResearchPlanToolOutput["steps"],
      summary: maybePlanOutput.summary,
    };

    return {
      kind: "research",
      part: toolPart,
      output: researchOutput,
    };
  }

  return null;
};
