import { randomUUID } from "node:crypto";
import type { Logger } from "../core/types";
import {
	getCurrentConfig,
	getRequestContext,
	withRequestContext,
} from "../index";

interface RequestLike {
	headers?: Headers | { get(name: string): string | null | undefined };
	method?: string;
	url?: string;
	nextUrl?: { pathname?: string };
	path?: string;
}

export interface RequestContextResult {
	requestId: string;
	logger: Logger;
}

const getHeader = (req: RequestLike, name: string): string | undefined => {
	if (!req.headers) return undefined;
	const value =
		req.headers instanceof Headers
			? req.headers.get(name)
			: req.headers.get(name);
	return value ?? undefined;
};

export const seedRequestContext = <T>(
	req: RequestLike,
	handler: (context: RequestContextResult) => Promise<T> | T,
): Promise<T> | T => {
	const config = getCurrentConfig();
	const correlationHeader = config.correlationHeader;
	const headerValue = getHeader(req, correlationHeader);
	const requestId = headerValue ?? randomUUID();
	const path =
		req.nextUrl?.pathname ??
		req.path ??
		(req.url ? new URL(req.url).pathname : undefined);
	const method = req.method ?? "GET";
	const bindings = { requestId, path, method } as const;
	return withRequestContext(
		bindings,
		(logger) => handler({ requestId, logger }),
		bindings,
	);
};

export const getRequestId = (): string | undefined => {
	return getRequestContext()?.bindings?.requestId as string | undefined;
};
