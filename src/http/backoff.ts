// Exponential backoff with full jitter (ADR-0010).

export type Backoff = (attempt: number) => number;

export const expoBackoff =
  (baseMs = 200, maxMs = 8_000): Backoff =>
  (attempt) =>
    Math.floor(Math.random() * Math.min(maxMs, baseMs * 2 ** attempt));
