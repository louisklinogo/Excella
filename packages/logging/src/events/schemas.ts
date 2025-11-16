import { z } from "zod";

export const ToolCallSchema = z.object({
	tool: z.string().min(1),
	paramsSize: z.number().int().nonnegative().optional(),
	sampled: z.boolean().optional(),
	requestId: z.string().optional(),
});

export const ToolResultSchema = z.object({
	tool: z.string().min(1),
	resultSize: z.number().int().nonnegative().optional(),
	durationMs: z.number().nonnegative().optional(),
	status: z.enum(["ok", "error"]).optional(),
	requestId: z.string().optional(),
});

export const AiRequestStartSchema = z.object({
	provider: z.string().min(1),
	model: z.string().min(1),
	requestId: z.string().optional(),
	tokensBudget: z.number().int().positive().optional(),
});

export const AiRequestDoneSchema = z.object({
	provider: z.string().min(1),
	model: z.string().min(1),
	durationMs: z.number().nonnegative(),
	tokensIn: z.number().int().nonnegative().optional(),
	tokensOut: z.number().int().nonnegative().optional(),
	status: z.enum(["ok", "error", "timeout"]).default("ok"),
	requestId: z.string().optional(),
	error: z.string().optional(),
});

export const ExcelBatchSchema = z.object({
	action: z.string().min(1),
	rows: z.number().int().nonnegative().optional(),
	cols: z.number().int().nonnegative().optional(),
	chunks: z.number().int().nonnegative().optional(),
	durationMs: z.number().nonnegative().optional(),
	status: z.enum(["ok", "error", "timeout"]).optional(),
	requestId: z.string().optional(),
});

export const EventSchemas = {
	"tool.call": ToolCallSchema,
	"tool.result": ToolResultSchema,
	"ai.request.start": AiRequestStartSchema,
	"ai.request.done": AiRequestDoneSchema,
	"excel.batch": ExcelBatchSchema,
	"excel.batch.done": ExcelBatchSchema,
} as const;

export type KnownEvent = keyof typeof EventSchemas;

export const validateEvent = (event: string, payload: unknown): boolean => {
	if (process.env.EXCELLA_LOG_EVENTS_VALIDATE !== "true") return true;
	const schema = EventSchemas[event as KnownEvent];
	if (!schema) return true;
	const result = schema.safeParse(payload);
	return result.success;
};
