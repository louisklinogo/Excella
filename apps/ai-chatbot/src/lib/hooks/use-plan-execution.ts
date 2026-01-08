"use client";

import { useState } from "react";
import type { ToolUIPart } from "ai";

import { tryGetExcelContextSnapshot } from "@/lib/excel/context-environment";
import type { PlanToolEntry } from "./plan-types";

export type LocalPlanTools = Record<string, ToolUIPart[]>;

export type UsePlanExecutionResult = {
  executingPlanMessageId: string | null;
  localPlanTools: LocalPlanTools;
  executePlan: (entry: PlanToolEntry, messageId: string) => Promise<void>;
};

export const usePlanExecution = (): UsePlanExecutionResult => {
  const [executingPlanMessageId, setExecutingPlanMessageId] =
    useState<string | null>(null);
  const [localPlanTools, setLocalPlanTools] = useState<LocalPlanTools>({});

  const executePlan = async (
    entry: PlanToolEntry,
    messageId: string
  ): Promise<void> => {
    if (executingPlanMessageId) {
      return;
    }

    try {
      setExecutingPlanMessageId(messageId);

      if (entry.kind === "excel") {
        const snapshot = await tryGetExcelContextSnapshot({
          includeFormulaSamples: false,
          includeDependencySummaries: false,
        });

        if (!snapshot) {
          throw new Error("Unable to get Excel context snapshot.");
        }

        const body = {
          kind: "excel" as const,
          mode: "dry-run" as const,
          plan: entry.output.plan,
          snapshot,
          requireValidation: true,
        };

        const response = await fetch("/api/plan/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const data = (await response.json()) as {
          kind?: string;
          mode?: string;
          result?: unknown;
          error?: string;
        };

        const errorText = !response.ok
          ? data.error ?? `HTTP ${response.status}`
          : undefined;

        const toolPart: ToolUIPart = {
          type: "tool-excel_actions.execute_plan",
          state: errorText ? "output-error" : "output-available",
          input: body,
          output: data.result,
          errorText,
        };

        setLocalPlanTools((previous) => ({
          ...previous,
          [messageId]: [...(previous[messageId] ?? []), toolPart],
        }));
      } else {
        const body = {
          kind: "research" as const,
          plan: {
            question: entry.output.question,
            steps: entry.output.steps,
          },
        };

        const response = await fetch("/api/plan/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const data = (await response.json()) as {
          kind?: string;
          result?: unknown;
          error?: string;
        };

        const errorText = !response.ok
          ? data.error ?? `HTTP ${response.status}`
          : undefined;

        const toolPart: ToolUIPart = {
          type: "tool-research_plan.execute",
          state: errorText ? "output-error" : "output-available",
          input: body,
          output: data.result,
          errorText,
        };

        setLocalPlanTools((previous) => ({
          ...previous,
          [messageId]: [...(previous[messageId] ?? []), toolPart],
        }));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to execute plan.";

      const toolType =
        entry.kind === "excel"
          ? "tool-excel_actions.execute_plan"
          : "tool-research_plan.execute";

      const fallback: ToolUIPart = {
        type: toolType,
        state: "output-error",
        input:
          entry.kind === "excel"
            ? { plan: entry.output.plan }
            : { plan: entry.output },
        output: undefined,
        errorText: message,
      };

      setLocalPlanTools((previous) => ({
        ...previous,
        [messageId]: [...(previous[messageId] ?? []), fallback],
      }));
    } finally {
      setExecutingPlanMessageId(null);
    }
  };

  return {
    executingPlanMessageId,
    localPlanTools,
    executePlan,
  };
};
