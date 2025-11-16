import { AsyncLocalStorage } from "node:async_hooks";
import type { Fields, Logger } from "./types";

export interface RequestContextValue {
	bindings?: Fields;
	logger?: Logger;
	metadata?: Record<string, unknown>;
}

const storage = new AsyncLocalStorage<RequestContextValue>();

export const runWithContext = <T>(
	value: RequestContextValue,
	fn: () => T,
): T => storage.run(value, fn);

export const getContext = (): RequestContextValue | undefined =>
	storage.getStore();

export const setContextLogger = (logger: Logger): void => {
	const store = storage.getStore();
	if (store) {
		store.logger = logger;
	}
};
