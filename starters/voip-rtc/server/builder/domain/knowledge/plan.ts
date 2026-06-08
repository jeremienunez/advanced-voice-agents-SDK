import type {
  AgentBuildDraft,
  KnowledgeBuildPlan,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeStrategy,
} from "@voiceagentsdk/core/sdk";
import { strategyLabels } from "../../catalog.js";

export function fallbackKnowledgePlan(
  draft: AgentBuildDraft,
  documents: KnowledgeDocument[],
): KnowledgeBuildPlan {
  const hasPdf = documents.some((document) => document.kind === "pdf");
  const wantsGraph =
    /relation|entit|process|procedure|contrat|policy|regle|workflow/i.test(
      draft.identity.intent,
    );
  const strategy = wantsGraph ? "hybrid_kg" : "hybrid";
  return {
    strategy,
    alternativeStrategies: wantsGraph
      ? ["hybrid", "kg", "vector"]
      : ["vector", "lexical", "hybrid_kg"],
    documents: documents.map((document) => ({
      ...document,
      status: document.status === "parsed" ? "planned" : document.status,
    })),
    chunking: {
      method: "semantic",
      targetTokens: 420,
      overlapTokens: 72,
      rationale: "Voice answers need compact chunks with enough overlap for citations.",
    },
    indexes: [
      {
        id: "chunks_embedding_hnsw",
        kind: "vector",
        fields: ["embedding"],
        metric: "cosine",
        dimensions: 1024,
        implementation: "pgvector hnsw",
      },
      {
        id: "chunks_fts",
        kind: "lexical",
        fields: ["content"],
        implementation: "Postgres generated tsvector + GIN",
      },
    ],
    kg: {
      enabled: wantsGraph,
      entityTypes: wantsGraph
        ? ["person", "organization", "concept", "process"]
        : [],
      relationTypes: wantsGraph
        ? ["owns", "requires", "depends_on", "mentions"]
        : [],
      rationale: wantsGraph
        ? "Intent suggests explicit entities and relations."
        : "KG not required for first retrieval pass.",
    },
    reasons: [
      "Hybrid retrieval keeps lexical precision and vector recall.",
      "Postgres FTS is used for lexical v1; BM25 exact needs a dedicated adapter later.",
      ...(hasPdf ? ["PDF upload accepted, but parser adapter is still required."] : []),
    ],
    validationRequired: true,
    warnings: hasPdf
      ? ["PDF parsing is not active in this starter without a parser adapter."]
      : [],
  };
}

export function normalizeKnowledgePlan(
  plan: KnowledgeBuildPlan,
  inputDocuments: KnowledgeDocument[],
  fallback: KnowledgeBuildPlan,
): KnowledgeBuildPlan {
  const strategy = isKnowledgeStrategy(plan.strategy)
    ? plan.strategy
    : fallback.strategy;
  const alternativeStrategies = Array.isArray(plan.alternativeStrategies)
    ? plan.alternativeStrategies.filter(isKnowledgeStrategy)
    : fallback.alternativeStrategies;
  const documents = mergePlannedKnowledgeDocuments(
    plan.documents,
    inputDocuments,
  );

  return {
    ...fallback,
    ...plan,
    strategy,
    alternativeStrategies,
    documents,
    chunking: plan.chunking ?? fallback.chunking,
    indexes: Array.isArray(plan.indexes) ? plan.indexes : fallback.indexes,
    kg: plan.kg ?? fallback.kg,
    reasons: Array.isArray(plan.reasons) ? plan.reasons : fallback.reasons,
    validationRequired:
      typeof plan.validationRequired === "boolean"
        ? plan.validationRequired
        : fallback.validationRequired,
    warnings: Array.isArray(plan.warnings) ? plan.warnings : fallback.warnings,
  };
}

export function chunkDocuments(
  documents: KnowledgeDocument[],
  plan?: KnowledgeBuildPlan,
): KnowledgeChunk[] {
  const targetTokens = plan?.chunking.targetTokens ?? 420;
  const overlapTokens = plan?.chunking.overlapTokens ?? 72;
  const targetChars = Math.max(600, targetTokens * 4);
  const overlapChars = Math.max(0, overlapTokens * 4);
  const chunks: KnowledgeChunk[] = [];

  for (const document of documents) {
    if (!document.text) continue;
    let offset = 0;
    let ordinal = 0;
    while (offset < document.text.length) {
      const text = document.text.slice(offset, offset + targetChars).trim();
      if (text) {
        chunks.push({
          id: `chunk_${document.id}_${ordinal}`,
          documentId: document.id,
          ordinal,
          text,
          tokenEstimate: Math.ceil(text.length / 4),
          metadata: { documentName: document.name, kind: document.kind },
        });
      }
      ordinal += 1;
      offset += targetChars - overlapChars;
    }
  }

  if (chunks.length === 0) {
    throw new Error("No parsable document chunks available for knowledge compile");
  }

  return chunks;
}

function mergePlannedKnowledgeDocuments(
  plannedDocuments: KnowledgeDocument[] | undefined,
  inputDocuments: KnowledgeDocument[],
): KnowledgeDocument[] {
  const sourceById = new Map(inputDocuments.map((document) => [document.id, document]));
  const merged: KnowledgeDocument[] = [];

  if (Array.isArray(plannedDocuments)) {
    for (const document of plannedDocuments) {
      const source = sourceById.get(document.id);
      if (!source) continue;
      merged.push({
        ...source,
        status:
          document.status === "unsupported" || source.status === "unsupported"
            ? "unsupported"
            : "planned",
        metadata: {
          ...source.metadata,
          ...document.metadata,
        },
      });
    }
  }

  if (merged.length > 0) return merged;
  return inputDocuments.map((document) => ({
    ...document,
    status: document.status === "parsed" ? "planned" : document.status,
  }));
}

function isKnowledgeStrategy(value: unknown): value is KnowledgeStrategy {
  return typeof value === "string" && strategyLabels.includes(value as KnowledgeStrategy);
}
