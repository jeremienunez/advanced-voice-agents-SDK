import type {
  DocumentIngestionInput,
  DocumentIngestionPort,
  KnowledgeDocument,
} from "@voiceagentsdk/core/sdk";
import { documentKind } from "./domain/document-kind.js";
import type { BuilderRequestContext } from "./types.js";
import type { DocumentIngestionQuotaPort } from "./quotas/document-ingestion-quota.js";
import { readDocumentInput } from "./request/document-input.js";

export interface DocumentIngestionWorkflowInput {
  context: BuilderRequestContext;
  deps: DocumentIngestionWorkflowDependencies;
  request: Request;
}

export interface DocumentIngestionWorkflowDependencies {
  documentIngestionQuota: DocumentIngestionQuotaPort;
  documentParseTimeoutMs: number;
  ingestion: DocumentIngestionPort;
}

export async function ingestDocumentWithGuards({
  context,
  deps,
  request,
}: DocumentIngestionWorkflowInput): Promise<{ document: KnowledgeDocument }> {
  const quota = deps.documentIngestionQuota.consume({
    clientIp: context.clientIp,
  });
  if (!quota.allowed) {
    throw new Error(
      `Document ingestion quota exceeded; retry after ${quota.retryAfterMs ?? 0}ms`,
    );
  }
  const documentInput = await readDocumentInput(request);
  const document = await parseDocumentWithTimeout({
    ingestion: deps.ingestion,
    input: documentInput,
    timeoutMs: deps.documentParseTimeoutMs,
  });
  return { document };
}

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
