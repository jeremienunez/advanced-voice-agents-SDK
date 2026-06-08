import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import {
  applyDatabasePlan,
  buildAutonomousKnowledge,
  compileKnowledgeStore,
  createDatabasePlan,
  createKnowledgePlan,
  ingestDocument,
  runAutonomousResearch,
} from "../api/builderApi.js";
import type {
  AgentBuildDraft,
  BuilderResearchSettings,
} from "../domain/builder/types.js";
import type {
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchResult,
} from "../domain/builder/knowledge.js";
import { keepLoaderVisible } from "../domain/builder/progress.js";

interface BuilderKnowledgeActionsInput {
  apiBase: string;
  documents: KnowledgeDocument[];
  draft: AgentBuildDraft | null;
  researchBudget: KnowledgeResearchBudget;
  researchSettings: BuilderResearchSettings;
  setBusy: Dispatch<SetStateAction<string | null>>;
  setDocuments: Dispatch<SetStateAction<KnowledgeDocument[]>>;
  setDraft: Dispatch<SetStateAction<AgentBuildDraft | null>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setResearchReport: Dispatch<SetStateAction<KnowledgeResearchResult | null>>;
}

export function useBuilderKnowledgeActions(input: BuilderKnowledgeActionsInput) {
  async function handleDocumentUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    await withBusy("documents", "Document parsing failed", async () => {
      const parsed = await Promise.all(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          return (await ingestDocument(input.apiBase, formData)).document;
        }),
      );
      input.setDocuments((current) => [...current, ...parsed]);
      event.target.value = "";
    });
  }

  async function runResearch() {
    if (!input.draft) return;
    await withBusy("research", "Research failed", async () => {
      const response = await runAutonomousResearch(
        input.apiBase,
        input.draft as AgentBuildDraft,
        input.documents,
        input.researchBudget,
        input.researchSettings,
      );
      if (response.status === "blocked") {
        input.setMessage(response.reason ?? "Research blocked");
      }
      const researchDocuments = response.documents?.length
        ? response.documents
        : response.document
          ? [response.document]
          : [];
      if (researchDocuments.length) {
        input.setDocuments((current) => [...current, ...researchDocuments]);
      }
      if (response.research) input.setResearchReport(response.research);
    });
  }

  async function buildKnowledgeEagerly() {
    if (!input.draft) return;
    await withBusy("research", "Autonomous knowledge build failed", async () => {
      const response = await buildAutonomousKnowledge(
        input.apiBase,
        input.draft as AgentBuildDraft,
        input.documents,
        input.researchBudget,
        input.researchSettings,
      );
      input.setDraft(response.draft);
      input.setDocuments(response.draft.knowledgePlan?.documents ?? response.documents);
      if (response.research) input.setResearchReport(response.research);
    });
  }

  async function planKnowledge() {
    if (!input.draft) return;
    await withBusy("knowledge", "Knowledge planning failed", async () => {
      const response = await createKnowledgePlan(
        input.apiBase,
        input.draft as AgentBuildDraft,
        input.documents,
      );
      input.setDraft(response.draft);
    });
  }

  async function planDatabase() {
    if (!input.draft) return;
    await withBusy("database-plan", "Database planning failed", async () => {
      const response = await createDatabasePlan(
        input.apiBase,
        input.draft as AgentBuildDraft,
        input.documents,
      );
      input.setDraft(response.draft);
    });
  }

  async function applyDatabase() {
    if (!input.draft) return;
    await withBusy("database-apply", "Database apply failed", async () => {
      const response = await applyDatabasePlan(
        input.apiBase,
        input.draft as AgentBuildDraft,
      );
      if (response.status === "blocked") {
        input.setMessage(response.reason ?? "Database provisioning blocked");
      }
      if (response.draft) input.setDraft(response.draft);
    });
  }

  async function compileKnowledge() {
    if (!input.draft) return;
    await withBusy("compile-knowledge", "Knowledge compile failed", async () => {
      const response = await compileKnowledgeStore(
        input.apiBase,
        input.draft as AgentBuildDraft,
      );
      if (response.status === "blocked") {
        input.setMessage(response.reason ?? "Knowledge compile blocked");
      }
      if (response.draft) input.setDraft(response.draft);
    });
  }

  async function withBusy(
    busyKey: string,
    fallbackMessage: string,
    task: () => Promise<void>,
  ) {
    const startedAt = performance.now();
    input.setBusy(busyKey);
    input.setMessage(null);
    try {
      await task();
    } catch (error) {
      input.setMessage(error instanceof Error ? error.message : fallbackMessage);
    } finally {
      await keepLoaderVisible(startedAt);
      input.setBusy(null);
    }
  }

  return {
    applyDatabase,
    buildKnowledgeEagerly,
    compileKnowledge,
    handleDocumentUpload,
    planDatabase,
    planKnowledge,
    runResearch,
  };
}
