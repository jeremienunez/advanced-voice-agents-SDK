import type {
  BrowserVoiceAudioMode,
  BrowserVoiceSessionSnapshot,
} from "@voiceagentsdk/core/client/browser";
import { Metric } from "../../../components/ui/Metric.js";
import { Panel } from "../../../components/ui/Panel.js";
import type { MicrophoneDiagnosticReport } from "../../../domain/microphone.js";
import type { RuntimeProviderConfig } from "../../../domain/runtime.js";
import { formatDuration } from "../../../domain/formatters.js";
import { MicrophoneDiagnostic } from "./MicrophoneDiagnostic.js";

export function SessionPanel({
  snapshot,
  audioMode,
  microphoneDiagnostic,
  configError,
  selectedProvider,
}: {
  snapshot: BrowserVoiceSessionSnapshot;
  audioMode: BrowserVoiceAudioMode;
  microphoneDiagnostic: MicrophoneDiagnosticReport | null;
  configError: string | null;
  selectedProvider: RuntimeProviderConfig | undefined;
}) {
  return (
    <Panel title="Statut de Session RTC">
      <div className="field" style={{ gap: "12px" }}>
        <Metric label="État" value={snapshot.state} />
        <Metric label="Session ID" value={snapshot.sessionId ?? "Aucune"} />
        <Metric label="Durée d'Appel" value={formatDuration(snapshot.durationMs)} />
        <Metric label="Microphone" value={snapshot.isMuted ? "Muet" : "Actif"} />
        <Metric label="Mode d'Entrée" value={audioMode === "microphone" ? "Microphone" : "Silence E2E"} />
        <Metric
          label="Apprentissage"
          value={snapshot.learning ? snapshot.learning.status : "En attente"}
        />
      </div>

      {snapshot.error ? <p className="error-box">{snapshot.error}</p> : null}
      {snapshot.learning && (snapshot.learning.status === "running" || snapshot.learning.status === "queued") ? (
        <div className="learning-loader-box">
          <div className="learning-loader-spinner"></div>
          <div className="learning-loader-content">
            <strong className="pulse-text">Session d'apprentissage en cours...</strong>
            <span className="learning-loader-detail">
              {snapshot.learning.message ?? "L'agent consolide ses connaissances RAG."}
            </span>
          </div>
        </div>
      ) : snapshot.learning ? (
        <p className={snapshot.learning.status === "failed" ? "error-box" : "warning"}>
          {snapshot.learning.message ?? snapshot.learning.runId}
        </p>
      ) : null}
      {snapshot.error && audioMode === "microphone" ? (
        <p className="warning">
          Astuce : Basculez l'entrée sur "Silence E2E" pour tester la chaîne RTC sans microphone physique.
        </p>
      ) : null}
      {microphoneDiagnostic ? (
        <div style={{ marginTop: "16px" }}>
          <MicrophoneDiagnostic report={microphoneDiagnostic} />
        </div>
      ) : null}
      {configError ? <p className="error-box">{configError}</p> : null}
      {!configError && !selectedProvider?.enabled ? (
        <p className="error-box">
          Clé de configuration manquante : {selectedProvider?.missingEnv.join(" ou ")}
        </p>
      ) : null}
    </Panel>
  );
}
