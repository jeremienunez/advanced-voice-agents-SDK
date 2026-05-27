import type { DocumentIngestionInput } from "@voiceagentsdk/core/sdk";
import {
  asRecord,
  readNumber,
  readString,
} from "../utils/record-readers.js";
import {
  enforceContentLength,
  enforceDocumentPolicy,
  maxTextDocumentChars,
} from "./document-policy.js";

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
    enforceDocumentPolicy({
      name: file.name,
      mimeType: file.type || undefined,
      sizeBytes: file.size,
    });
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
  if (content.length > maxTextDocumentChars) {
    throw new Error(
      `Document content is too large; max ${maxTextDocumentChars} characters`,
    );
  }
  const name = readString(source, "name") || "document.txt";
  const mimeType = readString(source, "mimeType") || undefined;
  const sizeBytes = readNumber(source, "sizeBytes");
  enforceDocumentPolicy({ name, mimeType, sizeBytes });
  return {
    id: readString(source, "id") || undefined,
    name,
    mimeType,
    sizeBytes,
    content,
  };
}
