import type { Fields } from "./core/types";

export function serializeError(err: unknown): Fields {
	if (!err) return { message: "unknown" } satisfies Fields;
	if (err instanceof Error) {
		const extra = err as Error & {
			data?: unknown;
			responseBody?: unknown;
		};
		const data = extra.data ?? extra.responseBody ?? undefined;
		return {
			name: err.name,
			message: err.message,
			stack: err.stack,
			...(data ? { data } : {}),
		} satisfies Fields;
	}
	try {
		return { message: String(err) } satisfies Fields;
	} catch {
		return { message: "unknown" } satisfies Fields;
	}
}
