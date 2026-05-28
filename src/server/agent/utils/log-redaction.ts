const REDACTED = "[REDACTED]";

type RedactableLogContext = Record<string, unknown>;

const SECRET_FIELD_MARKERS = [
  "password",
  "token",
  "secret",
  "apikey",
  "authorization",
  "credential",
  "cookie",
  "pin",
];

const CONTENT_FIELD_NAMES = new Set([
  "prompt",
  "prompts",
  "message",
  "messages",
  "content",
  "text",
  "transcript",
  "input",
  "output",
]);

const CONTENT_PREVIEW_MARKERS = [
  "preview",
  "excerpt",
  "sample",
];

export function redactLogContext<T extends RedactableLogContext>(ctx: T): T {
  const redacted: RedactableLogContext = {};
  for (const [key, value] of Object.entries(ctx)) {
    redacted[key] = shouldRedactField(key) ? REDACTED : redactLogValue(value);
  }
  return redacted as T;
}

function redactLogValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactLogValue);
  if (!value || typeof value !== "object") return value;
  return redactLogContext(value as RedactableLogContext);
}

function shouldRedactField(key: string): boolean {
  const normalized = normalizeKey(key);
  return isSecretField(normalized) || isContentField(normalized);
}

function isSecretField(normalized: string): boolean {
  return SECRET_FIELD_MARKERS.some((marker) => normalized.includes(marker));
}

function isContentField(normalized: string): boolean {
  if (CONTENT_FIELD_NAMES.has(normalized)) return true;
  return (
    CONTENT_PREVIEW_MARKERS.some((marker) => normalized.includes(marker)) &&
    [...CONTENT_FIELD_NAMES].some((name) => normalized.includes(name))
  );
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}
