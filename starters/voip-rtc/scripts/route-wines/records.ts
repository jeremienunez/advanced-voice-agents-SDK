import type { JsonRecord } from "./types.js";

export function readPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    current = asRecord(current)[key];
  }
  return current;
}

export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null
    ? (value as JsonRecord)
    : {};
}

export function summarizeStepResult(value: unknown): JsonRecord {
  const record = asRecord(value);
  return {
    keys: Object.keys(record).slice(0, 12),
    draftId:
      readPath(record, ["draft", "id"]) ?? readPath(record, ["artifact", "draftId"]),
    status: record.status,
    result: record.result,
    documentKind: readPath(record, ["document", "kind"]),
    researchSpend: readPath(record, ["research", "spend"]),
  };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
