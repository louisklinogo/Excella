## Excella Agent Plan

This document outlines the agents Excella should use, how they relate to the existing Excel tooling catalog, and how they work together. It builds on `docs/design/excel-agent-tools.md` and the Anthropic + Mastra guidance.

---

## 1. Overview: Three Layers of Agents

Excella’s agent system should be organized into three layers rather than a single monolithic agent:

1. **Top-level routing agent**
   - Decides which specialist to use (chat vs Excel vs Python vs research vs comms).
   - Uses Mastra’s agent network pattern (`routingAgent.network()`).

2. **Core specialist agents**
   - `excelAgent` – main Excel brain (context, planning, execution, analysis, cleaning).
   - `pythonAgent` – runs Python on selections / workbooks.
   - `researchAgent` – web + documentation retrieval supporting analyses.
   - `commAgent` – drafts/sends emails and handles approvals.
   - (Optional later) `financialModelingAgent` – focused on modeling, valuation, and finance-specific flows.

3. **Internal micro-specialists (optional v2)**
   - Used inside `excelAgent` for focused tasks:
     - `dataCleaningAgent`
     - `formulaExplainerAgent`
     - `summaryAgent`

For an initial version, the main priority is a strong **`excelAgent`** plus a **routing agent**.

---

## 2. Top-Level Routing Agent (`routingAgent`)

### Purpose

The routing agent is the front door for Excella. Given any user message, it decides whether to:

- Use **`excelAgent`** for Excel data, transformations, or formulas.
- Use **`pythonAgent`** for Python-based analysis on selections.
- Use **`researchAgent`** for web/doc research and data import from URLs.
- Use **`commAgent`** for email/reporting flows.
- Or answer directly for simple chat.

### Configuration (conceptual)

- `name`: `"excella-routing-agent"`
- `instructions` (concept):
  - You are a router for Excella.
  - You do not perform heavy work directly.
  - Decide whether the user is asking to:
    - inspect or transform spreadsheet data,
    - run Python on data,
    - research something on the web,
    - communicate results,
    - or simply chat.
  - Delegate to the appropriate agent or tool.
- `agents`:
  - `excelAgent`
  - `pythonAgent`
  - `researchAgent`
  - `commAgent`
- `tools`:
  - None or minimal; if needed, only very simple tools that truly belong at the top level.
- `memory`:
  - Mastra `Memory` so the routing agent can remember high-level project context.

---

## 3. Core Agent: `excelAgent`

The `excelAgent` is the main spreadsheet-focused agent, owning most tools from `excel-agent-tools.md`.

### 3.1 Responsibilities

- Inspect workbook state (context and selection).
- Understand and describe ranges, tables, and formulas.
- Propose structured plans (`AgentPlan`) for:
  - cleaning data,
  - transforming layouts,
  - creating summary sheets,
  - adjusting formulas.
- Validate and explain plans for human review.
- Run a human-in-the-loop flow (todos + approvals).
- Execute plans (dry-run first, then real apply) and log actions/errors.
- Maintain notes and working profile for the workbook.

### 3.2 Tools

**Context & planning**

From the catalog:

- `excel_context.get_snapshot`
- `excel_context.get_selection_preview`
- `excel_planning.propose_plan`
- `excel_planning.validate_plan`
- `excel_planning.explain_plan`

**Execution & safety**

- `excel_actions.execute_plan`
- `excel_actions.preview_plan_effects`
- **New**: `excel_actions.apply_plan` (real, mutating execution on the workbook).
- Optional: `excel_actions.rollback_last_actions`.

**Analysis & transformation**

- `excel_analysis.describe_selection`
- `excel_analysis.explain_formula`
- `excel_transform.clean_table`
- `excel_transform.create_summary_sheet`
- `excel_transform.apply_standard_layout`

**Memory & notes**

- `excel_memory.log_note`
- `excel_memory.list_notes`
- `excel_memory.search_conversation_memory`
- `excel_memory.update_working_profile`

**Workflow / HITL**

- `workflow.updateTodosTool`
- `workflow.askForPlanApprovalTool`
- `workflow.requestInputTool`

### 3.3 Behavior Pattern

For any Excel-related request (e.g. "clean this table", "create a summary", "fix this formula"), `excelAgent` should follow a consistent workflow:

1. **Observe**
   - Call `excel_context.get_snapshot` (and optionally `excel_context.get_selection_preview`).
   - Optionally call `excel_analysis.describe_selection` for a quick read of the data.

2. **Plan**
   - For generic transformations: call `excel_planning.propose_plan` with the goal and snapshot.
   - For specific tasks, use high-level transform tools (e.g. `excel_transform.clean_table`) which themselves produce an `AgentPlan`.

3. **Validate & explain**
   - Call `excel_planning.validate_plan`.
   - If invalid, report issues and either adjust or ask the user for clarification.
   - Call `excel_planning.explain_plan` to generate a user-friendly explanation.

4. **HITL: todos & approval**
   - Use `workflow.updateTodosTool` to reflect the plan as todos.
   - Use `workflow.askForPlanApprovalTool` to present the plan and ask for approval.
   - If the user modifies or rejects the plan, adjust and repeat.

5. **Preview effects**
   - Call `excel_actions.preview_plan_effects` to estimate scope and risk (cells affected, tables touched, etc.).

6. **Dry-run execution**
   - Call `excel_actions.execute_plan` with `dryRun: true` (or equivalent), logging synthetic actions and errors.
   - Show the dry-run summary to the user if appropriate.

7. **Apply plan**
   - If approved and dry-run looks safe, call `excel_actions.apply_plan` to perform real changes on the workbook.
   - Log real `AgentActionLogEntry` records and update `AgentMemory` via `ContextUpdater`.

8. **Notes & profile**
   - For important decisions, call `excel_memory.log_note` and/or update the user’s working profile.

This sequence should be encoded into `excelAgent`’s instructions as a **mandatory workflow**, not just a suggestion.

---

## 4. Core Agent: `pythonAgent`

### Purpose

Handle Python-based analysis and modeling over Excel data.

### Tools

From the catalog:

- `compute.run_python`
- `compute.run_python_on_selection`
- Optional: `compute.code_context_search` for library/context help.

### Behavior

- When the user wants Python on Excel data (e.g. "run a regression on this selection"):
  1. `excel_context.get_selection_preview` to fetch data.
  2. Call `compute.run_python_on_selection` with the selection data and user code (or code synthesized by the agent).
  3. Return results as a table and/or chart metadata.
  4. If results should be written back to Excel:
     - Either generate an `AgentPlan` for `excelAgent` to execute, or call `excel_transform.*` tools that do so.

---

## 5. Core Agent: `researchAgent`

### Purpose

Perform web/doc research to support Excel analyses, and help import table-like data from the web.

### Tools

- `web.retrieve_url`
- `web.search_web`
- `web.search_academic`
- `web.import_table_to_excel_plan`
- Existing `firecrawlTool` (embedded in `web.retrieve_url` or used directly).

### Behavior

- For "look this up" or "pull this table from URL" requests:
  1. Use `web.search_*` or `web.retrieve_url` to retrieve relevant content.
  2. Summarize data or provide background context.
  3. If the user wants the table in Excel:
     - Use `web.import_table_to_excel_plan` to generate an `AgentPlan` to insert data.
     - Hand that plan to `excelAgent` for validation, explanation, and execution.

---

## 6. Core Agent: `commAgent`

### Purpose

Own communication/workflow tools so other agents don’t send emails directly.

### Tools

- `comm.propose_email`
- `comm.send_email`
- `workflow.requestInputTool`
- `workflow.askForPlanApprovalTool` (for email approval).

### Behavior

- When another agent (or the router) wants an email:
  1. Draft content using `comm.propose_email`.
  2. Present draft to the user via `askForPlanApprovalTool` (or equivalent UI flow).
  3. Only after explicit approval call `comm.send_email` with the `emailHandle`.

This keeps a clear boundary between content generation and side-effectful sending.

---

## 7. Optional Specialized Agents (v2)

These agents may be introduced later for clarity and improved performance, and would typically be used by `excelAgent` rather than the router directly.

### 7.1 `dataCleaningAgent`

- Focus: detecting data issues and generating cleaning plans.
- Tools: `excel_context.get_selection_preview`, `excel_analysis.describe_selection`, `excel_transform.clean_table`.
- Instructions: only think about data quality (types, missingness, duplicates, normalization); output plans for `excelAgent` to validate and execute.

### 7.2 `formulaExplainerAgent`

- Focus: explaining and debugging formulas.
- Tools: `excel_context.get_snapshot`, `excel_analysis.explain_formula`, `excel_analysis.describe_selection`.
- Instructions: explain formulas in plain language, and propose safe changes if needed.

### 7.3 `financialModelingAgent`

- Focus: financial modeling workflows (e.g. valuations, forecasting, scenarios).
- Tools: subset of Excel tools plus Python/markets tools if implemented.
- Instructions: act like a financial analyst, using Excel + Python + web data, but always route any workbook changes through `excelAgent`’s planning/execution pipeline.

---

## 8. Guardrails & Memory Across Agents

All agents (especially `routingAgent` and `excelAgent`) should share cross-cutting safety and memory configuration:

### 8.1 Input processors

- `UnicodeNormalizer` – clean/normalize user input.
- `PromptInjectionDetector` – detect and rewrite/block prompt injection.
- `PIIDetector` – detect and redact or block PII in inputs.
- `ModerationProcessor` – for harmful/unsafe content.

### 8.2 Output processors

- `TokenLimiterProcessor` – limit token usage and cost.
- `SystemPromptScrubber` – scrub system prompts/internal instructions from outputs.
- Output `ModerationProcessor` and `PIIDetector` as needed for safety.

### 8.3 Memory

- Configure Mastra `Memory` for at least `routingAgent` and `excelAgent`:
  - `resource`: workbook or user id.
  - `thread`: conversation/session id.
- Use workbook-specific `AgentMemory` for actions, errors, and notes.

This setup aligns Excella with Mastra’s guardrails/memory recommendations and Anthropic’s guidance on safety and long-horizon tasks.

---

## 9. Kid-Friendly Summary

If we explain this to a smart 10-year-old:

- We have a **traffic cop robot** (`routingAgent`) that decides which helper robot to call.
- The main helper robot is the **Excel robot** (`excelAgent`): it looks at the sheet, makes a plan, checks if the plan is safe, asks "are you sure?", pretends to run it, and then actually changes the sheet.
- A **Python robot** (`pythonAgent`) does fancy code on the data.
- A **research robot** (`researchAgent`) looks things up on the internet and helps bring tables into Excel.
- An **email robot** (`commAgent`) writes and sends emails, but only after you say "yes, send this".
- Later, special robots can focus on cleaning data, explaining formulas, or doing finance.
- All robots wear **safety belts** (guardrails and memory) so they don’t leak secrets or break your spreadsheets.

This plan should guide how you wire up the tools from `excel-agent-tools.md` into concrete agents and workflows in Excella.
