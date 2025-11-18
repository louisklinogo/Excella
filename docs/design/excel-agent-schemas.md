## Excel Agent Shared Schemas

This document defines the core schemas that Excella’s agents and tools use to share plans, table data, and execution results. It builds on the existing types in `packages/core/src/excel` and is meant as the **authoritative reference** for agent-facing representations.

The goal is:

- One stable schema for **plans** (`AgentPlan`, `AgentPlanStep`).
- One stable schema for **table/selection previews** (`RangeSample`).
- One stable schema for **execution results** (`PlanExecutionResult`).

All agents (`excelAgent`, `researchAgent`, `pythonAgent`, `commAgent`) and tools (Excel, web, Python, etc.) should speak these schemas when handing work off to each other.

---

## 1. Plan Schema (`AgentPlan`, `AgentPlanStep`)

Source types:

- `packages/core/src/excel/plan-types.ts`
- `packages/core/src/excel/context-snapshot.ts` (for related logging types)

### 1.1. AgentPlan

```ts
export type AgentPlan = {
  snapshotId: string;
  steps: AgentPlanStep[];
};
``

- `snapshotId` — must match `ExcelContextSnapshot.meta.snapshotId`.
- `steps` — ordered list of actions to perform.

### 1.2. AgentPlanStep

Current implementation:

```ts
export type AgentPlanStep = {
  id: string;
  kind: string;
  description: string;
  targetWorksheet: string;
  targetRange: string;
  parameters?: Record<string, unknown>;
};
```

We keep this shape, but standardize `kind` semantics and expected `parameters` keys per kind.

#### 1.2.1. Step kinds (canonical set)

All Excel-related tools that emit or consume plans should use one of these `kind` values where possible:

```ts
type AgentPlanStepKind =
  | "create-sheet"
  | "write-range-values"
  | "append-table-rows"
  | "insert-table"
  | "update-formulas"
  | "delete-rows"
  | "delete-columns"
  | "format-range"
  | "set-data-validation"
  | "apply-layout-preset"
  | "other";
```

`AgentPlanStep.kind` remains a string in the type, but tools should treat it as one of the above values (and we can gradually tighten types if needed).

#### 1.2.2. Standard parameter shapes (by kind)

The `parameters` field is a generic record, but we standardize keys and shapes for common kinds.

**`write-range-values`**

Purpose: write a 2D array of values into `targetWorksheet`/`targetRange`.

```ts
parameters?: {
  values: unknown[][];      // data rows
  hasHeaders?: boolean;     // first row is headers
  overwrite?: boolean;      // default true; if false, tool may merge/append
};
```

**`append-table-rows`**

Purpose: append rows to an existing Excel table.

```ts
parameters?: {
  tableName: string;
  rows: unknown[][];        // new rows, in table column order
};
```

**`insert-table`**

Purpose: create a new table at the target range.

```ts
parameters?: {
  hasHeaders: boolean;
  columns?: string[];       // column names; if omitted, infer from first row
  values: unknown[][];      // data rows (excluding headers if hasHeaders=true)
  tableName?: string;       // optional explicit name
};
```

**`update-formulas`**

Purpose: set or update formulas in a range/column/body.

```ts
parameters?: {
  formula: string;          // Excel formula, e.g. "=SUM(A2:A10)"
  applyTo?: "range" | "column" | "table-body"; // default: "range"
};
```

**`delete-rows` / `delete-columns`**

Purpose: delete rows/columns intersecting `targetRange`.

```ts
parameters?: {
  mode?: "entire-row" | "entire-column" | "within-range"; // default: entire-row/column
};
```

**`format-range`**

Purpose: apply formatting to `targetWorksheet`/`targetRange`.

```ts
parameters?: {
  styleId?: string;         // preset style id
  numberFormat?: string;    // Excel format string
  bold?: boolean;
  italic?: boolean;
  border?: "none" | "outline" | "all";
  // etc, as needed
};
```

**`set-data-validation`**

Purpose: set validation rules on `targetRange`.

```ts
parameters?: {
  type: "list" | "number" | "date" | "custom";
  formula1?: string;        // Excel data validation formula
  formula2?: string;
  allowBlank?: boolean;
};
```

**`apply-layout-preset`**

Purpose: apply a standard layout (e.g. normalize headers, remove merges, etc.).

```ts
parameters?: {
  presetId: string;         // e.g. "standard-tabular-v1"
  options?: Record<string, unknown>;
};
```

**`other`**

Purpose: fallback for rare or experimental operations.

```ts
parameters?: Record<string, unknown>;
```

> **Note:** These parameter shapes are conventions on top of the existing `AgentPlanStep` type, not new types. Tools should follow them when emitting plans so they stay interoperable.

---

## 2. Table / Selection Preview Schema (`RangeSample`)

Source types:

- `packages/core/src/excel/context-snapshot.ts`

### 2.1. RangeSample

```ts
export interface RangeSample {
  worksheetName: string;
  address: string;           // e.g. "Sheet1!A1:D20" or "A1:D20"
  rowCount: number;
  columnCount: number;
  hasHeaders: boolean;
  headers?: (string | null)[];
  rows: CellValue[][];       // rowCount x columnCount
  truncated: boolean;        // true if preview was cut off
  formulas?: (string | null)[][];
  kinds?: CellKind[][];
}

export type CellValue = string | number | boolean | null;

export type CellKind = "empty" | "value" | "formula" | "error";
```

### 2.2. Canonical usage

`RangeSample` is the **canonical table/selection preview schema** for all agents and tools. It should be used in:

- `excel_context.get_selection_preview` (already true).
- `excel_analysis.describe_selection` (should include or be based on a `RangeSample`).
- `compute.run_python_on_selection`:
  - Input: a `RangeSample` representing the selection.
  - Output: a `RangeSample` representing the result table.
- `web.import_table_to_excel_plan`:
  - Input: a `RangeSample` built from web content (HTML table, CSV, etc.).
  - Output: an `AgentPlan` that writes that table into Excel.
- Any future `markets.*` or other data tools returning tables.

We can use an alias when helpful:

```ts
type TablePreview = RangeSample;
```

### 2.3. Optional future extensions

If needed later, we can extend `RangeSample` with optional metadata:

- `columnTypes?: string[]` (e.g. inferred types: "number", "string", "date").
- `source?: { type: "excel" | "web" | "python"; url?: string; toolId?: string }`.

For now, these are not required; the existing fields are sufficient for multi-agent interoperability.

---

## 3. Execution Result Schema (`PlanExecutionResult`)

Source types:

- `packages/core/src/excel/context-snapshot.ts` (for log entries and risk)
- `packages/core/src/excel/schemas.ts` (Zod schemas for log entries)
- `packages/agents/src/tools/excel/excel-actions-tools.ts` (current tool output shape)

### 3.1. Existing log types

```ts
export interface AgentActionLogEntry {
  id: string;
  timestamp: string;
  description: string;
  targetRange?: string;
  targetWorksheet?: string;
  kind: AgentActionKind;
  status: "success" | "failed" | "partial";
}

export interface AgentErrorLogEntry {
  id: string;
  timestamp: string;
  message: string;
  operation?: AgentActionKind;
  details?: string;
}

export interface RiskAssessment {
  level: "low" | "medium" | "high";
  reasons: string[];
  estimatedCellsAffected?: number;
  touchesFormulas?: boolean;
  touchesTables?: boolean;
  touchesNamedRanges?: boolean;
}
```

`excel-actions-tools.ts` already returns:

```ts
{
  actions: AgentActionLogEntry[];
  errors: AgentErrorLogEntry[];
  summary: string;
  updatedMemory: AgentMemory;
}
```

### 3.2. PlanExecutionResult (conceptual envelope)

We standardize this as the shared execution result shape for:

- `excel_actions.execute_plan` (dry-run).
- `excel_actions.apply_plan` (real execution).
- `excel_actions.preview_plan_effects` (pure preview, with empty `actions`/`errors`).

```ts
export type PlanExecutionResult = {
  actions: AgentActionLogEntry[];
  errors: AgentErrorLogEntry[];
  summary: string;
  updatedMemory?: AgentMemory;
  risk?: RiskAssessment;          // optional risk after execution/preview
  estimatedCellsAffected?: number; // optional if not already in risk
};
```

The existing `executeExcelPlanTool` output matches this closely; we can extend it by:

- Optionally adding `risk` and/or `estimatedCellsAffected` when available.
- Reusing this same shape for preview-only tools (with `updatedMemory` undefined, `actions` empty, etc.).

### 3.3. Usage

- **Excel tools**:
  - `excel_actions.execute_plan` (dry-run): returns `PlanExecutionResult` with synthetic actions and no workbook mutation.
  - `excel_actions.apply_plan`: returns `PlanExecutionResult` with real actions and updated memory.
  - `excel_actions.preview_plan_effects`: returns `PlanExecutionResult` with no actions but `risk` / `estimatedCellsAffected` filled.

- **Agents**:
  - `excelAgent` uses `PlanExecutionResult` to:
    - show summaries and logs to the user,
    - decide whether to continue, rollback, or ask for more input.

---

## 4. Agent Interoperability Using These Schemas

### 4.1. researchAgent → excelAgent

1. `researchAgent` uses web tools to fetch data and normalize it into a `RangeSample`.
2. It calls `web.import_table_to_excel_plan`, which:
   - takes that `RangeSample` as input,
   - emits an `AgentPlan` whose steps likely include `insert-table` and/or `write-range-values` with the standardized `parameters` shapes.
3. `researchAgent` returns to `routingAgent` something like:

```ts
{
  sourceUrl: string;
  table: RangeSample;    // normalized table
  plan: AgentPlan;       // how to insert into Excel
  summary: string;       // human summary
}
```

4. `routingAgent` passes the `AgentPlan` to `excelAgent`, which runs its standard pipeline:
   - snapshot → validate → explain → approval → preview → dry-run → apply → log.

### 4.2. pythonAgent → excelAgent

1. `excelAgent` (or the router) requests a `RangeSample` for the current selection via `excel_context.get_selection_preview`.
2. `pythonAgent` uses `compute.run_python_on_selection` with that `RangeSample` as input.
3. `compute.run_python_on_selection` returns another `RangeSample` representing the result table.
4. Either:
   - `pythonAgent` directly builds an `AgentPlan` with `write-range-values`/`insert-table` steps, or
   - it returns the `RangeSample` to `excelAgent`, which then uses planning tools to create an `AgentPlan`.
5. `excelAgent` executes the plan via the same `PlanExecutionResult` pipeline.

### 4.3. UI

- `plan-mapper.ts` already maps `AgentPlan` steps to UI tasks using `step.description`, `kind`, `targetWorksheet`, and `targetRange`.
- With the standardized `kind` and `parameters`, the UI can:
  - display more specific icons/labels per step type,
  - show high-level impact (e.g. number of rows/columns affected),
  - present execution results via `PlanExecutionResult` consistently.

---

## 5. Summary

- **Plans**:
  - `AgentPlan` + `AgentPlanStep` already exist; we standardize the set of `kind` values and the shape of `parameters` per kind.
- **Tables/Selections**:
  - `RangeSample` is the canonical table/selection preview schema for Excel, web, and Python tools.
- **Execution results**:
  - `PlanExecutionResult` (conceptual alias of your existing tool output) is the common envelope for dry-runs, real execution, and previews.

With these schemas pinned down, all agents and tools can share work reliably:

- Web tools and `researchAgent` can emit `RangeSample` + `AgentPlan`.
- `excelAgent` can validate/execute plans and log actions using `PlanExecutionResult`.
- `pythonAgent` can operate on `RangeSample` and hand results back as either `RangeSample` or new `AgentPlan` steps.

This document should be kept up to date as the authoritative reference for agent-facing schemas in Excella.
