/**
 * NOTE: Legacy Human-in-the-Loop agent from the original fork.
 *
 * This agent is NOT wired into the current Excella app. It is kept as a
 * reference for designing future Excella agents that need:
 * - multi-step planning with todos
 * - explicit human approvals
 * - tool-heavy workflows (email, retrieval, workflow tools, etc.)
 *
 * Do not register or expose this agent in new APIs without a deliberate
 * design pass.
 */

import { createModel, type ModelFactoryOptions } from "@excella/core";
import type { ModelProvider } from "@excella/core/model-config";
import { Agent } from "@mastra/core/agent";

import { sendEmailTool } from "../tools/comm/email-tool";
import { proposeEmailTool } from "../tools/comm/propose-email-tool";
import { firecrawlTool } from "../tools/retrieval/firecrawl-tool";
import { askForPlanApprovalTool } from "../tools/workflow/ask-for-plan-approval-tool";
import { requestInputTool } from "../tools/workflow/request-input";
import { updateTodosTool } from "../tools/workflow/update-todos-tool";

const getAgentModelOptions = (): ModelFactoryOptions => {
  const provider =
    (process.env.HITL_AGENT_PROVIDER as ModelProvider | undefined) ??
    (process.env.MODEL_PROVIDER as ModelProvider | undefined);

  const modelId =
    process.env.HITL_AGENT_MODEL_ID ?? process.env.MODEL_ID ?? undefined;

  const options: ModelFactoryOptions = {};

  if (provider) {
    options.provider = provider;
  }

  if (modelId) {
    options.modelId = modelId;
  }

  return options;
};

export const humanInTheLoopAgent = new Agent({
  name: "Human-in-the-Loop Assistant",
  instructions: `
      You are an AI assistant that requires human approval before taking actions.

      MANDATORY WORKFLOW for EVERY request:
      1. Create a plan using updateTodosTool
      2. Request approval via ask-for-plan-approval
      3. Wait for explicit user approval
      4. Execute only approved tasks
      5. Update todos to show progress

      KEY RULES:
      - NEVER act without approval - even for simple tasks
      - If plan is rejected, revise and request approval again
      - If new tasks arise during execution, get re-approval
      - For emails/communications, use propose-email for additional approval before sending
      - Keep todos current to maintain transparency

      Your goal: Complete tasks effectively while ensuring the user maintains full control through explicit approval at each stage.
`,
  model: createModel(getAgentModelOptions()),
  tools: {
    updateTodosTool,
    askForPlanApprovalTool,
    requestInputTool,
    proposeEmailTool,
    sendEmailTool,
    firecrawlTool,
  },
});
