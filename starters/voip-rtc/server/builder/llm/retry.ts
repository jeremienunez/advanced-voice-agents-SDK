export function shouldRetryStatus(
  status: number,
  attempt: number,
  maxAttempts: number,
): boolean {
  if (attempt >= maxAttempts) return false;
  return status === 408 || status === 409 || status === 425 ||
    status === 429 || status >= 500;
}

export function shouldRetryError(
  error: unknown,
  attempt: number,
  maxAttempts: number,
): boolean {
  if (attempt >= maxAttempts) return false;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("EAI_AGAIN") ||
    message.includes("fetch failed") ||
    message.includes("socket connection was closed")
  );
}

export function retryDelayMs(attempt: number): number {
  return Math.min(4000, 500 * 2 ** (attempt - 1));
}
