import type {
  AgentMemory,
  ContextMeta,
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
    selection: SelectionContext | null,
  ): Promise<SafetyContext>;
}

export interface ContextManager {
  getSnapshot(): Promise<ExcelContextSnapshot>;
}

export class DefaultContextManager implements ContextManager {
  private readonly excelGateway: ExcelGateway;
  private readonly metaProvider: MetaProvider;
  private readonly memoryRepository: AgentMemoryRepository;
  private readonly safetyConfigProvider: SafetyConfigProvider;
  private readonly previewOptions: DataPreviewOptions;

  constructor(
    excelGateway: ExcelGateway,
    metaProvider: MetaProvider,
    memoryRepository: AgentMemoryRepository,
    safetyConfigProvider: SafetyConfigProvider,
    previewOptions: DataPreviewOptions,
  ) {
    this.excelGateway = excelGateway;
    this.metaProvider = metaProvider;
    this.memoryRepository = memoryRepository;
    this.safetyConfigProvider = safetyConfigProvider;
    this.previewOptions = previewOptions;
  }

  async getSnapshot(): Promise<ExcelContextSnapshot> {
    const [meta, workbook, selection] = await Promise.all([
      this.metaProvider.getMeta(),
      this.excelGateway.getWorkbookStructure(),
      this.excelGateway.getCurrentSelection(),
    ]);

    const [dataPreview, memory, safety] = await Promise.all([
      this.excelGateway.getDataPreview(selection, this.previewOptions),
      this.memoryRepository.load(meta.workbookId),
      this.safetyConfigProvider.buildSafetyContext(
        meta.workbookId,
        workbook,
        selection,
      ),
    ]);

    return {
      meta,
      workbook,
      selection,
      dataPreview,
      memory,
      safety,
    } satisfies ExcelContextSnapshot;
  }
}
