import type {
	AgentActionLogEntry,
	ExcelContextSnapshot,
	RiskAssessment,
} from "./context-snapshot";

export type AgentPlan = {
	snapshotId: string;
	steps: AgentPlanStep[];
};

export type AgentPlanStep = {
	id: string;
	kind: string;
	description: string;
	targetWorksheet: string;
	targetRange: string;
	parameters?: Record<string, unknown>;
};

export type PlanValidationResult = {
	isValid: boolean;
	risk: RiskAssessment;
	issues: string[];
};

export type PlanValidator = {
	validate(
		plan: AgentPlan,
		context: ExcelContextSnapshot,
	): PlanValidationResult;
};

export type ActionExecutor = {
	execute(
		plan: AgentPlan,
		context: ExcelContextSnapshot,
	): Promise<AgentActionLogEntry[]>;
};
