# Excella – Excel Context Manager TODO

This TODO focuses on the next steps for the Excel Context Manager and agent integration.

## 1. Agent tools and APIs

- [ ] Expose a `getExcelContextSnapshot` tool in `@excella/agents` that:
  - Uses `createExcelContextEnvironment()` in the Excel host to call `contextManager.getSnapshot()`.
  - Returns a serialized `ExcelContextSnapshot` to the AI agent (read-only, no side effects).
- [ ] Design a simple JSON wire format for sending snapshots to Mastra agents (aligning with the existing AI/chat stack).

## 2. Action execution (safe write operations)

- [ ] Define a minimal `ActionExecutor` implementation that supports a small, well-scoped subset of `AgentActionKind` (e.g. `"write-values"`, `"fill-formulas"`, `"insert-rows"`, `"insert-columns"`).
- [ ] Integrate `BasicPlanValidator` so that any execution path:
  - Checks `snapshotId` freshness.
  - Enforces `SafetyContext.limits` and `SafetyFlags.readOnlyMode`.
- [ ] Add a host-side Mastra tool like `executeExcelPlan` that:
  - Accepts an `AgentPlan`.
  - Validates it with `BasicPlanValidator`.
  - Executes it via the `ActionExecutor` using Office.js.

## 3. Human-in-the-loop and UI integration

- [ ] Connect the new Excel tools to the existing `humanInTheLoopAgent` in `@excella/agents` so that:
  - Plans involving Excel modifications are surfaced to the user for approval.
  - Approved plans are passed to `executeExcelPlan`.
- [ ] Add basic UI affordances in the Excel task pane (frontend) such as:
  - "Show context" button that fetches and displays a summarized `ExcelContextSnapshot`.
  - "Propose plan" button that sends snapshot + user goal to the agent and shows the resulting plan and risk level.

## 4. Safety and risk model enhancements

- [ ] Extend `DefaultSafetyConfigProvider` to:
  - Consider overlaps between operations and named ranges / tables.
  - Optionally treat ranges with certain naming conventions (e.g., `DoNotEdit_*`) as protected.
- [ ] Add an optional backup strategy (e.g., `_AI_BACKUPS` sheet) for destructive actions like `"delete-rows"` and `"delete-columns"`.

## 5. Workbook identity and memory

- [ ] Replace the placeholder `workbookId`/`workbookName` logic in `MetaProvider` with a more stable ID:
  - Persist a generated UUID in the hidden context sheet on first run.
  - Reuse it on subsequent sessions.
- [ ] Decide on retention policy for `AgentMemory` (e.g., maximum number of actions/errors/notes, and cleanup strategy).

## 6. Linting and documentation follow-up

- [ ] Run `bunx ultracite fix` and `bunx ultracite check` once the existing project-wide lint issues are addressed, ensuring the new Excel modules conform fully.
- [ ] Add a short developer-facing guide under `docs/` explaining how to:
  - Use `@excella/core/excel/*` types and helpers.
  - Implement host-specific gateways and memory repositories.
  - Wire them into Mastra agents/tools.
