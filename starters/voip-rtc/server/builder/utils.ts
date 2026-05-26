export function parseJsonPayload<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return fallback;
    try {
      return JSON.parse(content.slice(start, end + 1)) as T;
    } catch {
      return fallback;
    }
  }
}

export function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export function listFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value !== "string") return [];
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readString(record: unknown, key: string): string {
  const value = asRecord(record)[key];
  return typeof value === "string" ? value.trim() : "";
}

export function readNumber(record: unknown, key: string): number | undefined {
  const value = asRecord(record)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readPositiveNumber(
  record: unknown,
  key: string,
): number | undefined {
  const value = asRecord(record)[key];
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }
  return undefined;
}

export function readChunkCount(value: unknown): number | undefined {
  const count = asRecord(value).chunkCount;
  return typeof count === "number" ? count : undefined;
}

export function readKnowledgeStoreId(value: unknown): string | undefined {
  return readString(value, "storeId") || undefined;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
