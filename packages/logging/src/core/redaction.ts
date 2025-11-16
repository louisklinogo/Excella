export interface RedactionOptions {
	redactKeys: string[];
	mask?: string;
}

export const shouldRedact = (
	keyPath: string,
	options: RedactionOptions,
): boolean => {
	const lower = keyPath.toLowerCase();
	return options.redactKeys.some((key) => lower.includes(key));
};
