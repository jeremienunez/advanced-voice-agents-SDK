export function copy<T>(value: T): T {
  if (Array.isArray(value)) return [...value] as T;
  if (typeof value === "object" && value !== null) return { ...value };
  return value;
}

export function assertUnique(ids: string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${label}: ${id}`);
    seen.add(id);
  }
}
