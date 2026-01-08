# Excella – Excel Context Manager TODO

This TODO focuses on the next steps for the Excel Context Manager and agent integration.

## 1. Agent tools and APIs

- [x] Expose a `getExcelContextSnapshot` tool in `@excella/agents` that:
  - Relies on the Excel host to call `createExcelContextEnvironment()` and populate an `ExcelContextSnapshot` in the Mastra runtime context.
  - Returns a serialized `ExcelContextSnapshot` to the AI agent (read-only, no side effects).
- [x] Design a simple JSON wire format for sending snapshots to Mastra agents (aligning with the existing AI/chat stack).

## 2. Action execution (safe write operations)

- [ ] Define a minimal `ActionExecutor` implementation that supports a small, well-scoped subset of `AgentActionKind` (e.g. `"write-values"`, `"fill-formulas"`, `"insert-rows"`, `"insert-columns"`).
- [x] Integrate `BasicPlanValidator` so that any execution path:
  - Checks `snapshotId` freshness.
  - Enforces `SafetyContext.limits` and `SafetyFlags.readOnlyMode`.
- [x] Add Mastra tools (`excel_actions.execute_plan`, `excel_actions.apply_plan`) that:
  - Accept an `AgentPlan` and corresponding `ExcelContextSnapshot`.
  - Validate it with `BasicPlanValidator`.
  - Execute it via an injected `ActionExecutor` supplied by the host (Office.js).

## 3. Human-in-the-loop and UI integration

- [ ] Add basic UI affordances in the Excel task pane (frontend) such as:
  - "Show context" button that fetches and displays a summarized `ExcelContextSnapshot`.
  - "Propose plan" button that sends snapshot + user goal to the agent and shows the resulting plan and risk level.
- [x] Render Excel plans proposed by `excel_planning.propose_plan` as `Plan` components above assistant answers, showing step descriptions and target ranges.
- [x] Render all tool calls (e.g., research and Excel tools) as `Tool` components in the chat UI so inputs, outputs, and errors are visible.
- [ ] Design and implement a minimal set of new workflow tools (e.g., `excel_workflow.record_plan_decision`) that log plan approval/rejection based on the current architecture instead of legacy HITL tools.
- [ ] Add explicit Approve / Reject affordances in the chat UI that call the new workflow tools and, once approved, trigger `excel_actions.execute_plan` / `excel_actions.apply_plan` as appropriate.
 - [ ] Explore using an Office dialog for larger UX surfaces (e.g., a plan execution wizard, dashboards, or data-cleaning previews) when the taskpane is too narrow.

## 4. Streaming foundation for Excella agents

- [x] Introduce a simple `chatAgent` in `@excella/agents` for `/api/chat` that focuses on conversational responses (minimal tools), while keeping more complex HITL agents separate for workflows like `/api/hitl-chat`.
- [x] Keep the Mastra + AI SDK + Next.js streaming pipeline based on `agent.stream(messages)` + `toAISdkFormat(stream, { from: "agent" })` + `createUIMessageStreamResponse`, preserving all event types.
- [x] Maintain a temporary compatibility shim that accumulates `text-delta` events into a synthetic `type: "text"` part so the existing chat UI continues to work during the transition.
- [x] Refactor `apps/ai-chatbot/src/app/page.tsx` to render AI SDK v5 parts using the existing `ai-elements` components:
  - `text` / `text-delta` → `Message` / `MessageResponse` streaming.
  - `reasoning` → `Reasoning` with collapsible content.
  - `source-url` → `WebSearchSources` summary card + `MessageSourcesSheet` for full sources.
  - `tool-*` parts → `Tool` cards, with plan-shaped outputs additionally surfaced as `Plan`.
  - Leave room to later map `data-*` parts into higher-level components (`Task`, `Queue`, `Artifact`, etc.) as we introduce those patterns.

## 5. Safety and risk model enhancements

- [ ] Extend `DefaultSafetyConfigProvider` to:
  - Consider overlaps between operations and named ranges / tables.
  - Optionally treat ranges with certain naming conventions (e.g., `DoNotEdit_*`) as protected.
- [ ] Add an optional backup strategy (e.g., `_AI_BACKUPS` sheet) for destructive actions like `"delete-rows"` and `"delete-columns"`.

## 6. Workbook identity and memory

- [ ] Replace the placeholder `workbookId`/`workbookName` logic in `MetaProvider` with a more stable ID:
  - Persist a generated UUID in the hidden context sheet on first run.
  - Reuse it on subsequent sessions.
- [ ] Decide on retention policy for `AgentMemory` (e.g., maximum number of actions/errors/notes, and cleanup strategy).

## 7. Linting and documentation follow-up

- [ ] Run `bunx ultracite fix` and `bunx ultracite check` once the existing project-wide lint issues are addressed, ensuring the new Excel modules conform fully.
- [ ] Add a short developer-facing guide under `docs/` explaining how to:
  - Use `@excella/core/excel/*` types and helpers.
  - Implement host-specific gateways and memory repositories.
  - Wire them into Mastra agents/tools.

## 8. Excel snapshot scopes and sheet analysis

- [ ] Add a `scope` concept to the Excel snapshot pipeline (e.g. `"selection" | "region" | "sheet"`) and thread it through `SelectionContext` and snapshot tools.
- [ ] Implement surrounding-region behavior in `OfficeJsExcelGateway` so a single-cell selection expands to the contiguous non-empty block (with row/column caps) for previews.
- [ ] Implement a full-sheet / `getUsedRange()` mode that samples the used range with configurable row/column caps for "analyze sheet" prompts.
- [ ] Enrich `ExcelContextSnapshot` with per-column metadata (types, non-empty counts, basic aggregates, top-K categories) derived from the preview data.
- [ ] Expose the new scopes and enriched snapshot via updated tools (e.g. `excel_context.get_snapshot`) and add an explicit "analyze sheet" path in `excelAgent` that uses the sheet-level snapshot.

## 9. Structured output pipeline for agents (longer-term)

- [ ] Design and implement a first-class structured output layer for Excella agents (chat, Excel, research) so they emit **typed result envelopes** instead of ad-hoc `text` fields.
  - Modeled on the patterns in `docs/research/ai-sdk/generating-structured-data.md` and the archived Scira message parts (`.archived/scira/components/message-parts/index.tsx`).
  - Define shared TypeScript interfaces like `ExcellaAgentResult` with fields such as `answer`, `excelPlan`, `researchPlan`, `sources`, and `telemetry`, and ensure they are produced via `generateObject` / `Output.object` where appropriate.
  - Update the Mastra agents (especially `researchAgent` and `excelAgent`) so planner-style tools (`research_planning.propose_plan`, `excel_planning.propose_plan`) surface their plans in a consistent `plan` field at the top level, not only inside nested sub-agent calls.
  - Keep the UI layer (`MessageResponse`, `Tool`, `Plan`, future custom message parts) decoupled from raw tool payloads by mapping these structured results into dedicated visual components, similar to Scira's `message-parts` approach.
  - Rationale: a structured output pipeline makes it easier to
    - reliably detect and render plans (Excel + research) and other rich artifacts without brittle shape checks;
    - evolve the agent network (new tools/agents) without continually patching the UI;
    - enforce safety and auditability by having a stable, typed envelope for what each agent did and why.
