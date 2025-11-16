import type { AgentMemoryRepository } from "@excella/core/excel/context-manager";
import type { AgentMemory } from "@excella/core/excel/context-snapshot";
import { AgentMemorySchema } from "@excella/core/excel/schemas";

const SHEET_NAME = "_AI_CONTEXT";
const CELL_ADDRESS = "A1";

export class HiddenWorksheetMemoryRepository implements AgentMemoryRepository {
  async load(_workbookId: string): Promise<AgentMemory> {
    return Excel.run(async (context) => {
      const workbook = context.workbook;
      const sheet = workbook.worksheets.getItemOrNullObject(SHEET_NAME);
      sheet.load(["name", "visibility"]);
      await context.sync();

      if (sheet.isNullObject) {
        return createEmptyMemory();
      }

      const range = sheet.getRange(CELL_ADDRESS);
      range.load(["values"]);
      await context.sync();

      const raw = range.values?.[0]?.[0];
      if (typeof raw !== "string" || raw.trim() === "") {
        return createEmptyMemory();
      }

      try {
        const parsed = JSON.parse(raw) as unknown;
        const result = AgentMemorySchema.safeParse(parsed);
        if (!result.success) {
          return createEmptyMemory();
        }
        return result.data;
      } catch {
        return createEmptyMemory();
      }
    });
  }

  async save(_workbookId: string, memory: AgentMemory): Promise<void> {
    const json = JSON.stringify(memory);

    await Excel.run(async (context) => {
      const workbook = context.workbook;
      let sheet = workbook.worksheets.getItemOrNullObject(SHEET_NAME);
      sheet.load(["name", "visibility"]);
      await context.sync();

      if (sheet.isNullObject) {
        sheet = workbook.worksheets.add(SHEET_NAME);
        sheet.visibility = Excel.SheetVisibility.veryHidden;
      }

      const range = sheet.getRange(CELL_ADDRESS);
      range.values = [[json]];
      await context.sync();
    });
  }
}

const createEmptyMemory = (): AgentMemory => ({
  recentActions: [],
  recentErrors: [],
  notes: [],
});
