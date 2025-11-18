## Excella Agent Tooling Catalog

This document captures a consolidated, opinionated catalog of tools for Excella’s AI agents.

It is grounded in:
- The current Excel context model in `packages/core/src/excel`
- The existing Mastra/AI SDK agent patterns in `packages/agents`
- Prior art from the archived `scira` project
- Anthropic’s guidance on writing tools and multi‑agent systems

The goal is **fewer, high‑leverage tools** with clear responsibilities, not a long list of thin wrappers.

---

## 1. Excel Context & Planning Tools

These tools expose Excella’s structured view of the workbook and help agents plan safe, transparent edits.

### 1.1 `excel_context.get_snapshot`

**Purpose**
- Provide a token‑efficient, LLM‑ready snapshot of the current workbook state.

**Backed by**
- `DefaultContextManager` and the `ExcelContextSnapshot` types in `packages/core/src/excel`.

**Why it exists**
- Every Excel‑aware agent decision should be grounded in a consistent view of:
  - Workbook structure (sheets, tables, named ranges)
  - Current selection and data preview
  - Safety configuration and recent agent memory
- Centralizing this prevents ad‑hoc Office.js calls sprinkled across tools.

**Key inputs** (draft)
- `includeFormulaSamples?: boolean`
- `includeDependencySummaries?: boolean`
- `detailLevel?: "concise" | "detailed"`

**Key outputs**
- A trimmed `ExcelContextSnapshot` suitable for direct model consumption.

---

### 1.2 `excel_context.get_selection_preview`

**Purpose**
- Return a focused preview of the current selection, table, or named range without the full snapshot overhead.

**Why it exists**
- Many tasks only require a small slice of data (e.g. describing a column, validating a range).
- Separating this from the full snapshot keeps tool outputs token‑efficient.

**Key inputs**
- `target?: { type: "current" | "range" | "table" | "namedRange"; value?: string }`
- `maxRows`, `maxColumns`, `includeFormulas`, `includeKinds`

**Key outputs**
- A single `RangeSample` with headers, rows, optional formulas and cell kinds.

---

### 1.3 `excel_planning.propose_plan`

**Purpose**
- Convert a natural‑language goal plus snapshot into a structured `AgentPlan`.

**Backed by**
- `AgentPlan` and `AgentPlanStep` types in `plan-types.ts`.

**Why it exists**
- Enforces a clear separation between planning and execution.
- Allows human‑in‑the‑loop approval of the plan before any mutations occur.

**Key inputs**
- `goal: string`
- `snapshot: ExcelContextSnapshot | SnapshotDTO`
- Optional constraints: `maxSteps`, `riskTolerance`

**Key outputs**
- `plan: AgentPlan` (steps with kinds, targets, parameters)
- `naturalLanguageSummary: string` for user review.

---

### 1.4 `excel_planning.validate_plan`

**Purpose**
- Validate a proposed plan against the current workbook context and safety limits.

**Backed by**
- `BasicPlanValidator` and `PlanValidationResult` in `basic-plan-validator.ts` and `plan-types.ts`.

**Why it exists**
- Encodes guardrails such as:
  - Snapshot mismatch
  - Read‑only mode
  - Excessive risk level
- Keeps safety concerns in one place instead of duplicating checks per tool.

**Key inputs**
- `plan: AgentPlan`
- Optional: `snapshot` (otherwise fetched internally).

**Key outputs**
- `validation: PlanValidationResult { isValid, risk, issues[] }`.

---

### 1.5 `excel_planning.explain_plan`

**Purpose**
- Translate a machine‑structured `AgentPlan` into a user‑friendly explanation.

**Why it exists**
- Supports human‑in‑the‑loop workflows: the agent can ask the user to approve a plan with clear language and risks.

**Key inputs**
- `plan: AgentPlan`
- Snapshot metadata (workbook name, key sheets, selection summary).

**Key outputs**
- `explanationMarkdown` describing what will change and where.
- `riskSummary` derived from validation.

---

## 2. Excel Execution & Safety Tools

These tools are the single gateway for making changes to workbooks and for reasoning about impact.

### 2.1 `excel_actions.execute_plan`

**Purpose**
- Safely execute an approved `AgentPlan` against the workbook and log the results.

**Backed by**
- `ActionExecutor`, `AgentActionLogEntry`, `AgentErrorLogEntry`, and `ContextUpdater` in `packages/core/src/excel`.

**Why it exists**
- Concentrates all mutating behavior in one tool, simplifying safety, observability, and auditing.
- Allows the agent to treat “doing the work” as a single action, while the implementation fans out into many low‑level Excel operations.

**Key behavior**
- Fetch current snapshot.
- Optionally re‑validate the plan.
- Execute each `AgentPlanStep` via an `ActionExecutor` that handles different `kind`s.
- Update `AgentMemory` using `ContextUpdater`, recording actions and errors.

**Key inputs**
- `plan: AgentPlan`
- `requireValidation?: boolean` (default true)
- `dryRun?: boolean` (describe effects without writing).

**Key outputs**
- `actions: AgentActionLogEntry[]`
- `errors: AgentErrorLogEntry[]`
- `summary: string`.

---

### 2.2 `excel_actions.preview_plan_effects`

**Purpose**
- Estimate the impact of a plan without applying it.

**Why it exists**
- Gives both the agent and user visibility into the scope of changes (cells, tables, named ranges) before execution.
- Useful for UI warnings and for automated risk assessments.

**Key inputs**
- `plan: AgentPlan`
- `snapshot: ExcelContextSnapshot`

**Key outputs**
- `estimatedCellsAffected`
- `touchedTables`, `touchedNamedRanges`
- `mayCreateSheets`, `mayDeleteRowsOrColumns`
- `riskEstimate: RiskAssessment`.

---

### 2.3 `excel_actions.rollback_last_actions` (optional)

**Purpose**
- Provide a soft undo mechanism based on recent `AgentActionLogEntry`s.

**Why it exists**
- Increases user trust by making AI changes reversible, where feasible.
- Uses stored `AgentMemory` and/or snapshots to revert a bounded number of changes.

**Key inputs**
- `workbookId`
- `maxActionsToRollback`

**Key outputs**
- `rolledBackActions: AgentActionLogEntry[]`
- `summary: string`.

---

## 3. Excel Analysis & Transformation Tools

Higher‑level tools that help users understand and reshape their data; they typically compose context, planning, and execution under the hood.

### 3.1 `excel_analysis.describe_selection`

**Purpose**
- Summarize the structure and content of the current selection or a specified range/table.

**Why it exists**
- Analysts frequently need a quick read on a block of data: column types, missingness, example values.
- This is a common precursor to planning transformations.

**Key inputs**
- `target?: { type: "current" | "range" | "table" | "namedRange"; value?: string }`
- `detailLevel?: "concise" | "detailed"`
- `includeStats?: boolean`

**Key outputs**
- `descriptionMarkdown`
- `columnSummaries[]` (types, null %, example values)
- `warnings[]` (mixed types, suspicious blanks, etc.).

---

### 3.2 `excel_analysis.explain_formula`

**Purpose**
- Explain the formula(s) in a cell or range, optionally including dependencies.

**Why it exists**
- Understanding complex or inherited formulas is a core Excel pain point.
- Builds trust by showing how a formula works before the agent modifies it.

**Key inputs**
- `cellAddress?: string` (default: active cell)
- `includeDependencyGraph?: boolean`

**Key outputs**
- `explanationMarkdown`
- `stepByStepBreakdown`
- Optional `dependencyGraphSummary` using `DependencyGateway`.

---

### 3.3 `excel_transform.clean_table`

**Purpose**
- Create (and optionally execute) a plan to clean a table or range: types, nulls, whitespace, duplicates, date normalization, etc.

**Why it exists**
- Data cleaning is one of the most frequent and tedious analyst tasks.
- Encapsulating it in a single tool allows the agent to propose and explain a multi‑step cleaning plan.

**Key inputs**
- `target: { type: "table" | "range"; nameOrAddress: string }`
- Optional rules: `dropDuplicateRows`, `trimWhitespace`, `standardizeDates`, etc.

**Key outputs**
- `plan: AgentPlan` (recommended cleaning steps)
- Optionally `executionResult` if the tool also calls `execute_plan`.

---

### 3.4 `excel_transform.create_summary_sheet`

**Purpose**
- Generate a summary sheet (pivot‑like) for a given table or range.

**Why it exists**
- Automates a common workflow: group‑by metrics and dashboards directly from raw data.

**Key inputs**
- `source: { type: "table" | "range"; nameOrAddress: string }`
- `groupByColumns: string[]`
- `metrics: { column: string; agg: "sum" | "avg" | "count" | ... }[]`
- Optional filters and layout preferences.

**Key outputs**
- `plan: AgentPlan` describing sheet creation and formula insertion.
- Metadata about the new summary (sheet name, address).

---

### 3.5 `excel_transform.apply_standard_layout`

**Purpose**
- Normalize sheets/tables into consistent layouts for downstream automation or templates.

**Why it exists**
- Many Excella features will assume specific patterns (e.g. headers in row 1, no merged cells, etc.).
- This tool enforces those conventions in a repeatable way.

**Key inputs**
- `targets: { type: "sheet" | "table"; name: string }[]`
- `layoutPresetId: string`

**Key outputs**
- `plan: AgentPlan` capturing necessary layout changes.

---

## 4. Excel Memory & Notes Tools

These tools connect workbook‑specific history (`AgentMemory`) and longer‑term Mastra memory to user workflows.

### 4.1 `excel_memory.log_note`

**Purpose**
- Add a structured note to the workbook’s `AgentMemory.notes`.

**Why it exists**
- Lets the agent persist important workbook facts (definitions, quirks, cautions) between sessions.

**Key inputs**
- `text: string`
- `importance: "low" | "medium" | "high"`

**Key outputs**
- `note: AgentNote`
- Optionally the updated note list or count.

---

### 4.2 `excel_memory.list_notes`

**Purpose**
- Retrieve the notes associated with the current workbook.

**Why it exists**
- Gives the agent quick access to prior context (e.g. custom KPI definitions) without re‑asking the user.

**Key inputs**
- Optional filters: `importance`, `since`, `containsText`.

**Key outputs**
- `notes: AgentNote[]`.

---

### 4.3 `excel_memory.search_conversation_memory`

**Purpose**
- Use Mastra `Memory` semantic recall for this workbook/thread.

**Why it exists**
- Complements `AgentMemory` (actions/errors/notes) with semantic recall of longer conversations, UI interactions, or prior analyses.

**Key inputs**
- `query: string`
- `resource: string` (e.g. workbook or user id)
- `thread: string` (conversation/thread id)

**Key outputs**
- `results[]` containing message snippets and metadata.

---

### 4.4 `excel_memory.update_working_profile`

**Purpose**
- Update structured working memory for Excel‑relevant user preferences (date formats, naming conventions, etc.).

**Why it exists**
- Makes Excella behave like a persistent analyst who remembers how a specific user/team likes their workbooks.

**Key inputs**
- Partial profile object (schema‑backed in Mastra memory).

**Key outputs**
- Updated profile snapshot for the agent to use.

---

## 5. Compute / Code Tools

These tools handle heavy computation and code execution, particularly Python, which is critical for advanced analytics.

### 5.1 `compute.run_python`

**Purpose**
- Execute arbitrary Python code in a sandbox and capture text/chart artifacts.

**Why it exists**
- Enables rich analysis, modeling, and visualization workflows without leaving Excel.
- Generalizes the `codeInterpreterTool` pattern from the archived scira project.

**Key inputs**
- `code: string`
- Optional metadata: `title`, `icon`.

**Key outputs**
- `message: string` (stdout/result)
- Optional `chart` metadata (type, title, elements).

---

### 5.2 `compute.run_python_on_selection`

**Purpose**
- Convenience wrapper: feed the current selection data into Python, then return table‑shaped output suitable for writing back to Excel.

**Why it exists**
- Covers a very common workflow: "Take this range, run custom Python logic, give me a result table." 

**Key inputs**
- `selectionMode` (current range/table or explicit address)
- `code: string` with clear contract for input/output.

**Key outputs**
- `resultTable` (rows/columns) plus optional chart metadata.

---

### 5.3 `compute.code_context_search`

**Purpose**
- Retrieve up‑to‑date programming context (libraries, frameworks, APIs) using external search (e.g. Exa).

**Why it exists**
- Helps the agent answer coding questions relevant to formulas, VBA, Python, Power Query, etc.

**Key inputs**
- `query: string`

**Key outputs**
- `response: string`
- `resultsCount`, `searchTime`, `outputTokens`.

---

## 6. Retrieval & Web Research Tools

These tools support pulling in external data and documentation for analysis and import into Excel.

### 6.1 `web.retrieve_url`

**Purpose**
- Robustly retrieve content from a URL, with Exa first and Firecrawl as a fallback.

**Why it exists**
- Users frequently want to bring data or documentation from the web into their spreadsheets.
- This is a direct evolution of scira’s `retrieveTool`.

**Key inputs**
- `url: string`
- `includeSummary?: boolean`
- `liveCrawl?: "never" | "auto" | "preferred"`

**Key outputs**
- `results[]` with `content`, `title`, `description`, `author`, `publishedDate`, `image`, `favicon`
- `source: "exa" | "firecrawl"`

---

### 6.2 `web.search_web`

**Purpose**
- General web search for background research.

**Why it exists**
- Enables Excella to provide context, benchmarks, and supporting material during analysis.

**Key inputs**
- `query: string`

**Key outputs**
- Ranked search results with titles, snippets, and URLs.

---

### 6.3 `web.search_academic`

**Purpose**
- Specialized academic search for research and modeling workflows.

**Why it exists**
- Helps users ground analyses in papers, methods, and best practices.

**Key inputs**
- `query: string`

**Key outputs**
- Academic results with titles, venues, years, and links.

---

### 6.4 `web.import_table_to_excel_plan`

**Purpose**
- From a URL, detect table‑like content and propose a plan to import it into the workbook.

**Why it exists**
- Bridges web retrieval and Excel manipulation via the same planning/execution pipeline.

**Key inputs**
- `url: string`
- Optional `targetWorksheetName`

**Key outputs**
- `plan: AgentPlan` to insert data into a new or existing sheet/table.

---

## 7. Business Communication Tools

These tools cover outbound communication about analyses and reports. Some already exist in `packages/agents`.

### 7.1 `comm.propose_email`

**Purpose**
- Draft emails summarizing analysis results or requesting input.

**Why it exists**
- Integrates Excella’s insights into existing workflows (email, approvals, status updates).

---

### 7.2 `comm.send_email`

**Purpose**
- Actually send previously drafted and approved emails.

**Why it exists**
- Keeps a clear boundary between content generation and side‑effectful sending, enabling approval flows.

---

### 7.3 `comm.request_input` and `comm.ask_for_plan_approval`

**Purpose**
- Implement human‑in‑the‑loop patterns (request more information, seek approval before acting).

**Why it exists**
- Mirrors your existing `human-in-the-loop-agent` design, but reusable for Excel.

---

## 8. Orchestration / Multi‑Agent Helper Tools (Optional)

These tools support multi‑agent patterns similar to Anthropic’s Research system. They are not required for an initial MVP but may be useful later.

### 8.1 `orchestration.spawn_subagent`

**Purpose**
- Launch a specialized subagent (e.g., web researcher, Python analyst) to work on a sub‑task.

**Why it exists**
- Enables parallel, specialized exploration for complex workflows.

---

### 8.2 `orchestration.save_research_plan_to_memory`

**Purpose**
- Persist a long‑horizon research or analysis plan in memory so it survives context truncation.

**Why it exists**
- Mirrors Anthropic’s pattern where the lead agent stores its plan externally when context grows large.

---

## 9. Markets & Financial Tools (Optional)

These tools are useful if Excella targets financial dashboards and market analysis.

### 9.1 `markets.crypto_overview`

**Purpose**
- Fetch comprehensive crypto asset data (metadata + market data).

**Backed by**
- Scira’s `coinDataTool` / `coinDataByContractTool` (CoinGecko APIs).

---

### 9.2 `markets.crypto_ohlc`

**Purpose**
- Retrieve OHLC series plus coin metadata for charting.

**Backed by**
- Scira’s `coinOhlcTool`.

---

### 9.3 `markets.currency_convert`

**Purpose**
- Perform currency conversions for reports and dashboards.

**Why it exists**
- Common need for global businesses building Excel‑based financial models.

---

### 9.4 `markets.stock_chart`

**Purpose**
- Retrieve stock chart data for visualization and analysis.

**Why it exists**
- Complements Excel’s charting with AI‑generated chart plans and interpretations.

---

## 10. Utility Tools

These are cross‑cutting helpers that may be used by multiple agents.

### 10.1 `utils.text_translate`

**Purpose**
- Translate text between languages.

**Why it exists**
- Useful for international teams working on multi‑language reports.

---

### 10.2 `utils.datetime_info`

**Purpose**
- Provide date/time parsing and formatting help.

**Why it exists**
- Date handling is a recurring source of errors in spreadsheets; this tool supports reasoning and normalization.

---

### 10.3 `utils.map_lookup` / `utils.weather` (Optional)

**Purpose**
- Domain‑specific information (locations, weather) for logistics or planning templates.

**Why it exists**
- Only needed if Excella offers dedicated solutions in these verticals; otherwise optional.

---

## Implementation Notes

- Tools should be implemented using Mastra’s `createTool` or AI SDK’s `tool` helper, keeping schemas strict and descriptions explicit.
- Excel tools must sit on top of the `core` Excel abstractions (`ExcelGateway`, `ContextManager`, `ContextUpdater`, `PlanValidator`) rather than calling Office APIs directly.
- All mutating Excel actions should ultimately flow through `excel_actions.execute_plan` for safety, logging, and consistency.
