# Orchestrator Foundation Plan (No Data Connectors Yet)

## Objectives
- Introduce `Orchestrator.LeadPlanner` to classify task difficulty/importance, allocate budgets (max turns, tool calls, tokens, parallelism) and drive delegation.
- Keep external data connectors out of scope for now, but lay groundwork for Supabase-backed durability later.
- Curate `activeTools` per step so the LLM sees only 5–8 context-relevant Excel tools; surface requirement-gating feedback to the model.
- Maintain explicit user confirmation for stateful Excel writes by default, with a feature flag for guarded auto-apply on trivial, idempotent actions.
- Establish evaluation/observability foundations: small scenario suite + LLM-as-judge, OpenTelemetry traces from API → Orchestrator → excel-runtime, Grafana dashboards (Datadog optional).

## Subagent Taxonomy (Domain.Role)
- `Orchestrator.LeadPlanner`
- `Excel.ProfileManager`
- `Excel.Read`
- `Excel.Write`
- `Excel.Format`
- `Excel.Chart`
- `Web.Research`
- `Memory.Compactor`
- `QA.Evaluator`

Each subagent receives scoped `activeTools`, effort budgets, and concise prompts tailored to its responsibilities.

## activeTools Curation & Guardrails
- Filter tools by selection/workbook profile context, Excel requirement support, provider policy, and permissions.
- Enforce `ExcelActionRequirements` directly in tool responses so the model understands why an action is blocked.
- Support tiered verbosity (`concise` vs `detailed`) to control token spend.
- Preserve existing approval flows (`requireApproval`) for state-changing operations.

## Evaluation & Observability Foundations
- Scenario suite (10–15 cases) covering read → analyze → write, formatting, and web-table generation.
- LLM-as-judge rubric: factual accuracy, `excelApply` payload quality, completeness, tool efficiency.
- OpenTelemetry traces across API → Orchestrator → subagents → excel-runtime, exported to Grafana first (Datadog optional later).
- Excel devtools events stay correlated via `correlationId`.

## Phased Delivery
1. **Phase 1** – Implement orchestrator skeleton, difficulty/importance classification, budgets, and `activeTools` curation with requirement feedback.
2. **Phase 2** – Add profile-refresh workflow, memory compaction trigger, and the initial eval harness (scenario suite + judge scoring).
3. **Phase 3** – Extend to sandbox execution and external data connectors (Supabase-backed durability), once foundations stabilize.

All implementation work will proceed on a new branch `feat/orchestrator-foundation` after committing current documentation updates.
