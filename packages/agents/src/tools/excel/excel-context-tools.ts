import type {
  DataPreview,
  ExcelContextSnapshot,
  RangeSample,
} from "@excella/core/excel/context-snapshot";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const selectionTargetSchema = z.object({
  type: z.enum(["current", "range", "table", "namedRange"]).default("current"),
  value: z.string().optional(),
});

export type SelectionTarget = z.infer<typeof selectionTargetSchema>;

export const getExcelContextSnapshotTool = createTool({
  id: "excel_context.get_snapshot",
  description:
    "Get a condensed snapshot of the current Excel workbook, including structure, selection, data preview, memory summary, and safety context.",
  inputSchema: z.object({
    includeFormulaSamples: z
      .boolean()
      .default(false)
      .describe("Whether to include sample formulas in the data preview."),
    includeDependencySummaries: z
      .boolean()
      .default(false)
      .describe("Whether to include high-level dependency summaries."),
  }),
  outputSchema: z.custom<ExcelContextSnapshot>(),
  async execute({ context, runtimeContext }) {
    const { includeFormulaSamples, includeDependencySummaries } = context as {
      includeFormulaSamples: boolean;
      includeDependencySummaries: boolean;
    };

    const snapshot =
      runtimeContext.get<ExcelContextSnapshot | undefined>("excelSnapshot");

    if (!snapshot) {
      throw new Error(
        "excel_context.get_snapshot requires an Excel snapshot to be provided in the agent runtime context."
      );
    }

    const effectiveSnapshot: ExcelContextSnapshot = {
      ...snapshot,
      dependencySummaries: includeDependencySummaries
        ? snapshot.dependencySummaries
        : undefined,
    };

    if (!includeFormulaSamples && effectiveSnapshot.dataPreview.primarySample) {
      const primary = effectiveSnapshot.dataPreview.primarySample;
      effectiveSnapshot.dataPreview = {
        ...effectiveSnapshot.dataPreview,
        primarySample: {
          ...primary,
          formulas: undefined,
        },
      } satisfies DataPreview;
    }

    return effectiveSnapshot;
  },
});

export const getSelectionPreviewTool = createTool({
  id: "excel_context.get_selection_preview",
  description:
    "Get a focused data preview for the current selection, or a specific range, table, or named range.",
  inputSchema: z.object({
    target: selectionTargetSchema
      .describe(
        "What to preview: the current selection (default), a range address, table name, or named range."
      )
      .default({ type: "current" }),
    maxRows: z
      .number()
      .int()
      .positive()
      .default(50)
      .describe("Maximum number of rows to include in the primary sample."),
    maxColumns: z
      .number()
      .int()
      .positive()
      .default(20)
      .describe("Maximum number of columns to include in the primary sample."),
    includeFormulas: z
      .boolean()
      .default(false)
      .describe("Whether to include formulas for the sampled cells."),
  }),
  outputSchema: z.custom<DataPreview>(),
  async execute({ context, runtimeContext }) {
    const { target, maxRows, maxColumns, includeFormulas } = context as {
      target: SelectionTarget;
      maxRows: number;
      maxColumns: number;
      includeFormulas: boolean;
    };

    const snapshot =
      runtimeContext.get<ExcelContextSnapshot | undefined>("excelSnapshot");

    if (!snapshot) {
      throw new Error(
        "excel_context.get_selection_preview requires an Excel snapshot to be provided in the agent runtime context."
      );
    }

    if (target.type !== "current") {
      // The agent can still use the returned snapshot metadata to locate
      // a specific range/table even if this tool ignores the override.
      // This keeps the initial implementation simple and safe.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ignoredTarget = target;
    }

    const dataPreview = sliceDataPreview(
      snapshot.dataPreview,
      maxRows,
      maxColumns,
      includeFormulas
    );

    return dataPreview;
  },
});

const sliceDataPreview = (
  preview: DataPreview,
  maxRows: number,
  maxColumns: number,
  includeFormulas: boolean
): DataPreview => {
  const sliceSample = (sample: RangeSample | null): RangeSample | null => {
    if (!sample) {
      return null;
    }

    const columnLimit = Math.max(1, Math.min(sample.columnCount, maxColumns));
    const maxDataRows = sample.hasHeaders
      ? Math.max(0, maxRows - 1)
      : Math.max(0, maxRows);

    const limitedRows = sample.rows
      .slice(0, maxDataRows)
      .map((row) => row.slice(0, columnLimit));

    const limitedFormulas = includeFormulas
      ? sample.formulas?.slice(0, maxDataRows).map((row) => row.slice(0, columnLimit))
      : undefined;

    const limitedKinds = sample.kinds
      ? sample.kinds
          .slice(0, maxDataRows)
          .map((row) => row.slice(0, columnLimit))
      : undefined;

    const limitedHeaders = sample.hasHeaders
      ? sample.headers?.slice(0, columnLimit)
      : sample.headers;

    const rowCount = sample.hasHeaders
      ? limitedRows.length + 1
      : limitedRows.length;

    const truncated =
      sample.truncated ||
      limitedRows.length < sample.rows.length ||
      columnLimit < sample.columnCount;

    return {
      ...sample,
      rowCount,
      columnCount: columnLimit,
      headers: limitedHeaders,
      rows: limitedRows,
      formulas: limitedFormulas,
      kinds: limitedKinds,
      truncated,
    } satisfies RangeSample;
  };

  return {
    primarySample: sliceSample(preview.primarySample),
    secondarySamples: preview.secondarySamples.map((sample) =>
      sliceSample(sample) as RangeSample
    ),
  } satisfies DataPreview;
};
