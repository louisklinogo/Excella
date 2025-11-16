import {
  type AgentMemoryRepository,
  type ContextManager,
  ContextUpdater,
  DefaultContextManager,
  type MetaProvider,
} from "@excella/core/excel/context-manager";
import type { ContextMeta } from "@excella/core/excel/context-snapshot";
import type {
  DataPreviewOptions,
  ExcelGateway,
} from "@excella/core/excel/excel-gateway";
import { DefaultSafetyConfigProvider } from "@excella/core/excel/safety-config";
import { OfficeJsDependencySummaryProvider } from "./dependency-summary-provider";
import { HiddenWorksheetMemoryRepository } from "./hidden-worksheet-memory-repository";
import { OfficeJsExcelGateway } from "./officejs-excel-gateway";

export interface ContextEnvironment {
  contextManager: ContextManager;
  contextUpdater: ContextUpdater;
  excelGateway: ExcelGateway;
  memoryRepository: AgentMemoryRepository;
}

export const createExcelContextEnvironment = (): ContextEnvironment => {
  const excelGateway: ExcelGateway = new OfficeJsExcelGateway();
  const memoryRepository: AgentMemoryRepository =
    new HiddenWorksheetMemoryRepository();
  const safetyConfigProvider = new DefaultSafetyConfigProvider();
  const dependencySummaryProvider = new OfficeJsDependencySummaryProvider();

  const metaProvider: MetaProvider = {
    async getMeta(): Promise<ContextMeta> {
      const now = new Date().toISOString();
      const snapshotId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const workbookName = "Workbook";

      return {
        snapshotId,
        snapshotVersion: 1,
        createdAt: now,
        workbookId: workbookName,
        workbookName,
      } satisfies ContextMeta;
    },
  };

  const previewOptions: DataPreviewOptions = {
    maxPrimaryRows: 50,
    maxPrimaryColumns: 20,
    maxSecondarySamples: 3,
    maxSecondaryRows: 20,
    maxSecondaryColumns: 10,
  };

  const contextManager = new DefaultContextManager(
    excelGateway,
    metaProvider,
    memoryRepository,
    safetyConfigProvider,
    previewOptions,
    dependencySummaryProvider
  );

  const contextUpdater = new ContextUpdater(memoryRepository);

  return {
    contextManager,
    contextUpdater,
    excelGateway,
    memoryRepository,
  };
};
