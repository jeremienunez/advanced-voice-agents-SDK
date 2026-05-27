import type {
  DocumentIngestionInput,
  DocumentIngestionPort,
  KnowledgeDocument,
} from "@voiceagentsdk/core/sdk";
import { documentKind } from "./domain/document-kind.js";

export interface TimedDocumentIngestionInput {
  ingestion: DocumentIngestionPort;
  input: DocumentIngestionInput;
  timeoutMs: number;
}

export async function parseDocumentWithTimeout({
  ingestion,
  input,
  timeoutMs,
}: TimedDocumentIngestionInput): Promise<KnowledgeDocument> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return ingestion.parse(input);
  }

  const controller = new AbortController();
  const timeoutDocument = failedTimeoutDocument(input, timeoutMs);
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const parsed = ingestion.parse(input, { signal: controller.signal }).then(
    (document) => ({ status: "parsed" as const, document }),
    (error) => {
      if (timedOut) return { status: "timeout" as const, document: timeoutDocument };
      throw error;
    },
  );
  const timeoutResult = new Promise<{ status: "timeout"; document: KnowledgeDocument }>(
    (resolve) => {
      timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
        resolve({ status: "timeout", document: timeoutDocument });
      }, timeoutMs);
    },
  );

  try {
    return (await Promise.race([parsed, timeoutResult])).document;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function failedTimeoutDocument(
  input: DocumentIngestionInput,
  timeoutMs: number,
): KnowledgeDocument {
  return {
    id: input.id ?? `doc_${crypto.randomUUID()}`,
    name: input.name,
    kind: documentKind(input.name, input.mimeType),
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    status: "failed",
    error: `Document parsing timed out after ${timeoutMs}ms`,
    metadata: {
      failureReason: "parser_timeout",
      parserTimeoutMs: timeoutMs,
    },
  };
}
