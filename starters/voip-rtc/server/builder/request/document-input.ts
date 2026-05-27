import type { DocumentIngestionInput } from "@voiceagentsdk/core/sdk";
import { asRecord, readNumber, readString } from "../utils.js";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_DOCUMENT_CHARS = 1_000_000;

export async function readDocumentInput(
  request: Request,
): Promise<DocumentIngestionInput> {
  enforceContentLength(request);
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Error("FormData upload requires a file field");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`Uploaded file is too large; max ${MAX_UPLOAD_BYTES} bytes`);
    }
    return {
      id: readString(Object.fromEntries(form), "id") || undefined,
      name: file.name,
      mimeType: file.type || undefined,
      sizeBytes: file.size,
      content: await file.arrayBuffer(),
    };
  }

  const body = await request.json();
  return normalizeDocumentInput(body);
}

export function normalizeDocumentInput(
  body: unknown,
): DocumentIngestionInput {
  const source = asRecord(body);
  const content = readString(source, "content");
  if (content.length > MAX_TEXT_DOCUMENT_CHARS) {
    throw new Error(
      `Document content is too large; max ${MAX_TEXT_DOCUMENT_CHARS} characters`,
    );
  }
  return {
    id: readString(source, "id") || undefined,
    name: readString(source, "name") || "document.txt",
    mimeType: readString(source, "mimeType") || undefined,
    sizeBytes: readNumber(source, "sizeBytes"),
    content,
  };
}

function enforceContentLength(request: Request): void {
  const raw = request.headers.get("content-length");
  if (!raw) return;
  const bytes = Number(raw);
  if (Number.isFinite(bytes) && bytes > MAX_UPLOAD_BYTES) {
    throw new Error(`Request body is too large; max ${MAX_UPLOAD_BYTES} bytes`);
  }
}
