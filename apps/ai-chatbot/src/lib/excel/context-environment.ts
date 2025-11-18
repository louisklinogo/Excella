import {
  type AgentMemoryRepository,
  type ContextDetailOptions,
  type ContextManager,
  DefaultContextManager,
  type MetaProvider,
} from "@excella/core/excel/context-manager";
import { ContextUpdater } from "@excella/core/excel/context-updater";
import type {
  ContextMeta,
  ExcelContextSnapshot,
} from "@excella/core/excel/context-snapshot";
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

const isExcelHost = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  if (typeof Office === "undefined" || !Office.context) {
    // eslint-disable-next-line no-console
    console.log("[excel-context] Office.js not available; not in Excel host.");
    return false;
  }

  const host = Office.context.host;
  // eslint-disable-next-line no-console
  console.log("[excel-context] Detected Office host:", host);

  return host === Office.HostType.Excel;
};

export const tryGetExcelContextSnapshot = async (
  options?: ContextDetailOptions
): Promise<ExcelContextSnapshot | null> => {
  if (!isExcelHost()) {
    return null;
  }

  try {
    // eslint-disable-next-line no-console
    console.log("[excel-context] Building Excel context snapshot...");
    const { contextManager } = createExcelContextEnvironment();
    const snapshot = await contextManager.getSnapshot(options);
    // eslint-disable-next-line no-console
    console.log("[excel-context] Snapshot created.", {
      worksheetCount: snapshot.workbook.worksheetCount,
      hasSelection: snapshot.selection !== null,
    });
    return snapshot;
  } catch (error) {
    // eslint-disable-next-line no-console
    if (error && typeof error === "object") {
      const err = error as {
        name?: string;
        message?: string;
        code?: string;
        debugInfo?: unknown;
      };

      console.error("[excel-context] Failed to build snapshot", {
        name: err.name,
        message: err.message,
        code: err.code,
        debugInfo: err.debugInfo,
      });
    } else {
      console.error("[excel-context] Failed to build snapshot", error);
    }
    return null;
  }
};
