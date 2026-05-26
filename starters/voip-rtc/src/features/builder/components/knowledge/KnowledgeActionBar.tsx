import type { ChangeEvent } from "react";
import { Button } from "../../../../components/ui/Button.js";
import type { AgentBuildDraft } from "../../../../domain/builder.js";
import { FilePickerButton } from "./FilePickerButton.js";

export function KnowledgeActionBar({
  busy,
  canPlanKnowledge,
  canRunResearch,
  draft,
  knowledgeBlocked,
  databaseReady,
  compileKnowledge,
  buildKnowledgeEagerly,
  handleDocumentUpload,
  planKnowledge,
  runResearch,
}: {
  busy: string | null;
  canPlanKnowledge: boolean;
  canRunResearch: boolean;
  draft: AgentBuildDraft | null;
  knowledgeBlocked: boolean;
  databaseReady: boolean;
  compileKnowledge: () => Promise<void>;
  buildKnowledgeEagerly: () => Promise<void>;
  handleDocumentUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  planKnowledge: () => Promise<void>;
  runResearch: () => Promise<void>;
}) {
  return (
    <div className="uploadRow">
      <FilePickerButton busy={Boolean(busy)} onUpload={handleDocumentUpload} />
      <Button
        disabled={!canRunResearch || Boolean(busy)}
        onClick={() => void runResearch()}
      >
        {busy === "research" ? "Recherche en cours..." : "Recherche web autonome"}
      </Button>
      <Button
        disabled={!canRunResearch || Boolean(busy)}
        variant="primary"
        onClick={() => void buildKnowledgeEagerly()}
      >
        {busy === "research" ? "Autonomie en cours..." : "Créer knowledge autonome"}
      </Button>
      <Button
        disabled={!canPlanKnowledge || Boolean(busy)}
        onClick={() => void planKnowledge()}
      >
        {busy === "knowledge" ? "Planification..." : "Générer la stratégie RAG"}
      </Button>
      <Button
        disabled={
          !draft?.knowledgePlan ||
          !databaseReady ||
          Boolean(busy) ||
          knowledgeBlocked
        }
        variant="primary"
        onClick={() => void compileKnowledge()}
      >
        {busy === "compile-knowledge" ? "Compilation..." : "Compiler pgvector RAG"}
      </Button>
    </div>
  );
}
