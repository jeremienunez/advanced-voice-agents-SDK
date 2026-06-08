import type { KnowledgeDocumentKind } from "@voiceagentsdk/core/sdk";

export function documentKind(
  name: string,
  mimeType?: string,
): KnowledgeDocumentKind {
  const lowerName = name.toLowerCase();
  const lowerMime = mimeType?.toLowerCase() ?? "";
  if (
    lowerName.endsWith(".xlsx") ||
    lowerMime ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  if (lowerName.endsWith(".xls") || lowerMime === "application/vnd.ms-excel") {
    return "xls";
  }
  if (
    lowerName.endsWith(".research.md") ||
    lowerMime === "text/x-web-research"
  ) {
    return "web_research";
  }
  if (lowerName.endsWith(".md") || lowerMime.includes("markdown")) return "md";
  if (lowerName.endsWith(".txt") || lowerMime.startsWith("text/")) return "txt";
  if (lowerName.endsWith(".pdf") || lowerMime === "application/pdf") {
    return "pdf";
  }
  return "unknown";
}
