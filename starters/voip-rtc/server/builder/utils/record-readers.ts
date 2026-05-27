export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
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
