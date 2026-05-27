import {
  createAgentBuildDraftBuilder,
  type DatabaseBuildPlan,
  type EmbeddingInput,
} from "@voiceagentsdk/core/sdk";
import { chunkDocuments } from "./domain/knowledge.js";
import {
  compileArtifact,
  promptPlanWithClarifications,
} from "./domain/prompt.js";
import { toolInstructionsFromPlan } from "./domain/tooling/compile.js";
import { createToolBuildPlan } from "./domain/tooling/contracts.js";
import {
  validatedToolPlan,
  validateToolBuildPlan,
} from "./domain/tooling/validation.js";
import { mutateDraft } from "./domain/drafts.js";
import {
  normalizeKnowledgeDocuments,
  normalizeIdentity,
  normalizeResearchSettings,
  normalizeSelectedTools,
  readDocumentInput,
} from "./request.js";
import { normalizeResearchBudget } from "./domain/research.js";
import {
  resolveDraft,
  requireDraft,
  saveDraft,
  setActiveDraft,
} from "./state.js";
import type { BuilderWorkflowDependencies } from "./types.js";
import { asRecord, readString } from "./utils.js";
import { buildEagerKnowledge } from "./eager-knowledge.js";

export function createBuilderWorkflows(deps: BuilderWorkflowDependencies) {
  return {
    activateSession(body: unknown) {
      const draftId = readString(body, "draftId");
      if (!draftId) throw new Error("draftId is required");
      const draft = requireDraft(draftId);
      if (!draft.compiled) throw new Error(`Draft "${draftId}" is not compiled`);
      setActiveDraft(draftId);
    },

    async createPromptPlan(body: unknown) {
      const identity = normalizeIdentity(body, {
        provider: deps.promptProvider,
        model: deps.promptModel,
      });
      const draftId = readString(body, "draftId") || `draft_${crypto.randomUUID()}`;
      const draft = createAgentBuildDraftBuilder(draftId, identity)
        .registry(deps.toolRegistry)
        .selectTools(
          deps.toolRegistry
            .filter((item) => item.selectedByDefault)
            .map((item) => item.name),
        )
        .build();

      const plan = await deps.planner.createPromptPlan({ draft });
      const nextDraft = createAgentBuildDraftBuilder(draft.id, draft.identity)
        .registry(deps.toolRegistry)
        .selectTools(draft.selectedTools)
        .promptPlan(plan)
        .build();
      saveDraft(nextDraft);
      return { draft: nextDraft };
    },

    async savePromptClarifications(body: unknown) {
      const draft = resolveDraft(body);
      if (!draft.promptPlan) throw new Error("Prompt plan is required");
      const answers = normalizePromptAnswers(body);
      const acceptUnanswered = asRecord(body).acceptUnanswered !== false;
      const plan = promptPlanWithClarifications(
        draft.promptPlan,
        answers,
        acceptUnanswered,
      );
      const nextDraft = mutateDraft(draft)
        .promptPlan(plan)
        .metadata({ promptClarifications: answers })
        .build();
      saveDraft(nextDraft);
      return { draft: nextDraft };
    },

    async ingestDocument(request: Request) {
      const documentInput = await readDocumentInput(request);
      const document = await deps.ingestion.parse(documentInput);
      return { document };
    },

    async runResearch(body: unknown) {
      const draft = resolveDraft(body);
      const documents = normalizeKnowledgeDocuments(body);
      const research = normalizeResearchSettings(body, researchDefaults(deps));
      if (!deps.research.isConfigured(research)) {
        return {
          status: "blocked",
          reason: "Research provider not configured",
          requiredEnv: `${research.provider.toUpperCase()}_API_KEY`,
        };
      }
      const result = await deps.research.growKnowledge({
        draft,
        documents,
        budget: normalizeResearchBudget(body),
        settings: research,
      });
      return {
        status: result.status,
        documents: result.documents,
        document: result.documents[0],
        research: result,
      };
    },

    async buildAutonomousKnowledge(body: unknown) {
      const result = await buildEagerKnowledge({
        deps,
        draft: resolveDraft(body),
        documents: normalizeKnowledgeDocuments(body),
        budget: normalizeResearchBudget(body),
        research: normalizeResearchSettings(body, researchDefaults(deps)),
      });
      return { status: result.draft.status, ...result };
    },

    async createKnowledgePlan(body: unknown) {
      const draft = resolveDraft(body);
      const documents = normalizeKnowledgeDocuments(body);
      const plan = await deps.planner.createKnowledgePlan({ draft, documents });
      const nextDraft = mutateDraft(draft).knowledgePlan(plan).build();
      saveDraft(nextDraft);
      return { draft: nextDraft };
    },

    async createDatabasePlan(body: unknown) {
      const draft = resolveDraft(body);
      const documents =
        draft.knowledgePlan?.documents.length
          ? draft.knowledgePlan.documents
          : normalizeKnowledgeDocuments(body);
      const plan = await deps.planner.createDatabasePlan({
        draft,
        documents,
        knowledgePlan: draft.knowledgePlan,
      });
      const validation = deps.databaseProvisioner.validate({ draft, plan });
      const nextPlan: DatabaseBuildPlan = {
        ...plan,
        status: validation.ok ? "validated" : "failed",
        validationErrors: validation.errors,
      };
      const nextDraft = mutateDraft(draft).databasePlan(nextPlan).build();
      saveDraft(nextDraft);
      return { draft: nextDraft, validation };
    },

    async applyDatabase(body: unknown) {
      const draft = resolveDraft(body);
      const plan = draft.databasePlan;
      if (!plan) throw new Error("Database plan is required before provisioning");
      if (!deps.databaseProvisioner.isConfigured()) {
        return {
          status: "blocked",
          reason: "Database provisioner not configured",
          requiredEnv: "DATABASE_URL",
        };
      }
      const validation = deps.databaseProvisioner.validate({ draft, plan });
      if (!validation.ok) {
        return { status: "blocked", reason: "SQL validation failed", validation };
      }
      const result = await deps.databaseProvisioner.apply({ draft, plan });
      const nextPlan: DatabaseBuildPlan = {
        ...plan,
        status: "applied",
        appliedAt: result.appliedAt,
        validationErrors: [],
      };
      const nextDraft = mutateDraft(draft)
        .databasePlan(nextPlan)
        .metadata({ databaseProvision: result })
        .build();
      saveDraft(nextDraft);
      return { status: "applied", result, draft: nextDraft };
    },

    async compileKnowledge(body: unknown) {
      const draft = resolveDraft(body);
      if (!deps.knowledgeStore.isConfigured()) {
        return {
          status: "blocked",
          reason: "Knowledge store not configured",
          requiredEnv: "DATABASE_URL",
        };
      }
      if (!deps.voyageConfigured) {
        return {
          status: "blocked",
          reason: "Embedding provider not configured",
          requiredEnv: "VOYAGE_API_KEY",
        };
      }

      const plannedDocuments = draft.knowledgePlan?.documents ?? [];
      const documents = plannedDocuments.length
        ? plannedDocuments
        : normalizeKnowledgeDocuments(body);
      const chunks = chunkDocuments(documents, draft.knowledgePlan);
      const vectors = await deps.embeddings.embed(
        chunks.map((chunk): EmbeddingInput => ({
          id: chunk.id,
          text: chunk.text,
          metadata: {
            documentId: chunk.documentId,
            ordinal: chunk.ordinal,
          },
        })),
      );
      const result = await deps.knowledgeStore.compile({
        draft,
        documents,
        chunks,
        embeddings: vectors,
      });
      const nextDraft = mutateDraft(draft)
        .status("knowledge-compiled")
        .metadata({ knowledgeStore: result })
        .build();
      saveDraft(nextDraft);
      return { status: "compiled", result, draft: nextDraft };
    },

    async compileAgent(body: unknown) {
      const draft = resolveDraft(body);
      const selectedTools = normalizeSelectedTools(body, draft);
      const plannedTools = createToolBuildPlan(draft, selectedTools);
      const validation = validateToolBuildPlan(
        draft,
        plannedTools,
        new Set(deps.availableSecretNames),
      );
      const toolPlan = validatedToolPlan(plannedTools, validation);
      const toolPrompt = toolInstructionsFromPlan(toolPlan);
      const draftWithTools = mutateDraft(draft)
        .selectTools(selectedTools)
        .toolBuildPlan(toolPlan)
        .toolValidation(validation)
        .toolPrompt(toolPrompt)
        .build();

      if (validation.status === "invalid") {
        saveDraft(draftWithTools);
        const errors = validation.issues
          .filter((issue) => issue.severity === "error")
          .map((issue) => `${issue.toolName ?? "tool"}: ${issue.message}`);
        throw new Error(`Tool validation failed: ${errors.join("; ")}`);
      }

      const prompt = await deps.planner.composeFinalPrompt({
        draft: draftWithTools,
        selectedTools,
      });
      const artifact = compileArtifact(draftWithTools, selectedTools, prompt, toolPlan);
      const nextDraft = mutateDraft(draftWithTools)
        .finalPrompt(prompt)
        .compiled(artifact)
        .build();
      saveDraft(nextDraft);
      setActiveDraft(nextDraft.id);
      return { draft: nextDraft, artifact };
    },
  };
}

function researchDefaults(deps: BuilderWorkflowDependencies) {
  return {
    provider: deps.researchProvider,
    model: deps.researchModel,
    verifierProvider: deps.knowledgeVerificationProvider,
    verifierModel: deps.knowledgeVerificationModel,
  };
}

function normalizePromptAnswers(body: unknown): Record<string, string> {
  const raw = asRecord(asRecord(body).answers);
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => [key, (value as string).trim()])
      .filter(([, value]) => value.length > 0),
  );
}
