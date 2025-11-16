import type { SafetyConfigProvider } from "./context-manager";
import type {
  RiskAssessment,
  SafetyContext,
  SafetyLimits,
  SelectionContext,
  WorkbookContext,
} from "./context-snapshot";

export class DefaultSafetyConfigProvider implements SafetyConfigProvider {
  buildSafetyContext(
    _workbookId: string,
    workbook: WorkbookContext,
    selection: SelectionContext | null
  ): Promise<SafetyContext> {
    const limits: SafetyLimits = {
      maxCellsToWrite: 10_000,
      maxRowsToDelete: 100,
      maxColumnsToDelete: 10,
      requireConfirmationForWholeSheetOps: true,
      requireBackupBeforeDestructiveOps: true,
    };

    const flags = {
      readOnlyMode: false,
      experimentalFeaturesEnabled: false,
    };

    const currentRisk = assessRisk(workbook, selection, limits);

    return Promise.resolve({
      limits,
      flags,
      currentRisk,
    } satisfies SafetyContext);
  }
}

const assessRisk = (
  _workbook: WorkbookContext,
  selection: SelectionContext | null,
  limits: SafetyLimits
): RiskAssessment | null => {
  if (!selection || selection.type === "none") {
    return null;
  }

  const rowCount = selection.rowCount ?? 0;
  const columnCount = selection.columnCount ?? 0;
  const estimatedCells = rowCount * columnCount;

  let level: RiskAssessment["level"] = "low";
  if (estimatedCells > limits.maxCellsToWrite) {
    level = "high";
  } else if (estimatedCells > limits.maxCellsToWrite / 10) {
    level = "medium";
  }

  const reasons: string[] = [];
  if (estimatedCells > limits.maxCellsToWrite) {
    reasons.push("Selection exceeds maxCellsToWrite limit.");
  }

  return {
    level,
    reasons,
    estimatedCellsAffected: estimatedCells,
    touchesFormulas: false,
    touchesTables: selection.type === "table",
    touchesNamedRanges: false,
  } satisfies RiskAssessment;
};
