import type { AgentBuildDraft } from "../../../../domain/builder/types.js";

export function KnowledgeWarnings({
  databaseReady,
  draft,
  knowledgeBlocked,
  researchBlocked,
}: {
  databaseReady: boolean;
  draft: AgentBuildDraft | null;
  knowledgeBlocked: boolean;
  researchBlocked: boolean;
}) {
  return (
    <>
      {knowledgeBlocked ? (
        <p className="warning warning-error">
          La base de connaissances n'est pas disponible. Veuillez configurer la
          variable DATABASE_URL pour compiler pgvector.
        </p>
      ) : null}

      {researchBlocked && draft?.promptPlan ? (
        <p className="warning warning-note">
          Le fournisseur de recherche autonome n'est pas configuré. Vérifiez la
          clé API du provider knowledge sélectionné, surtout si aucun document
          n'est téléversé.
        </p>
      ) : null}

      {!databaseReady && draft?.knowledgePlan ? (
        <p className="warning warning-note">
          Veuillez créer et provisionner la base de données isolée à l'étape
          suivante avant de compiler le RAG.
        </p>
      ) : null}
    </>
  );
}
