## Excella Agent & Tools Audit

_Based on Anthropic + Mastra docs and the current Excella codebase_

This document summarizes what Excella’s agents and tools are doing well, where they diverge from Anthropic and Mastra guidance, and what’s still missing. It’s meant as an internal design reference when you evolve the agent system.

---

## 1. What We’re Doing Well

### 1.1 Strong Excel agent backbone

You already have a solid Excel "brain" structure, implemented via Mastra tools under `packages/agents/src/tools/excel`:

- **Context tools** (`excel-context-tools.ts`)
  - `excel_context.get_snapshot` — returns an `ExcelContextSnapshot` with workbook structure, selection, data preview, and safety context.
  - `excel_context.get_selection_preview` — returns a focused `DataPreview` for the current selection (or a target), with limits on rows/columns and optional formulas.

- **Planning tools** (`excel-planning-tools.ts`)
  - `excel_planning.propose_plan` — uses an LLM (`generateObject` + `createModel`) to build a structured `AgentPlan` based on a snapshot and a user goal.
  - `excel_planning.validate_plan` — validates an `AgentPlan` against a snapshot using `BasicPlanValidator`, returning a `PlanValidationResult`.

- **Execution tool (dry-run)** (`excel-actions-tools.ts`)
  - `excel_actions.execute_plan` — performs a **non-destructive dry-run**: validates (optionally), creates `AgentActionLogEntry` records, and updates `AgentMemory` via `ContextUpdater`, but does not modify the workbook.

This gives you a clean pipeline:

> observe workbook → plan → validate → dry-run execute → update memory

**Why this matches the docs**

- Anthropic’s tools and agents guidance recommends using tools as **deterministic operators** and agents as planners/deciders. Your Excel tools follow this pattern.
- The context engineering doc says to treat context as **finite and expensive**, and to fetch only what’s needed. Your snapshot/preview tools already do that.
- The "effective tools" doc recommends **a few high-impact tools** rather than one wrapper per low-level action. Your Excel tool set is small, focused, and maps to real workflows instead of individual cell operations.

### 1.2 Good human-in-the-loop (HITL) pattern (legacy agent)

The legacy `humanInTheLoopAgent` (`packages/agents/src/agents/human-in-the-loop-agent.ts`) is marked as reference-only, but it showcases an excellent HITL design:

- **Workflow tools** (`packages/agents/src/tools/workflow`)
  - `updateTodosTool` — manages a conversation-local todo list based on previous tool results.
  - `askForPlanApprovalTool` — displays a plan/todos to the user and returns an updated todo list after review.
  - `requestInputTool` — asks the user for specific missing information (label + placeholder).

- **Communication tools** (`packages/agents/src/tools/comm`)
  - `proposeEmailTool` — drafts an email (to/subject/body) and returns an `emailHandle`.
  - `sendEmailTool` — finds a previously proposed email by handle in the message history, and sends via Resend (`RESEND_API_KEY`), with safe HTML escaping.

- **Retrieval tool** (`packages/agents/src/tools/retrieval`)
  - `firecrawlTool` — crawls a website using Firecrawl or a proxy worker and returns markdown content.

The agent’s instructions enforce a clear process:

1. Use `updateTodosTool` to create a plan.
2. Use `ask-for-plan-approval` to get explicit approval.
3. Only then proceed with execution.
4. For emails, always go through `propose-email` before `send-email`.
5. Keep todos updated to reflect progress.

**Why this matches the docs**

- Anthropic emphasizes keeping humans in control of agents and using tools as guardrails. This agent does that with todos, approvals, and dry-run behavior.
- It closely mirrors Mastra’s guardrails + memory + tool patterns, even if it isn’t wired into production.

### 1.3 Clean, well-typed tools

Across Excel, workflow, comms, and retrieval tools:

- All tools use **Zod** schemas for `inputSchema` and `outputSchema`.
- IDs and descriptions are clear and namespaced (e.g. `excel_planning.propose_plan`, `excel_context.get_snapshot`, `update-todos`, `send-email`).
- Tools return compact, high-signal outputs rather than huge blobs.
- Environmental configuration is explicit (`FIRECRAWL_API_KEY`, `TSAI_API_KEY`, `RESEND_API_KEY`), with descriptive errors when missing.

This aligns with Anthropic’s "effective tools" guidance: tools should be easy for agents to understand, token-efficient, and focused on their primary use case.

### 1.4 Simple, testable `chatAgent`

The main `chatAgent` (`packages/agents/src/agents/chat-agent.ts`) is intentionally minimal:

- Clear instructions to be concise and helpful.
- No tools configured yet (`tools: {}`) while you validate streaming + UI.

This matches Anthropic’s advice to:

- Start with **simple agents/workflows**.
- Only add complexity (tools, multi-step loops) when it’s clearly beneficial.

### 1.5 Good separation of concerns

- Tools are grouped by domain: `excel/`, `workflow/`, `comm/`, `retrieval/`.
- UI mapping for tool calls is centralized in `apps/ai-chatbot/src/lib/agent-ui-mappers/tool-mapper.ts` via `mapToolCallToToolUIPart`.

This makes it easier to evolve individual pieces without tangling behavior, tools, UI, and core agent logic.

---

## 2. Where We’re Not Doing Well (Gaps vs. Docs)

### 2.1 The production `chatAgent` does not use any tools

Right now, the only agent wired into the AI chatbot app (`chatAgent`) has `tools: {}`. This means:

- It cannot access Excel snapshots, planning, validation, or execution.
- It cannot use todos, approvals, or structured input requests.
- It cannot crawl websites or send emails.

In other words, the **live agent behaves like a plain LLM chat** rather than what Anthropic and Mastra call an "agent" (LLM + tools operating in a loop).

**Why this is a problem**

- Anthropic’s definition of agents assumes structured tool usage and environment interaction. Your system currently doesn’t expose your best tools to the main user-facing agent.
- Mastra’s docs assume agents will use tools, memory, guardrails, and possibly networks; `chatAgent` currently does none of that.

### 2.2 Excel execution stops at dry-run only

`excel_actions.execute_plan` is explicitly a **non-destructive dry-run**:

- It validates a plan (optionally).
- It records synthetic `AgentActionLogEntry` items.
- It updates agent memory using `ContextUpdater`.
- It does not actually modify the workbook.

This is excellent for safety and logging, but insufficient for Excella’s product promise of "doing the work inside your spreadsheets".

**Why this falls short of the docs**

- Anthropic’s agent guidance expects tools to actually **act on the environment**, not just simulate.
- You have all the plumbing to plan, validate, and dry-run; the final step (mutating the workbook) is still missing.

### 2.3 No orchestrated Excel workflow

You have the building blocks:

- Get context snapshot.
- Propose plan.
- Validate plan.
- Dry-run execute plan.
- Request approval.
- Update todos.
- Request additional input.

But there is **no single agent or tool** that orchestrates these steps in a robust, reusable flow (for example: "clean selection and apply changes" or "fix formulas in this range"). Instead, orchestration is currently left to the agent’s internal reasoning.

**Why this matters**

- Anthropic’s patterns (orchestrator-workers, evaluator-optimizer, etc.) suggest explicit orchestration for complex tasks.
- Mastra provides workflows and agent networks designed for exactly this type of multi-step coordination.

### 2.4 The best HITL pattern is stuck in a legacy agent

Your safest and most transparent pattern (todos, approvals, propose/send email, retrieval) is:

- Implemented only in `humanInTheLoopAgent`.
- Explicitly marked as "legacy" and not wired into current APIs.

This means the live `chatAgent` currently:

- Has no visible todos or progress tracking.
- Does not require approval before executing multi-step or potentially destructive plans.
- Does not use structured input requests when it lacks information.

**Why this is risky**

- Anthropic recommends human-in-the-loop and approval checkpoints, especially for higher-risk actions.
- Mastra’s guardrail patterns are not yet applied to your main user-facing flow, even though you already implemented them in a reference agent.

### 2.5 No guardrails or memory on the main agent

From the Mastra docs, `chatAgent` is not yet using:

- **Input processors** (guardrails):
  - `UnicodeNormalizer` for cleaning text.
  - `PromptInjectionDetector` for prompt injection prevention.
  - `LanguageDetector` for language detection/translation.
  - `PIIDetector` for PII detection.
  - `ModerationProcessor` for content moderation.

- **Output processors**:
  - `TokenLimiterProcessor` to limit token usage.
  - `SystemPromptScrubber` to prevent leaking internal instructions.
  - Output-side `ModerationProcessor` and `PIIDetector`.

- **Mastra Memory**:
  - No `Memory` configured with `resource` and `thread` identifiers.
  - No working memory or semantic recall per user/session.

Given that Excel work often involves sensitive data (emails, phone numbers, salaries, etc.), this leaves important safety and privacy gaps.

### 2.6 No agent networks or routing

Mastra supports agent networks using `.network()` with a routing agent that delegates to sub-agents, workflows, and tools. In your current setup:

- There is no routing agent that chooses between general chat, Excel operations, or communication tasks.
- There are no agent networks coordinating specialized agents (e.g., data cleaning, modeling, reporting).

This means all behavior must be squeezed into a single `chatAgent`, limiting flexibility and potentially making prompts more complex than necessary.

---

## 3. What’s Yet To Do (Opportunities / Roadmap)

### 3.1 Introduce an Excel-focused agent that actually uses tools

Create a dedicated `excelAgent` (or evolve `chatAgent`) that wires in your existing tools:

- Core Excel tools:
  - `excel_context.get_snapshot`
  - `excel_context.get_selection_preview`
  - `excel_planning.propose_plan`
  - `excel_planning.validate_plan`
  - `excel_actions.execute_plan` (dry-run)

- Workflow / HITL tools:
  - `updateTodosTool`
  - `askForPlanApprovalTool`
  - `requestInputTool`

- Possibly comms/retrieval when relevant in Excel flows:
  - `proposeEmailTool` + `sendEmailTool`
  - `firecrawlTool`

Recommended instruction pattern for this agent:

- Always fetch a snapshot before planning.
- Always validate plans before execution.
- Always request approval via `ask-for-plan-approval` for plans that could modify the workbook.
- Keep todos updated using `update-todos` throughout the interaction.

### 3.2 Add a real "apply plan" Excel tool

Keep `excel_actions.execute_plan` as a **dry-run simulation** for safety and logging, but add a new tool, for example:

- `excel_actions.apply_plan` or `excel_actions.execute_plan_live`

Responsibility of this new tool:

- Accept a validated `AgentPlan` and an `ExcelContextSnapshot`.
- Use the underlying Excel gateway / `ContextManager` to actually apply changes to the workbook (edit ranges, add formulas, insert columns/sheets, etc.).
- Record real `AgentActionLogEntry` entries and update `AgentMemory` with actual history.

This is the missing step that turns Excella from a planner/simulator into an agent that truly automates spreadsheet workflows.

### 3.3 Build a simple agent network / router

Using Mastra’s agent networks, define a `routingAgent` that:

- Routes simple conversational questions to a lightweight `chatAgent`.
- Routes Excel-related operations to `excelAgent`.
- Routes communication tasks (e.g., drafting/sending emails) to a dedicated `emailAgent` if you choose to define one.

Later, you can introduce specialized sub-agents for:

- Data cleaning.
- Formula debugging.
- Analysis/modeling.
- Reporting and explanation.

The routing agent would rely on clear `description` fields and schemas on each primitive to pick the right tool/agent/workflow.

### 3.4 Wire guardrails and memory into the live agent(s)

From Mastra’s guardrails and memory docs, add:

- **Input processors** on your main agents:
  - `UnicodeNormalizer` — normalize user input.
  - `PromptInjectionDetector` — detect and rewrite/block prompt injection.
  - `PIIDetector` — detect and redact or block PII.
  - `ModerationProcessor` — block or filter harmful content.

- **Output processors**:
  - `TokenLimiterProcessor` — cap token usage and cost per response.
  - `SystemPromptScrubber` — stop system prompts or internal instructions leaking.
  - Output-side moderation/PII detection.

- **Memory**:
  - Configure `Memory` with `LibSQLStore` and use `resource`+`thread` for per-user, per-conversation history.
  - Optionally configure working memory vs. longer-term semantic recall.

This brings your actual runtime behavior in line with the guardrail patterns described in the docs.

### 3.5 Add domain-specific Excel tools

Right now, your Excel tools are primarily **meta** (context, planning, validation, execution). To align more closely with the docs and Excella’s product goals, consider adding domain-specific tools for common analyst workflows, for example:

1. **Data quality and cleaning**
   - `excel_data.detect_issues` — scan selection for missing values, inconsistent types, duplicates, and outliers.
   - `excel_data.suggest_cleaning_plan` — propose a cleaning `AgentPlan` tailored to detected issues.

2. **Formula help**
   - `excel_formula.explain` — explain what a complex formula does in plain language.
   - `excel_formula.debug` — analyze a failing formula and suggest fixes, possibly as plan steps.

3. **Analysis and modeling**
   - `excel_analysis.summary_stats` — compute descriptive statistics and return them in a structured way (and/or as plan steps to write back into the sheet).
   - `excel_analysis.forecast` or `excel_analysis.regression` — run simple models and express the results as steps to update ranges.

These are high-impact tools that match real analysts' pain points and fit Anthropic’s guidance on choosing the right tools for agents.

### 3.6 Add evaluation and observability around agent/tool behavior

To follow Anthropic’s evaluation advice:

- Create small, realistic eval sets covering:
  - Data cleaning.
  - Formula repair.
  - Modeling/forecasting.
  - Reporting/explanation.

- Log and analyze:
  - Which tools are called and in what order.
  - Token usage per tool and per interaction.
  - Plan validation success/failure rates.
  - Frequency and outcomes of `ask-for-plan-approval` calls.

- Use LLM-as-judge plus some human review to score:
  - Factual correctness.
  - Safety and privacy (e.g., PII handling).
  - Spreadsheet correctness (e.g., formulas, ranges).

This creates a feedback loop where you can iteratively refine tools, prompts, and workflows based on real data.

---

## 4. Kid-Friendly Summary

If we explain this to a smart 10-year-old:

- **What we’re already good at**
  - We built a smart Excel brain that can look at a spreadsheet, make a plan, check if the plan is safe, and pretend to run it.
  - We also built a careful "ask the human first" robot that makes a todo list, gets permission, and only then does things.

- **What we’re not good at yet**
  - The main robot that users talk to isn’t using any of those tools. It’s like we gave it a huge toolbox and then told it to keep its hands in its pockets.
  - Our Excel robot only pretends to change the spreadsheet; it never actually fixes anything.
  - We aren’t using safety checks (like catching bad instructions or private info) in the main robot.

- **What we should build next**
  - A real Excel robot that actually uses the tools: looks at the sheet, plans, asks permission, and then edits the sheet for real.
  - A traffic-cop robot that chooses which helper to use: chat, Excel, or email.
  - More safety belts: robots that catch dangerous or private stuff before anything bad happens.
  - Special tools for the most annoying jobs in Excel: cleaning messy data, fixing broken formulas, and doing quick statistics.

This document should be the reference when you decide how to evolve Excella’s agents and tools so they match what the Anthropic and Mastra docs describe.
