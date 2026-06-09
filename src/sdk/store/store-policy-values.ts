import type { StoreOperation, StorePolicyDefinition } from "../types/store.js";

const DEFAULT_OPERATIONS: StoreOperation[] = [
  "get",
  "list",
  "create",
  "update",
];

export function clone<T>(value: T): T {
  if (Array.isArray(value)) return [...value] as T;
  if (typeof value === "object" && value !== null) return { ...value };
  return value;
}

export function unique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

export function defaultPolicy(): StorePolicyDefinition {
  return {
    scope: "global",
    allowedOperations: [...DEFAULT_OPERATIONS],
    allowedFilterFields: [],
    allowedSortFields: [],
    allowedCreateFields: [],
    allowedUpdateFields: [],
    maxPageSize: 50,
  };
}

export function mergeFields(current: string[], next: string[]): string[] {
  return [...new Set([...current, ...next])];
}
