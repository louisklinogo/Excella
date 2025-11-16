import type { AgentMemoryRepository } from "./context-manager";
import type {
  AgentActionLogEntry,
  AgentErrorLogEntry,
  AgentMemory,
  ExcelContextSnapshot,
} from "./context-snapshot";

export interface ContextUpdateInput {
  previousSnapshot: ExcelContextSnapshot;
  executedAction: AgentActionLogEntry;
  error?: AgentErrorLogEntry;
}

export class ContextUpdater {
  private readonly memoryRepository: AgentMemoryRepository;

  constructor(memoryRepository: AgentMemoryRepository) {
    this.memoryRepository = memoryRepository;
  }

  async applyActionUpdate(input: ContextUpdateInput): Promise<AgentMemory> {
    const { previousSnapshot, executedAction, error } = input;
    const currentMemory = previousSnapshot.memory;

    const recentActions = [
      executedAction,
      ...currentMemory.recentActions,
    ].slice(0, 20);

    const recentErrors = error
      ? [error, ...currentMemory.recentErrors].slice(0, 20)
      : currentMemory.recentErrors;

    const updatedMemory: AgentMemory = {
      ...currentMemory,
      recentActions,
      recentErrors,
    };

    await this.memoryRepository.save(
      previousSnapshot.meta.workbookId,
      updatedMemory
    );

    return updatedMemory;
  }
}
