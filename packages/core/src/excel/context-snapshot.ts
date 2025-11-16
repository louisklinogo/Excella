export interface ExcelContextSnapshot {
  meta: ContextMeta;
  workbook: WorkbookContext;
  selection: SelectionContext | null;
  dataPreview: DataPreview;
  memory: AgentMemory;
  safety: SafetyContext;
}

export interface ContextMeta {
  snapshotId: string;
  snapshotVersion: number;
  createdAt: string;
  workbookId: string;
  workbookName: string;
  workbookPath?: string;
  locale?: string;
  excelVersion?: string;
  addinVersion?: string;
}

export interface WorkbookContext {
  worksheetCount: number;
  activeWorksheet: WorksheetSummary | null;
  worksheets: WorksheetSummary[];
  tables: TableSummary[];
  namedRanges: NamedRangeSummary[];
}

export interface WorksheetSummary {
  id: string;
  name: string;
  position: number;
  visibility: "visible" | "hidden" | "veryHidden";
}

export interface TableSummary {
  id: string;
  name: string;
  worksheetName: string;
  address: string;
  headerRowRange: string;
  dataBodyRange: string;
  showTotalsRow: boolean;
  columns: TableColumnSummary[];
}

export interface TableColumnSummary {
  name: string;
  index: number;
  address: string;
}

export interface NamedRangeSummary {
  name: string;
  worksheetName?: string;
  address: string;
  comment?: string;
}

export interface SelectionContext {
  type: "range" | "table" | "none";
  worksheetName?: string;
  rangeAddress?: string;
  rowCount?: number;
  columnCount?: number;
  tableName?: string;
  tableId?: string;
  tableRegion?: "header" | "body" | "totals" | "whole";
}

export interface DataPreview {
  primarySample: RangeSample | null;
  secondarySamples: RangeSample[];
}

export interface RangeSample {
  worksheetName: string;
  address: string;
  rowCount: number;
  columnCount: number;
  hasHeaders: boolean;
  headers?: (string | null)[];
  rows: CellValue[][];
  truncated: boolean;
}

export type CellValue = string | number | boolean | null;

export interface AgentMemory {
  recentActions: AgentActionLogEntry[];
  recentErrors: AgentErrorLogEntry[];
  notes: AgentNote[];
}

export interface AgentActionLogEntry {
  id: string;
  timestamp: string;
  description: string;
  targetRange?: string;
  targetWorksheet?: string;
  kind: AgentActionKind;
  status: "success" | "failed" | "partial";
}

export type AgentActionKind =
	// Core data writes
	| "write-values"
	| "fill-formulas"
	| "transform-data"
	// Tables and ranges
	| "insert-table"
	| "update-table-structure"
	| "sort-range"
	| "filter-range"
	// Formatting
	| "formatting-change"
	// Rows and columns
	| "insert-rows"
	| "insert-columns"
	| "delete-rows"
	| "delete-columns"
	// Sheets
	| "create-sheet"
	| "rename-sheet"
	| "delete-sheet"
	| "move-sheet"
	// Named ranges
	| "create-named-range"
	| "update-named-range"
	// Validation and comments
	| "set-data-validation"
	| "remove-data-validation"
	| "add-comment"
	| "edit-comment"
	| "remove-comment"
	// Fallback
	| "other";

export interface AgentErrorLogEntry {
  id: string;
  timestamp: string;
  message: string;
  operation?: AgentActionKind;
  details?: string;
}

export interface AgentNote {
  id: string;
  timestamp: string;
  text: string;
  importance: "low" | "medium" | "high";
}

export interface SafetyContext {
  limits: SafetyLimits;
  currentRisk: RiskAssessment | null;
  flags: SafetyFlags;
}

export interface SafetyLimits {
  maxCellsToWrite: number;
  maxRowsToDelete: number;
  maxColumnsToDelete: number;
  requireConfirmationForWholeSheetOps: boolean;
  requireBackupBeforeDestructiveOps: boolean;
}

export interface RiskAssessment {
  level: "low" | "medium" | "high";
  reasons: string[];
  estimatedCellsAffected?: number;
  touchesFormulas?: boolean;
  touchesTables?: boolean;
  touchesNamedRanges?: boolean;
}

export interface SafetyFlags {
  readOnlyMode: boolean;
  experimentalFeaturesEnabled: boolean;
}
