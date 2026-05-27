import { asRecord, readString } from "./record-readers.js";

export function readChunkCount(value: unknown): number | undefined {
  const count = asRecord(value).chunkCount;
  return typeof count === "number" ? count : undefined;
}

export function readKnowledgeStoreId(value: unknown): string | undefined {
  return readString(value, "storeId") || undefined;
}
