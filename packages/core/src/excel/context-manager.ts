import type {
  AgentMemory,
  ContextMeta,
  DataPreview,
  DependencySummary,
  ExcelContextSnapshot,
  SafetyContext,
  SelectionContext,
  WorkbookContext,
} from "./context-snapshot";
import type { DataPreviewOptions, ExcelGateway } from "./excel-gateway";

export interface MetaProvider {
  getMeta(): Promise<ContextMeta>;
}

export interface AgentMemoryRepository {
  load(workbookId: string): Promise<AgentMemory>;
  save(workbookId: string, memory: AgentMemory): Promise<void>;
}

export interface SafetyConfigProvider {
  buildSafetyContext(
    workbookId: string,
    workbook: WorkbookContext,
    selection: SelectionContext | null
  ): Promise<SafetyContext>;
}

export interface ContextDetailOptions {
  includeFormulaSamples?: boolean;
  includeDependencySummaries?: boolean;
}

export interface DependencySummaryProvider {
  buildDependencySummaries(
    workbook: WorkbookContext,
    dataPreview: DataPreview
  ): Promise<DependencySummary[]>;
}

export interface ContextManager {
  getSnapshot(options?: ContextDetailOptions): Promise<ExcelContextSnapshot>;
}

export class DefaultContextManager implements ContextManager {
  private readonly excelGateway: ExcelGateway;
  private readonly metaProvider: MetaProvider;
  private readonly memoryRepository: AgentMemoryRepository;
  private readonly safetyConfigProvider: SafetyConfigProvider;
  private readonly previewOptions: DataPreviewOptions;
  private readonly dependencySummaryProvider?: DependencySummaryProvider;

  constructor(
    excelGateway: ExcelGateway,
    metaProvider: MetaProvider,
    memoryRepository: AgentMemoryRepository,
    safetyConfigProvider: SafetyConfigProvider,
    previewOptions: DataPreviewOptions,
    dependencySummaryProvider?: DependencySummaryProvider
  ) {
    this.excelGateway = excelGateway;
    this.metaProvider = metaProvider;
    this.memoryRepository = memoryRepository;
    this.safetyConfigProvider = safetyConfigProvider;
    this.previewOptions = previewOptions;
    this.dependencySummaryProvider = dependencySummaryProvider;
  }

  async getSnapshot(
    options?: ContextDetailOptions
  ): Promise<ExcelContextSnapshot> {
    const [meta, workbook, selection] = await Promise.all([
      this.metaProvider.getMeta(),
      this.excelGateway.getWorkbookStructure(),
      this.excelGateway.getCurrentSelection(),
    ]);

    const [dataPreview, memory, safety] = await Promise.all([
      this.excelGateway.getDataPreview(
        selection,
        this.previewOptions,
        options?.includeFormulaSamples
      ),
      this.memoryRepository.load(meta.workbookId),
      this.safetyConfigProvider.buildSafetyContext(
        meta.workbookId,
        workbook,
        selection
      ),
    ]);

    const snapshot: ExcelContextSnapshot = {
      meta,
      workbook,
      selection,
      dataPreview,
      memory,
      safety,
    };

    if (options?.includeDependencySummaries && this.dependencySummaryProvider) {
      const summaries =
        await this.dependencySummaryProvider.buildDependencySummaries(
          workbook,
          dataPreview
        );
      snapshot.dependencySummaries = summaries;
    }

    return snapshot satisfies ExcelContextSnapshot;
  }
}
