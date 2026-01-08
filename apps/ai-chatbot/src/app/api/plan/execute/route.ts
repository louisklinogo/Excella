import type { ExcelContextSnapshot } from "@excella/core/excel/context-snapshot";
import { executeExcelPlanTool } from "@excella/agents/tools/excel/excel-actions-tools";
import { mastra } from "@excella/mastra";

export const maxDuration = 30;

type ExcelPlanStep = {
  id?: string;
  kind?: string;
  description?: string;
  targetWorksheet?: string;
  targetRange?: string;
  parameters?: Record<string, unknown>;
};

type ExcelPlan = {
  snapshotId: string;
  steps: ExcelPlanStep[];
};

type ExcelPlanExecuteRequest = {
  kind: "excel";
  mode?: "dry-run" | "apply";
  plan: ExcelPlan;
  snapshot: ExcelContextSnapshot;
  requireValidation?: boolean;
};

type ResearchPlanStep = {
  id?: string;
  kind?: string;
  description?: string;
  query?: string;
  notes?: string;
};

type ResearchPlan = {
  question: string;
  steps: ResearchPlanStep[];
};

type ResearchPlanExecuteRequest = {
  kind: "research";
  plan: ResearchPlan;
};

type ExecutePlanRequest = ExcelPlanExecuteRequest | ResearchPlanExecuteRequest;

const createErrorResponse = (status: number, message: string): Response =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const handleExcelPlan = async (
  body: ExcelPlanExecuteRequest
): Promise<Response> => {
  const { plan, snapshot } = body;

  if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
    return createErrorResponse(400, "Invalid Excel plan payload.");
  }

  try {
    const tool = executeExcelPlanTool as unknown as {
      execute: (args: { context: unknown }) => Promise<unknown>;
    };

    const result = await tool.execute({
      context: {
        plan,
        snapshot,
        requireValidation: body.requireValidation ?? true,
      },
    });

    return new Response(
      JSON.stringify({
        kind: "excel",
        mode: (body.mode ?? "dry-run") as "dry-run" | "apply",
        result,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to execute Excel plan.";
    return createErrorResponse(500, message);
  }
};

const buildResearchExecutionPrompt = (plan: ResearchPlan): string => {
  const lines: string[] = [];
  lines.push("Execute the following research plan and synthesize the findings.");
  lines.push("");
  lines.push(`Question: ${plan.question}`);
  lines.push("");
  lines.push("Plan steps:");

  for (const [index, step] of plan.steps.entries()) {
    const parts: string[] = [];
    parts.push(step.description || "Research step");
    if (step.kind) {
      parts.push(`kind=${step.kind}`);
    }
    if (step.query) {
      parts.push(`query=${step.query}`);
    }
    if (step.notes) {
      parts.push(`notes=${step.notes}`);
    }

    lines.push(`${index + 1}. ${parts.join(" | ")}`);
  }

  lines.push("");
  lines.push(
    "Follow the steps in order, use appropriate research tools, and then provide a concise answer followed by a short bullet list of key findings."
  );

  return lines.join("\n");
};

const handleResearchPlan = async (
  body: ResearchPlanExecuteRequest
): Promise<Response> => {
  const { plan } = body;

  if (!plan || !plan.question || !Array.isArray(plan.steps)) {
    return createErrorResponse(400, "Invalid research plan payload.");
  }

  try {
    const agent = mastra.getAgent("researchAgent");
    const prompt = buildResearchExecutionPrompt(plan);
    const result = await agent.generate(prompt);

    return new Response(
      JSON.stringify({
        kind: "research",
        result: {
          answer: result.text,
          stepsRun: plan.steps.length,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to execute research plan.";
    return createErrorResponse(500, message);
  }
};

export async function POST(request: Request): Promise<Response> {
  let body: ExecutePlanRequest;

  try {
    body = (await request.json()) as ExecutePlanRequest;
  } catch {
    return createErrorResponse(400, "Invalid JSON body.");
  }

  if (body.kind === "excel") {
    return handleExcelPlan(body);
  }

  if (body.kind === "research") {
    return handleResearchPlan(body);
  }

  return createErrorResponse(400, "Unsupported plan kind.");
}
