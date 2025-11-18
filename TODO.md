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

- [ ] Add basic UI affordances in the Excel task pane (frontend) such as:
  - "Show context" button that fetches and displays a summarized `ExcelContextSnapshot`.
  - "Propose plan" button that sends snapshot + user goal to the agent and shows the resulting plan and risk level.

## 4. Streaming foundation for Excella agents

- [ ] Introduce a simple `chatAgent` in `@excella/agents` for `/api/chat` that focuses on conversational responses (minimal tools), while keeping more complex HITL agents separate for workflows like `/api/hitl-chat`.
- [ ] Keep the Mastra + AI SDK + Next.js streaming pipeline based on `agent.stream(messages)` + `toAISdkFormat(stream, { from: "agent" })` + `createUIMessageStreamResponse`, preserving all event types.
- [ ] Maintain a temporary compatibility shim that accumulates `text-delta` events into a synthetic `type: "text"` part so the existing chat UI continues to work during the transition.
- [ ] Refactor `apps/ai-chatbot/src/app/page.tsx` to render AI SDK v5 parts using the existing `ai-elements` components:
  - `text-delta` → `Message` / `MessageResponse` streaming.
  - `tool-*` / `data-*` parts → `Plan`, `Task`, `Tool`, `Queue`, `ChainOfThought`, `Artifact`, etc.
  - Design a clear mapping table from `part.type` → component(s).

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
