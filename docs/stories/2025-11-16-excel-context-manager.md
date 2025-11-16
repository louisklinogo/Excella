# Excel Context Manager – Work Log (2025-11-16)

## Scope

This story captures the first implementation pass of the Excel Context Manager and related infrastructure used by AI agents to understand and safely operate within an Excel workbook.

## Changes Implemented

### 1. Core domain schema in `@excella/core`

Added a domain model for the agent-facing Excel snapshot:

- `packages/core/src/excel/context-snapshot.ts`
  - `ExcelContextSnapshot` as the top-level context object.
  - `ContextMeta` for snapshot/workbook metadata and versioning.
  - `WorkbookContext`, `WorksheetSummary`, `TableSummary`, `NamedRangeSummary` for workbook structure.
  - `SelectionContext` for current user selection (range vs table, region, etc.).
  - `DataPreview` and `RangeSample` for lightweight sample data.
  - `AgentMemory` (`recentActions`, `recentErrors`, `notes`) for lightweight per-workbook memory.
  - `SafetyContext` with `SafetyLimits`, `RiskAssessment`, and `SafetyFlags` for safety-aware planning.
  - `AgentActionKind` union expanded to cover high-level action categories:
    - Core writes: `"write-values"`, `"fill-formulas"`, `"transform-data"`.
    - Tables/ranges: `"insert-table"`, `"update-table-structure"`, `"sort-range"`, `"filter-range"`.
    - Formatting: `"formatting-change"`.
    - Rows/columns: `"insert-rows"`, `"insert-columns"`, `"delete-rows"`, `"delete-columns"`.
    - Sheets: `"create-sheet"`, `"rename-sheet"`, `"delete-sheet"`, `"move-sheet"`.
    - Named ranges: `"create-named-range"`, `"update-named-range"`.
    - Validation/comments: `"set-data-validation"`, `"remove-data-validation"`, `"add-comment"`, `"edit-comment"`, `"remove-comment"`.
    - Fallback: `"other"`.

### 2. Application-layer interfaces and orchestration

Added application-layer abstractions for building and updating snapshots:

- `packages/core/src/excel/excel-gateway.ts`
  - `ExcelGateway` interface for fetching workbook structure, selection, and data previews.
  - `DataPreviewOptions` to control sampling limits.

- `packages/core/src/excel/context-manager.ts`
  - `MetaProvider`, `AgentMemoryRepository`, `SafetyConfigProvider` interfaces.
  - `DefaultContextManager` to orchestrate `meta + workbook + selection + dataPreview + memory + safety` into a single `ExcelContextSnapshot`.

- `packages/core/src/excel/context-updater.ts`
  - `ContextUpdater` to merge `AgentActionLogEntry` and optional `AgentErrorLogEntry` into `AgentMemory`, keep only recent items, and persist via `AgentMemoryRepository`.

- `packages/core/src/excel/plan-types.ts`
  - `AgentPlan`, `AgentPlanStep`, `PlanValidationResult`, `PlanValidator`, `ActionExecutor` types to structure agent plans, validation, and execution.

### 3. Safety configuration and basic plan validation

- `packages/core/src/excel/safety-config.ts`
  - `DefaultSafetyConfigProvider` that produces `SafetyContext` with fixed limits and a simple risk assessment based on selection size and whether the selection is a table.

- `packages/core/src/excel/basic-plan-validator.ts`
  - `BasicPlanValidator` that:
    - Ensures `plan.snapshotId` matches `context.meta.snapshotId`.
    - Respects `SafetyFlags.readOnlyMode`.
    - Uses `context.safety.currentRisk` (or a low-risk default) when returning `PlanValidationResult`.

### 4. Formula samples and dependency awareness

- Extended `RangeSample` in `packages/core/src/excel/context-snapshot.ts` with:
  - Optional `formulas?: (string | null)[][]` for sampled formula text.
  - Optional `kinds?: CellKind[][]` to classify cells as `"empty" | "value" | "formula" | "error"`.
- Added `dependencySummaries?: DependencySummary[]` and `DependencyNodeRef` to `ExcelContextSnapshot` to express object-level dependencies between tables and named ranges.
- Introduced `ContextDetailOptions` and `DependencySummaryProvider` in `packages/core/src/excel/context-manager.ts` so callers can opt into formula samples and dependency summaries when building a snapshot.
- Updated `ExcelGateway.getDataPreview` and `apps/ai-chatbot/src/lib/excel/officejs-excel-gateway.ts` to optionally load `range.formulas` and compute `CellKind`, respecting the `includeFormulas` flag.
- Implemented `OfficeJsDependencySummaryProvider` in `apps/ai-chatbot/src/lib/excel/dependency-summary-provider.ts` to:
  - Sample formulas from table data ranges and named range formulas.
  - Infer dependencies via simple heuristics (structured references `TableName[` and named range name matches).
  - Populate `dependencySummaries` when `includeDependencySummaries` is requested.

### 5. Persistence schema validation

- `packages/core/src/excel/schemas.ts`
  - `AgentMemorySchema` and related zod schemas for `AgentActionLogEntry`, `AgentErrorLogEntry`, and `AgentNote`.
  - Used to validate persisted memory before use.

### 6. Package exports

- Updated `packages/core/package.json` to export new Excel-related modules under `@excella/core/excel/*` so they can be consumed by apps and agents without barrel files.

## Host-side wiring (Excel add-in app)

In `apps/ai-chatbot`, added host-specific wiring that depends on Office.js and `@excella/core`:

- `apps/ai-chatbot/src/lib/excel/officejs-excel-gateway.ts`
  - Implements `ExcelGateway` using `Excel.run`.
  - Maps workbook structure (worksheets, tables, named ranges) into `WorkbookContext`.
  - Builds `SelectionContext` from the active worksheet, selected range, and tables.
  - Produces `DataPreview` via sampled ranges and `range.values`.

- `apps/ai-chatbot/src/lib/excel/hidden-worksheet-memory-repository.ts`
  - Implements `AgentMemoryRepository` using a very hidden sheet (`_AI_CONTEXT`) and a JSON blob stored in `A1`.
  - Uses `AgentMemorySchema` from `@excella/core/excel/schemas` for validation.

- `apps/ai-chatbot/src/lib/excel/context-environment.ts`
  - `createExcelContextEnvironment()` factory that wires:
    - `OfficeJsExcelGateway` as the `ExcelGateway`.
    - `HiddenWorksheetMemoryRepository` as the `AgentMemoryRepository`.
    - `DefaultSafetyConfigProvider` from `@excella/core`.
    - `OfficeJsDependencySummaryProvider` for optional dependency summaries.
    - Inline `MetaProvider` that generates `snapshotId` and a simple `workbookId` placeholder.
    - `DefaultContextManager` and `ContextUpdater` from `@excella/core`.
  - Provides a single entrypoint for tools/agents to obtain a snapshot and update memory.

### Excel dependency graph API

- Added `packages/core/src/excel/dependency-gateway.ts` defining:
  - `DependencyGraphNode`, `DependencyEdge`, and `SelectionDependencyGraph`.
  - `DependencyGateway` interface for selection-level dependency graphs.
- Implemented `OfficeJsDependencyGateway` in `apps/ai-chatbot/src/lib/excel/dependency-gateway.ts` that:
  - Uses `range.getDirectPrecedents()` to collect direct precedent ranges for the current selection.
  - Builds a `SelectionDependencyGraph` with a hard `maxNodes` cap and a `truncated` flag.

## Validation

- Ran `npx tsc --noEmit` from the project root after the new modules were added and after extending `AgentActionKind`.
- Type checking passes successfully; no new type errors were introduced.

## Logging and telemetry foundation

- Introduced `@excella/logging` as a new workspace package under `packages/logging`:
  - Provides a `Logger` interface with `debug/info/warn/error(event, fields)` and structured `LogEntry` (`level`, `event`, `timestamp`, `bindings`, `data`).
  - Centralized `LoggerConfig` loaded from environment with support for redaction, sampling, truncation, buffering, and correlation headers.
  - Console and pino transports for JSON/pretty output.
  - AsyncLocalStorage-based request context and Next.js adapter (`seedRequestContext`, `getRequestId`).
  - Zod-based `EventSchemas` for core telemetry events like `"tool.call"`, `"tool.result"`, `"ai.request.start"`, `"ai.request.done"`, `"excel.batch"`, and `"excel.batch.done"`.
- Wired telemetry into the chat API route at `apps/ai-chatbot/src/app/api/chat/route.ts`:
  - Logs `"ai.request.start"` with provider/model when a chat request begins.
  - Logs `"ai.request.done"` with provider/model, duration, and status (`"ok"`/`"error"`) for each request.

## Notes

- Linting (`bunx ultracite check`) currently fails due to pre-existing formatting/import-order issues in other parts of the app; the new Excel modules were written to be Biome-friendly but global lint is not yet clean.
- Workbook-specific IDs are currently placeholders in the `MetaProvider`; a more stable workbook identity mechanism can be added later (e.g., stored in the hidden sheet).
