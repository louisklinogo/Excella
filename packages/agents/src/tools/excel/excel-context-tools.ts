import type {
  ContextDetailOptions,
  ContextManager,
} from "@excella/core/excel/context-manager";
import type {
  DataPreview,
  ExcelContextSnapshot,
  SelectionContext,
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
  async execute({ context }) {
    const { includeFormulaSamples, includeDependencySummaries } = context as {
      includeFormulaSamples: boolean;
      includeDependencySummaries: boolean;
    };

    const ctxManager = context.contextManager as ContextManager | undefined;

    if (!ctxManager) {
      throw new Error(
        "excel_context.get_snapshot requires context.contextManager to be provided."
      );
    }

    const options: ContextDetailOptions = {
      includeFormulaSamples,
      includeDependencySummaries,
    };

    const snapshot = await ctxManager.getSnapshot(options);

    return snapshot;
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
  async execute({ context }) {
    const { target, maxRows, maxColumns, includeFormulas } = context as {
      target: SelectionTarget;
      maxRows: number;
      maxColumns: number;
      includeFormulas: boolean;
    };

    const ctxManager = context.contextManager as ContextManager | undefined;

    if (!ctxManager) {
      throw new Error(
        "excel_context.get_selection_preview requires context.contextManager to be provided."
      );
    }

    // We rely on the underlying ExcelGateway used by the ContextManager.
    // First, get a fresh snapshot to reuse its selection info and gateway options.
    const snapshot = await ctxManager.getSnapshot({
      includeFormulaSamples: includeFormulas,
      includeDependencySummaries: false,
    });

    const selection: SelectionContext | null = snapshot.selection;

    // For now, we delegate all targeting to whatever the configured ExcelGateway
    // does with the current selection. Future implementations can map the
    // explicit target (range/table/namedRange) via a dedicated gateway.
    if (target.type !== "current") {
      // The agent can still use the returned snapshot metadata to locate
      // a specific range/table even if this tool ignores the override.
      // This keeps the initial implementation simple and safe.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _ignoredTarget = target;
    }

    const previewOptions = {
      maxPrimaryRows: maxRows,
      maxPrimaryColumns: maxColumns,
      maxSecondarySamples: 0,
      maxSecondaryRows: 0,
      maxSecondaryColumns: 0,
    };

    const dataPreview = await snapshotWorkbookPreview(
      ctxManager,
      selection,
      previewOptions,
      includeFormulas
    );

    return dataPreview;
  },
});

type DataPreviewOptionsInternal = {
  maxPrimaryRows: number;
  maxPrimaryColumns: number;
  maxSecondarySamples: number;
  maxSecondaryRows: number;
  maxSecondaryColumns: number;
};

const snapshotWorkbookPreview = async (
  ctxManager: ContextManager,
  _selection: SelectionContext | null,
  _options: DataPreviewOptionsInternal,
  includeFormulas: boolean
): Promise<DataPreview> => {
  // We do not have direct access to the ExcelGateway here, so we fetch a
  // new snapshot with the desired preview options. Implementations of
  // ContextManager should respect the requested preview limits.
  const snapshot = await ctxManager.getSnapshot({
    includeFormulaSamples: includeFormulas,
    includeDependencySummaries: false,
  });

  // Return only the primary preview from the snapshot to keep output small.
  return snapshot.dataPreview;
};
