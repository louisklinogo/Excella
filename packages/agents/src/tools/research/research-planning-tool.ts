import { createModel } from "@excella/core";
import { createTool } from "@mastra/core/tools";
import { generateObject, Output } from "ai";
import { z } from "zod";

const researchPlanStepSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  description: z.string().min(1),
  query: z.string().optional(),
  notes: z.string().optional(),
});

const researchPlanSchema = z.object({
  question: z.string().min(1),
  steps: z.array(researchPlanStepSchema).min(1),
});

type ResearchPlan = z.infer<typeof researchPlanSchema>;

export const proposeResearchPlanTool = createTool({
  id: "research_planning.propose_plan",
  description:
    "Given a user's research question, propose a concise set of concrete research steps that can later be executed using the research tools.",
  inputSchema: z.object({
    question: z
      .string()
      .min(1)
      .describe("The user's research question or goal in natural language."),
    maxSteps: z
      .number()
      .int()
      .positive()
      .default(6)
      .describe("Maximum number of steps to include in the research plan."),
  }),
  outputSchema: z.object({
    plan: researchPlanSchema,
    summary: z.string(),
  }),
  async execute({ context }) {
    const { question, maxSteps } = context as {
      question: string;
      maxSteps: number;
    };

    const model = createModel();

    const { object } = await generateObject({
      model,
      experimental_output: Output.object({ schema: researchPlanSchema }),
      system:
        "You are an expert research planner. Given a user's research question, " +
        "produce a short, efficient plan of research steps that another agent can execute using web and academic search tools.\n" +
        "Each step should be specific enough to run as a single action and should avoid redundancy.\n" +
        "Use the 'kind' field to indicate which tool family is most appropriate: 'web_search', 'academic_search', 'retrieve_url', 'extreme_search', or 'synthesis'.\n" +
        "Use the 'query' field for steps that will call a search tool, and 'notes' for any constraints, examples, or follow-up checks.",
      prompt: [
        "User research question:",
        question,
        "\nConstraints:",
        `- Maximum steps: ${maxSteps}`,
        "- Prefer 3–7 focused steps instead of many tiny ones.",
        "- Group related work into a single step when it uses the same tool and query.",
        "\nReturn only the JSON object for the research plan, no additional text.",
      ].join("\n"),
    });

    const plan = object as ResearchPlan;

    const stepCount = Array.isArray(plan.steps) ? plan.steps.length : 0;
    const summary = `Research plan with ${stepCount} step(s) for question: "${plan.question}".`;

    return {
      plan,
      summary,
    };
  },
});
