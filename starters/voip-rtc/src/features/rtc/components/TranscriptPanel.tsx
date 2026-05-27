import type { BrowserVoiceSessionSnapshot } from "@voiceagentsdk/core/client/browser";
import { Panel } from "../../../components/ui/Panel.js";

export function TranscriptPanel({
  snapshot,
}: {
  snapshot: BrowserVoiceSessionSnapshot;
}) {
  return (
    <Panel title="Transcription en Direct" className="span2">
      {snapshot.transcript.length === 0 ? (
        <p className="muted" style={{ padding: "24px", height: "200px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", margin: 0 }}>
          Aucune transcription disponible. Démarrez la session et parlez dans votre micro.
        </p>
      ) : (
        <div className="chat-console" style={{ height: "200px" }}>
          {snapshot.transcript.map((item) => {
            const role = item.role.toLowerCase();
            const isAgent = role === "agent" || role === "assistant" || role === "model";
            return (
              <div
                key={item.id}
                className={`chat-msg ${isAgent ? "agent" : "user"}`}
              >
                <span className="chat-msg-sender">
                  {isAgent ? "Agent Vocal" : "Vous"}
                </span>
                <p style={{ margin: 0, fontSize: "13px", color: "inherit" }}>{item.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
