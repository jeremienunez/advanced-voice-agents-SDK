import type { KnowledgeDocument } from "../../../../domain/builder.js";
import { formatDocumentMetadata } from "../../../../domain/formatters.js";

export function DocumentList({ documents }: { documents: KnowledgeDocument[] }) {
  return (
    <div className="documentList">
      <h3 className="knowledge-section-title">
        Documents importés ({documents.length})
      </h3>
      {documents.length === 0 ? (
        <div className="knowledge-empty-state">
          Aucun document n'a été importé. Téléversez des fichiers ci-dessus ou
          lancez une recherche autonome.
        </div>
      ) : (
        <div className="documentRows">
          {documents.map((document) => (
            <article key={document.id} className="documentRow">
              <div>
                <strong className="documentName">{document.name}</strong>
                <span className="documentKind">{document.kind}</span>
              </div>
              <span className="agent-badge compiled documentStatus">
                {document.status}
              </span>
              <em className="documentMeta">
                {formatDocumentMetadata(document)}
              </em>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
