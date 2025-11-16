import type { DependencySummaryProvider } from "@excella/core/excel/context-manager";
import type {
  DataPreview,
  DependencyNodeRef,
  DependencySummary,
  WorkbookContext,
} from "@excella/core/excel/context-snapshot";

const MAX_FORMULA_ROWS = 10;
const MAX_FORMULA_COLUMNS = 10;

export class OfficeJsDependencySummaryProvider
  implements DependencySummaryProvider
{
  async buildDependencySummaries(
    workbook: WorkbookContext,
    _dataPreview: DataPreview
  ): Promise<DependencySummary[]> {
    const summaries: DependencySummary[] = [];
    const tableNames = new Set(workbook.tables.map((table) => table.name));
    const namedRangeNames = new Set(
      workbook.namedRanges.map((namedRange) => namedRange.name)
    );

    await Excel.run(async (context) => {
      const excelWorkbook = context.workbook;

      for (const table of workbook.tables) {
        const worksheet = excelWorkbook.worksheets.getItem(table.worksheetName);
        const sourceRef: DependencyNodeRef = {
          kind: "table",
          name: table.name,
          worksheetName: table.worksheetName,
        };

        const dependsOn = new Map<string, DependencyNodeRef>();

        const targetRange = worksheet.getRange(table.dataBodyRange);
        const sampledRange = getSampledRange(
          targetRange,
          MAX_FORMULA_ROWS,
          MAX_FORMULA_COLUMNS
        );
        if (sampledRange) {
          sampledRange.load(["formulas"]);
        }

        await context.sync();

        if (sampledRange) {
          const formulas = sampledRange.formulas as unknown[][];
          for (const row of formulas) {
            for (const cellFormula of row) {
              if (typeof cellFormula !== "string") {
                continue;
              }
              collectDependenciesFromFormula(
                cellFormula,
                tableNames,
                namedRangeNames,
                dependsOn
              );
            }
          }
        }

        if (dependsOn.size > 0) {
          summaries.push({
            source: sourceRef,
            dependsOn: Array.from(dependsOn.values()),
          });
        }
      }

      for (const namedRange of workbook.namedRanges) {
        const sourceRef: DependencyNodeRef = {
          kind: "namedRange",
          name: namedRange.name,
          worksheetName: namedRange.worksheetName,
        };
        const dependsOn = new Map<string, DependencyNodeRef>();

        const namedItem = excelWorkbook.names.getItem(namedRange.name);
        namedItem.load(["formula"]);

        await context.sync();

        const formula = namedItem.formula;
        if (typeof formula === "string" && formula.trim() !== "") {
          collectDependenciesFromFormula(
            formula,
            tableNames,
            namedRangeNames,
            dependsOn
          );
        }

        if (dependsOn.size > 0) {
          summaries.push({
            source: sourceRef,
            dependsOn: Array.from(dependsOn.values()),
          });
        }
      }
    });

    return summaries;
  }
}

const getSampledRange = (
  range: Excel.Range,
  maxRows: number,
  maxColumns: number
): Excel.Range | null => {
  const rowCount = range.rowCount;
  const columnCount = range.columnCount;
  if (rowCount === 0 || columnCount === 0) {
    return null;
  }

  const rowLimit = Math.min(rowCount, maxRows);
  const columnLimit = Math.min(columnCount, maxColumns);

  return range.getCell(0, 0).getResizedRange(rowLimit - 1, columnLimit - 1);
};

const collectDependenciesFromFormula = (
  formula: string,
  tableNames: Set<string>,
  namedRangeNames: Set<string>,
  target: Map<string, DependencyNodeRef>
): void => {
  for (const tableName of tableNames) {
    if (formula.includes(`${tableName}[`)) {
      const key = `table:${tableName}`;
      if (!target.has(key)) {
        target.set(key, {
          kind: "table",
          name: tableName,
        });
      }
    }
  }

  for (const rangeName of namedRangeNames) {
    if (formula.includes(rangeName)) {
      const key = `namedRange:${rangeName}`;
      if (!target.has(key)) {
        target.set(key, {
          kind: "namedRange",
          name: rangeName,
        });
      }
    }
  }
};
