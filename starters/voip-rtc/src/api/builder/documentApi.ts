import type { KnowledgeDocument } from "../../domain/builder/knowledge.js";
import { getJson } from "../http.js";

export function fetchKnowledgeDocument(
  apiBase: string,
  draftId: string,
  documentId: string,
) {
  return getJson<{ document: KnowledgeDocument }>(
    `${apiBase}/drafts/${encodeURIComponent(draftId)}/documents/${encodeURIComponent(documentId)}`,
  );
}
