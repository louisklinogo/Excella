import type {
  DataPreview,
  RangeSample,
  SelectionContext,
  WorkbookContext,
} from "@excella/core/excel/context-snapshot";
import type {
  DataPreviewOptions,
  ExcelGateway,
} from "@excella/core/excel/excel-gateway";

export class OfficeJsExcelGateway implements ExcelGateway {
  async getWorkbookStructure(): Promise<WorkbookContext> {
    return Excel.run(async (context) => {
      const workbook = context.workbook;

      const worksheets = workbook.worksheets;
      worksheets.load([
        "items/name",
        "items/id",
        "items/position",
        "items/visibility",
      ]);

      const tables = workbook.tables;
      tables.load([
        "items/name",
        "items/id",
        "items/worksheet/name",
        "items/address",
        "items/headerRowRange/address",
        "items/dataBodyRange/address",
        "items/showTotals",
        "items/columns/name",
        "items/columns/index",
        "items/columns/range/address",
      ]);

      const names = workbook.names;
      names.load([
        "items/name",
        "items/comment",
        "items/worksheet/name",
        "items/address",
      ]);

      await context.sync();

      return mapWorkbookContext(worksheets, tables, names);
    });
  }

  async getCurrentSelection(): Promise<SelectionContext | null> {
    return Excel.run(async (context) => {
      const workbook = context.workbook;
      const activeWorksheet = workbook.worksheets.getActiveWorksheet();
      activeWorksheet.load(["name"]);

      const selectedRange = workbook.getSelectedRange();
      selectedRange.load(["address", "rowCount", "columnCount"]);

      const tables = activeWorksheet.tables;
      tables.load([
        "items/name",
        "items/id",
        "items/headerRowRange/address",
        "items/dataBodyRange/address",
        "items/totalsRowRange/address",
      ]);

      await context.sync();

      return buildSelectionContext(activeWorksheet, selectedRange, tables);
    });
  }

  async getDataPreview(
    selection: SelectionContext | null,
    options: DataPreviewOptions,
    includeFormulas?: boolean
  ): Promise<DataPreview> {
    return Excel.run(async (context) => {
      const { primaryRange, secondaryRanges } = resolvePreviewRanges(
        context,
        selection,
        options
      );

      const rangesToLoad = [primaryRange, ...secondaryRanges].filter(
        (range): range is Excel.Range => range !== null
      );

      for (const range of rangesToLoad) {
        const properties = ["values", "address", "rowCount", "columnCount"];
        if (includeFormulas) {
          properties.push("formulas");
        }
        range.load(properties);
      }

      await context.sync();

      const primarySample =
        primaryRange === null
          ? null
          : toRangeSample(
              primaryRange,
              options.maxPrimaryRows,
              options.maxPrimaryColumns,
              true,
              includeFormulas === true
            );

      const secondarySamples: RangeSample[] = secondaryRanges.map((range) =>
        toRangeSample(
          range,
          options.maxSecondaryRows,
          options.maxSecondaryColumns,
          false,
          includeFormulas === true
        )
      );

      return { primarySample, secondarySamples } satisfies DataPreview;
    });
  }
}

const mapWorkbookContext = (
  worksheets: Excel.WorksheetCollection,
  tables: Excel.TableCollection,
  names: Excel.NamedItemCollection
): WorkbookContext => {
  const worksheetItems = worksheets.items;
  const tableItems = tables.items;
  const nameItems = names.items;

  const worksheetSummaries = worksheetItems.map((worksheet, index) => ({
    id: worksheet.id,
    name: worksheet.name,
    position: worksheet.position ?? index,
    visibility: toVisibility(worksheet.visibility),
  }));

  const tableSummaries = tableItems.map((table) => ({
    id: table.id,
    name: table.name,
    worksheetName: table.worksheet.name,
    address: table.address,
    headerRowRange: table.headerRowRange.address,
    dataBodyRange: table.dataBodyRange.address,
    showTotalsRow: table.showTotals,
    columns: table.columns.items.map((column) => ({
      name: column.name,
      index: column.index,
      address: column.getRange().address,
    })),
  }));

  const namedRanges = nameItems.map((namedItem) => ({
    name: namedItem.name,
    worksheetName: namedItem.worksheet?.name,
    address: namedItem.address,
    comment: namedItem.comment,
  }));

  const activeWorksheet = worksheetSummaries.find(
    (worksheet) => worksheet.position === 0
  );

  return {
    worksheetCount: worksheetSummaries.length,
    activeWorksheet: activeWorksheet ?? null,
    worksheets: worksheetSummaries,
    tables: tableSummaries,
    namedRanges,
  } satisfies WorkbookContext;
};

const toVisibility = (
  visibility: Excel.SheetVisibility | undefined
): WorkbookContext["worksheets"][number]["visibility"] => {
  if (visibility === Excel.SheetVisibility.veryHidden) {
    return "veryHidden";
  }
  if (visibility === Excel.SheetVisibility.hidden) {
    return "hidden";
  }
  return "visible";
};

const buildSelectionContext = (
  activeWorksheet: Excel.Worksheet,
  selectedRange: Excel.Range,
  tables: Excel.TableCollection
): SelectionContext => {
  const tablesInSheet = tables.items;
  const matchingTable = tablesInSheet.find((table) =>
    rangeOverlapsTable(selectedRange, table)
  );

  if (!matchingTable) {
    return {
      type: "range",
      worksheetName: activeWorksheet.name,
      rangeAddress: selectedRange.address,
      rowCount: selectedRange.rowCount,
      columnCount: selectedRange.columnCount,
    } satisfies SelectionContext;
  }

  const region = getTableRegion(selectedRange, matchingTable);

  return {
    type: "table",
    worksheetName: activeWorksheet.name,
    rangeAddress: selectedRange.address,
    rowCount: selectedRange.rowCount,
    columnCount: selectedRange.columnCount,
    tableName: matchingTable.name,
    tableId: matchingTable.id,
    tableRegion: region,
  } satisfies SelectionContext;
};

const rangeOverlapsTable = (
  range: Excel.Range,
  table: Excel.Table
): boolean => {
  const tableRange = table.getRange();
  return (
    range.address === tableRange.address || range.intersect(tableRange) !== null
  );
};

const getTableRegion = (
  range: Excel.Range,
  table: Excel.Table
): SelectionContext["tableRegion"] => {
  if (range.address === table.headerRowRange.address) {
    return "header";
  }
  if (range.address === table.dataBodyRange.address) {
    return "body";
  }
  if (table.totalsRowRange && range.address === table.totalsRowRange.address) {
    return "totals";
  }
  return "whole";
};

const resolvePreviewRanges = (
  context: Excel.RequestContext,
  selection: SelectionContext | null,
  options: DataPreviewOptions
): {
  primaryRange: Excel.Range | null;
  secondaryRanges: Excel.Range[];
} => {
  if (!selection || selection.type === "none") {
    return { primaryRange: null, secondaryRanges: [] };
  }

  const worksheet = context.workbook.worksheets.getItem(
    selection.worksheetName ?? "Sheet1"
  );

  const primaryRange = worksheet.getRange(selection.rangeAddress ?? "A1");
  const secondaryRanges: Excel.Range[] = [];

  if (selection.type === "table" && selection.tableName) {
    const table = worksheet.tables.getItem(selection.tableName);
    const bodyRange = table.dataBodyRange;
    if (bodyRange.address !== primaryRange.address) {
      secondaryRanges.push(bodyRange);
    }
  }

  if (selection.rowCount && selection.rowCount > options.maxPrimaryRows) {
    const topSample = primaryRange.getResizedRange(
      options.maxPrimaryRows - 1,
      0
    );
    secondaryRanges.push(topSample);
  }

  return { primaryRange, secondaryRanges };
};

const toRangeSample = (
  range: Excel.Range,
  maxRows: number,
  maxColumns: number,
  hasHeaders: boolean,
  includeFormulas: boolean
): RangeSample => {
  const fullRowCount = range.rowCount;
  const fullColumnCount = range.columnCount;
  const rowLimit = Math.min(fullRowCount, maxRows);
  const columnLimit = Math.min(fullColumnCount, maxColumns);

  const allValues = range.values as unknown[][];
  const limitedValues = allValues
    .slice(0, rowLimit)
    .map((row) => row.slice(0, columnLimit));

  const allFormulas = includeFormulas
    ? (range.formulas as unknown[][] | undefined)
    : undefined;
  const limitedFormulas = allFormulas
    ?.slice(0, rowLimit)
    .map((row) => row.slice(0, columnLimit));

  const headers =
    hasHeaders && limitedValues.length > 0
      ? (limitedValues[0] as (string | null)[])
      : undefined;

  const dataValues = hasHeaders ? limitedValues.slice(1) : limitedValues;
  const dataFormulas = hasHeaders ? limitedFormulas?.slice(1) : limitedFormulas;

  const kinds = dataValues.map((row, rowIndex) =>
    row.map((value, columnIndex) => {
      const formulaRow = dataFormulas?.[rowIndex];
      const formula = formulaRow?.[columnIndex];

      if (typeof formula === "string" && formula.trim() !== "") {
        return "formula";
      }

      if (value === null || value === undefined || value === "") {
        return "empty";
      }

      if (typeof value === "string" && value.startsWith("#")) {
        return "error";
      }

      return "value";
    })
  );

  const worksheetName = range.worksheet.name;
  const address = range.address;

  return {
    worksheetName,
    address,
    rowCount: rowLimit,
    columnCount: columnLimit,
    hasHeaders,
    headers,
    rows: dataValues as RangeSample["rows"],
    truncated: fullRowCount > rowLimit || fullColumnCount > columnLimit,
    formulas:
      includeFormulas && dataFormulas
        ? (dataFormulas as (string | null)[][])
        : undefined,
    kinds,
  } satisfies RangeSample;
};
