import { useEffect, type Dispatch, type SetStateAction } from "react";
import type {
  AgentBuildDraft,
  BuilderIdentity,
  BuilderSystemConfig,
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
  setBuilderSystem,
  setMessage,
  setResearchReport,
  setSelectedTools,
}: {
  restoredDraft: AgentBuildDraft | null;
  onRestoredDraftConsumed: () => void;
  setDocuments: Dispatch<SetStateAction<KnowledgeDocument[]>>;
  setDraft: Dispatch<SetStateAction<AgentBuildDraft | null>>;
  setForm: Dispatch<SetStateAction<BuilderIdentity>>;
  setBuilderSystem: Dispatch<SetStateAction<BuilderSystemConfig>>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setResearchReport: Dispatch<SetStateAction<KnowledgeResearchResult | null>>;
  setSelectedTools: Dispatch<SetStateAction<string[]>>;
}) {
  useEffect(() => {
    if (!restoredDraft) return;
    setDraft(restoredDraft);
    setForm({
      builderFirstName:
        restoredDraft.identity.builderFirstName ?? emptyIdentity.builderFirstName,
      builderLastName:
        restoredDraft.identity.builderLastName ?? emptyIdentity.builderLastName,
      publicAgentName:
        restoredDraft.identity.publicAgentName ?? emptyIdentity.publicAgentName,
      intent: restoredDraft.identity.intent ?? emptyIdentity.intent,
      mustDo: Array.isArray(restoredDraft.identity.mustDo)
        ? restoredDraft.identity.mustDo.join("\n")
        : emptyIdentity.mustDo,
      mustNotDo: Array.isArray(restoredDraft.identity.mustNotDo)
        ? restoredDraft.identity.mustNotDo.join("\n")
        : emptyIdentity.mustNotDo,
    });
    if (restoredDraft.builderSystem) {
      setBuilderSystem(restoredDraft.builderSystem);
    }
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
    setBuilderSystem,
    setMessage,
    setResearchReport,
    setSelectedTools,
  ]);
}
