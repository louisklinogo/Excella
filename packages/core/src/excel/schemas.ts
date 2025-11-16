import { z } from "zod";

export const AgentActionLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  description: z.string(),
  targetRange: z.string().optional(),
  targetWorksheet: z.string().optional(),
  kind: z.string(),
  status: z.enum(["success", "failed", "partial"]),
});

export const AgentErrorLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  message: z.string(),
  operation: z.string().optional(),
  details: z.string().optional(),
});

export const AgentNoteSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  text: z.string(),
  importance: z.enum(["low", "medium", "high"]),
});

export const AgentMemorySchema = z.object({
  recentActions: z.array(AgentActionLogEntrySchema),
  recentErrors: z.array(AgentErrorLogEntrySchema),
  notes: z.array(AgentNoteSchema),
});

export type AgentMemoryDto = z.infer<typeof AgentMemorySchema>;
