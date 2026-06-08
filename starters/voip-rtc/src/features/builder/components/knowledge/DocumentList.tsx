import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fetchKnowledgeDocument } from "../../../../api/builderApi.js";
import { Button } from "../../../../components/ui/Button.js";
import type { KnowledgeDocument } from "../../../../domain/builder/knowledge.js";
import { formatDocumentMetadata } from "../../../../domain/shared/formatters.js";
import "../../styles/components/knowledge/DocumentList.css";

export function DocumentList({
  apiBase,
  draftId,
  documents,
}: {
  apiBase: string;
  draftId?: string;
  documents: KnowledgeDocument[];
}) {
  const [selectedDocument, setSelectedDocument] =
    useState<KnowledgeDocument | null>(null);
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDocument) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeViewer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedDocument]);

  async function openDocument(knowledgeDocument: KnowledgeDocument) {
    setViewerError(null);
    if (knowledgeDocument.text || !draftId) {
      setSelectedDocument(knowledgeDocument);
      return;
    }
    setLoadingDocumentId(knowledgeDocument.id);
    try {
      const response = await fetchKnowledgeDocument(
        apiBase,
        draftId,
        knowledgeDocument.id,
      );
      setSelectedDocument(response.document);
    } catch (error) {
      setSelectedDocument(knowledgeDocument);
      setViewerError(
        error instanceof Error ? error.message : "Document could not be opened",
      );
    } finally {
      setLoadingDocumentId(null);
    }
  }

  function closeViewer() {
    setSelectedDocument(null);
    setViewerError(null);
  }

  const selectedText = selectedDocument?.text?.trim();

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
          {documents.map((knowledgeDocument) => (
            <article key={knowledgeDocument.id} className="documentRow">
              <div>
                <strong className="documentName">{knowledgeDocument.name}</strong>
                <span className="documentKind">{knowledgeDocument.kind}</span>
              </div>
              <span className="agent-badge compiled documentStatus">
                {knowledgeDocument.status}
              </span>
              <em className="documentMeta">
                {formatDocumentMetadata(knowledgeDocument)}
              </em>
              <Button
                className="documentOpenButton"
                disabled={loadingDocumentId === knowledgeDocument.id}
                onClick={() => void openDocument(knowledgeDocument)}
                title={`Open ${knowledgeDocument.name}`}
                type="button"
                variant="ghost"
              >
                {loadingDocumentId === knowledgeDocument.id ? "Loading" : "Open"}
              </Button>
            </article>
          ))}
        </div>
      )}
      {selectedDocument ? createPortal(
        <div className="documentViewerBackdrop" onMouseDown={closeViewer}>
          <section
            aria-labelledby="documentViewerTitle"
            aria-modal="true"
            className="documentViewer"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="documentViewerHeader">
              <div>
                <p className="studioEyebrow">Knowledge document</p>
                <h3 id="documentViewerTitle">{selectedDocument.name}</h3>
              </div>
              <Button
                aria-label="Close document"
                className="documentViewerClose"
                onClick={closeViewer}
                title="Close document"
                type="button"
                variant="ghost"
              >
                x
              </Button>
            </header>
            <dl className="documentViewerFacts">
              <div>
                <dt>Type</dt>
                <dd>{selectedDocument.kind}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selectedDocument.status}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>
                  {selectedDocument.sizeBytes
                    ? `${selectedDocument.sizeBytes} bytes`
                    : "unknown"}
                </dd>
              </div>
            </dl>
            {viewerError ? <p className="error">{viewerError}</p> : null}
            <pre className="documentViewerBody">
              {selectedText || "No readable text available."}
            </pre>
          </section>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
