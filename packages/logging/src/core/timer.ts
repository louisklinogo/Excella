export interface Timer {
  start: number;
}

export const startTimer = (): Timer => ({ start: Date.now() });

export const withTimer = async <T>(
  fn: () => Promise<T> | T
): Promise<{ durationMs: number; result: T }> => {
  const start = Date.now();
  const result = await fn();
  const durationMs = Date.now() - start;
  return { durationMs, result };
};
