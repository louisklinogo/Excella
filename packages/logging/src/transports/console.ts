import type { LoggerConfig } from "../config";
import type { LogEntry, Transport } from "../core/types";

const colorByLevel: Record<LogEntry["level"], string> = {
	debug: "\x1b[36m",
	info: "\x1b[32m",
	warn: "\x1b[33m",
	error: "\x1b[31m",
};

const reset = "\x1b[0m";

const formatLine = (entry: LogEntry, config: LoggerConfig): string => {
	const color = colorByLevel[entry.level];
	const base = {
		service: config.serviceName,
		...entry.bindings,
		...(entry.data ?? {}),
	} as Record<string, unknown>;
	const json = JSON.stringify(base);
	return `${entry.timestamp} ${color}${entry.level.toUpperCase()}${reset} ${entry.event} ${json}`;
};

export const createConsoleTransport = (
	config: LoggerConfig,
): Transport => ({
	log(entry) {
		const line = formatLine(entry, config);
		const method =
			entry.level === "error"
				? console.error
				: entry.level === "warn"
					? console.warn
					: console.log;
		method(line);
	},
});
