import { useEffect, type Dispatch, type SetStateAction } from "react";
import type {
  AgentBuildDraft,
  BuilderIdentity,
} from "../domain/builder/types.js";
import type {
  KnowledgeDocument,
  KnowledgeResearchResult,
} from "../domain/builder/knowledge.js";
import { emptyIdentity } from "../domain/builder/defaults.js";

export function useRestoredBuilderDraft({
  restoredDraft,
  onRestoredDraftConsumed,
  setDocuments,
  setDraft,
  setForm,
  setMessage,
  setResearchReport,
  setSelectedTools,
}: {
  restoredDraft: AgentBuildDraft | null;
  onRestoredDraftConsumed: () => void;
  setDocuments: Dispatch<SetStateAction<KnowledgeDocument[]>>;
  setDraft: Dispatch<SetStateAction<AgentBuildDraft | null>>;
  setForm: Dispatch<SetStateAction<BuilderIdentity>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setResearchReport: Dispatch<SetStateAction<KnowledgeResearchResult | null>>;
  setSelectedTools: Dispatch<SetStateAction<string[]>>;
}) {
  useEffect(() => {
    if (!restoredDraft) return;
    setDraft(restoredDraft);
    setForm({
      ...emptyIdentity,
      ...restoredDraft.identity,
      llmProvider: restoredDraft.identity.llmProvider,
    });
    setDocuments(restoredDraft.knowledgePlan?.documents ?? []);
    setSelectedTools(restoredDraft.selectedTools);
    setResearchReport(null);
    setMessage(`Resumed ${restoredDraft.identity.publicAgentName}`);
    onRestoredDraftConsumed();
  }, [
    onRestoredDraftConsumed,
    restoredDraft,
    setDocuments,
    setDraft,
    setForm,
    setMessage,
    setResearchReport,
    setSelectedTools,
  ]);
}
