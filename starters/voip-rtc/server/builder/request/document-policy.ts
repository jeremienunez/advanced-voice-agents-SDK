import type { KnowledgeDocumentKind } from "@voiceagentsdk/core/sdk";
import { documentKind } from "../domain/document-kind.js";

export const maxUploadBytes = 8 * 1024 * 1024;
export const maxTextDocumentChars = 1_000_000;

const allowedKinds = new Set<KnowledgeDocumentKind>([
  "txt",
  "md",
  "pdf",
  "xlsx",
  "web_research",
]);

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/markdown",
  "text/plain",
  "text/x-markdown",
  "text/x-web-research",
]);

export function enforceContentLength(request: Request): void {
  const raw = request.headers.get("content-length");
  if (!raw) throw new Error("content-length is required for document uploads");
  const bytes = Number(raw);
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new Error("content-length must be a valid byte count");
  }
  if (bytes > maxUploadBytes) {
    throw new Error(`Request body is too large; max ${maxUploadBytes} bytes`);
  }
}

export function enforceDocumentPolicy(input: {
  name: string;
  mimeType?: string;
  sizeBytes?: number;
}): void {
  if (input.sizeBytes && input.sizeBytes > maxUploadBytes) {
    throw new Error(`Uploaded file is too large; max ${maxUploadBytes} bytes`);
  }
  const mime = normalizedMime(input.mimeType);
  const kind = documentKind(input.name, mime);
  if (!allowedKinds.has(kind) || (mime && !allowedMimeTypes.has(mime))) {
    throw new Error(`Document type is not allowed: ${input.name}`);
  }
}

function normalizedMime(mimeType: string | undefined): string | undefined {
  return mimeType?.split(";")[0]?.trim().toLowerCase() || undefined;
}
