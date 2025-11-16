import type {
  DataPreview,
  SelectionContext,
  WorkbookContext,
} from "./context-snapshot";

export interface DataPreviewOptions {
  maxPrimaryRows: number;
  maxPrimaryColumns: number;
  maxSecondarySamples: number;
  maxSecondaryRows: number;
  maxSecondaryColumns: number;
}

export interface ExcelGateway {
  getWorkbookStructure(): Promise<WorkbookContext>;
  getCurrentSelection(): Promise<SelectionContext | null>;
  getDataPreview(
    selection: SelectionContext | null,
    options: DataPreviewOptions,
    includeFormulas?: boolean
  ): Promise<DataPreview>;
}
