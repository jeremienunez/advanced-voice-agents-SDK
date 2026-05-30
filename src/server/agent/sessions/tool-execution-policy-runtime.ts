import type { VoiceSessionTool } from "../types/session.types.js";

export function timeoutMs(tool: VoiceSessionTool, fallback: number | undefined): number {
  const configured = tool.policy?.timeoutMs ?? fallback ?? 10_000;
  return Number.isFinite(configured) && configured > 0 ? configured : 10_000;
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  toolName: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Tool "${toolName}" timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? redactString(value) : value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      shouldRedactKey(key) ? "[REDACTED]" : redact(item),
    ]),
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function redactString(value: string): string {
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
}

function shouldRedactKey(key: string): boolean {
  return /api[_-]?key|authorization|bearer|password|secret|token/i.test(key);
}
