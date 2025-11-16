import type { LogEntry } from "./types";

export interface BufferOptions {
	enabled: boolean;
	limit: number;
}

const buffer: LogEntry[] = [];

export const pushToBuffer = (
	entry: LogEntry,
	options: BufferOptions,
): void => {
	if (!options.enabled) return;
	buffer.push(entry);
	if (buffer.length > options.limit) {
		buffer.shift();
	}
};

export const getLogBuffer = (): LogEntry[] => buffer.slice();

export const clearLogBuffer = (): void => {
	buffer.length = 0;
};
