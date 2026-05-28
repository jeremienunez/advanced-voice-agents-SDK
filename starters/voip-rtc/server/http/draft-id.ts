export function readDraftId(value: unknown): string {
  return readBodyString(value, "draftId");
}

export function readBodyString(value: unknown, key: string): string {
  if (!value || typeof value !== "object") return "";
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}
