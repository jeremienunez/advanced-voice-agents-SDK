export function readDraftId(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const draftId = (value as { draftId?: unknown }).draftId;
  return typeof draftId === "string" ? draftId.trim() : "";
}
