import type { KnowledgeDocument } from "@voiceagentsdk/core/sdk";
import { documentKind } from "../domain/document-kind.js";
import { asRecord, readNumber, readString } from "../utils.js";

export function normalizeKnowledgeDocuments(
  body: unknown,
): KnowledgeDocument[] {
  const source = asRecord(body);
  const raw = Array.isArray(source.documents) ? source.documents : [];
  return raw.map((item): KnowledgeDocument => {
    const record = asRecord(item);
    const name = readString(record, "name") || "document.txt";
    const kind = documentKind(name, readString(record, "mimeType"));
    return {
      id: readString(record, "id") || `doc_${crypto.randomUUID()}`,
      name,
      kind,
      mimeType: readString(record, "mimeType") || undefined,
      sizeBytes: readNumber(record, "sizeBytes"),
      text: readString(record, "text") || undefined,
      status:
        readString(record, "status") === "unsupported"
          ? "unsupported"
          : kind === "pdf"
            ? "unsupported"
            : "parsed",
      error: readString(record, "error") || undefined,
      metadata: asRecord(record.metadata),
    };
  });
}
