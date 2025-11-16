import type {
	ExcelContextSnapshot,
	RiskAssessment,
} from "./context-snapshot";
import type { AgentPlan, PlanValidationResult, PlanValidator } from "./plan-types";

export class BasicPlanValidator implements PlanValidator {
	validate(
		plan: AgentPlan,
		context: ExcelContextSnapshot,
	): PlanValidationResult {
		const issues: string[] = [];

		if (plan.snapshotId !== context.meta.snapshotId) {
			issues.push("Plan was created for a different snapshot.");
		}

		if (context.safety.flags.readOnlyMode) {
			issues.push("Workbook is in read-only mode; write operations are not allowed.");
		}

		const baseRisk: RiskAssessment =
			context.safety.currentRisk ?? ({
				level: "low",
				reasons: [],
			} satisfies RiskAssessment);

		const isValid =
			issues.length === 0 && baseRisk.level !== "high";

		return {
			isValid,
			risk: baseRisk,
			issues,
		} satisfies PlanValidationResult;
	}
}
