import type {
  AgentBuilderLlmProvider,
  AgentBuilderIdentity,
  AgentBuildDraft,
  DocumentIngestionInput,
  KnowledgeDocument,
  ToolName,
} from "@voiceagentsdk/core/sdk";
import { documentKind } from "./domain/document-kind.js";
import {
  asRecord,
  listFromUnknown,
  readNumber,
  readString,
} from "./utils.js";

const BUILDER_LLM_PROVIDERS = new Set([
  "deepseek",
  "openai",
  "gemini",
  "anthropic",
  "custom",
]);
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_DOCUMENT_CHARS = 1_000_000;

export function normalizeIdentity(
  body: unknown,
  defaultModel: string,
): AgentBuilderIdentity {
  const source = asRecord(body).identity
    ? asRecord(asRecord(body).identity)
    : asRecord(body);
  const builderFirstName = readString(source, "builderFirstName");
  const builderLastName = readString(source, "builderLastName");
  const publicAgentName = readString(source, "publicAgentName");
  const intent = readString(source, "intent");
  const missing = [
    ["builderFirstName", builderFirstName],
    ["builderLastName", builderLastName],
    ["publicAgentName", publicAgentName],
    ["intent", intent],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required builder fields: ${missing.join(", ")}`);
  }

  return {
    builderFirstName,
    builderLastName,
    publicAgentName,
    intent,
    mustDo: listFromUnknown(source.mustDo),
    mustNotDo: listFromUnknown(source.mustNotDo),
    llmProvider: normalizeLlmProvider(readString(source, "llmProvider")),
    llmModel: readString(source, "llmModel") || defaultModel,
  };
}

export function normalizeResearchSettings(body: unknown): {
  provider: string;
  model: string;
  verifierProvider?: string;
  verifierModel?: string;
  verificationPasses?: number;
} {
  const source = asRecord(asRecord(body).research ?? {});
  return {
    provider: readString(source, "provider") || "deepseek",
    model: readString(source, "model"),
    verifierProvider: readString(source, "verifierProvider") || undefined,
    verifierModel: readString(source, "verifierModel") || undefined,
    verificationPasses: readNumber(source, "verificationPasses"),
  };
}

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

export function normalizeSelectedTools(
  body: unknown,
  draft: AgentBuildDraft,
): ToolName[] {
  const source = asRecord(body);
  if (!Array.isArray(source.selectedTools)) return draft.selectedTools;
  const available = new Set(draft.toolRegistry.map((item) => item.name));
  return source.selectedTools
    .filter((item): item is string => typeof item === "string")
    .filter((item) => available.has(item));
}

function normalizeLlmProvider(value: string): AgentBuilderLlmProvider {
  return BUILDER_LLM_PROVIDERS.has(value)
    ? (value as AgentBuilderLlmProvider)
    : "deepseek";
}

function enforceContentLength(request: Request): void {
  const raw = request.headers.get("content-length");
  if (!raw) return;
  const bytes = Number(raw);
  if (Number.isFinite(bytes) && bytes > MAX_UPLOAD_BYTES) {
    throw new Error(`Request body is too large; max ${MAX_UPLOAD_BYTES} bytes`);
  }
}
