import type {
  BrowserVoiceAudioMode,
  BrowserVoiceSessionSnapshot,
} from "@voiceagentsdk/core/client/browser";
import { Metric } from "../../../components/ui/Metric.js";
import { Panel } from "../../../components/ui/Panel.js";
import type { EventLogEntry } from "../../../domain/events.js";
import {
  formatDuration,
  formatKhz,
} from "../../../domain/formatters.js";
import type { MicrophoneDiagnosticReport } from "../../../domain/microphone.js";
import type {
  RuntimeConfig,
  RuntimeProviderConfig,
} from "../../../domain/runtime.js";
import { MicrophoneDiagnostic } from "./MicrophoneDiagnostic.js";
import "./RtcPanels.css";

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
      <div className="field" style={{ gap: '12px' }}>
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
      {snapshot.learning ? (
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
        <div style={{ marginTop: '16px' }}>
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

export function AudioContractPanel({
  audioMode,
  runtimeConfig,
  selectedProvider,
}: {
  audioMode: BrowserVoiceAudioMode;
  runtimeConfig: RuntimeConfig | null;
  selectedProvider: RuntimeProviderConfig | undefined;
}) {
  return (
    <Panel title="Contrat Audio VoIP">
      <div className="field" style={{ gap: '12px' }}>
        <Metric
          label="Type de Capture"
          value={
            audioMode === "silent"
              ? "Silence PCM16 -> WebSocket"
              : "Micro Float32 -> PCM16"
          }
        />
        <Metric
          label="Flux Navigateur"
          value={`${formatKhz(runtimeConfig?.browserAudio.sampleRate ?? 24000)} mono`}
        />
        <Metric
          label="Entrée Modèle"
          value={`${formatKhz(selectedProvider?.inputSampleRate ?? 24000)} mono`}
        />
        <Metric
          label="Sortie Modèle"
          value={`${formatKhz(selectedProvider?.outputSampleRate ?? 24000)} mono`}
        />
        <Metric label="Taille de Trame" value="~40 ms chunks" />
        <Metric label="Restitution (Playback)" value="PCM16 ring buffer à 24 kHz" />
      </div>
    </Panel>
  );
}

export function TranscriptPanel({
  snapshot,
}: {
  snapshot: BrowserVoiceSessionSnapshot;
}) {
  return (
    <Panel title="Transcription en Direct" className="span2">
      {snapshot.transcript.length === 0 ? (
        <p className="muted" style={{ padding: '24px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', margin: 0 }}>
          Aucune transcription disponible. Démarrez la session et parlez dans votre micro.
        </p>
      ) : (
        <div className="chat-console" style={{ height: '200px' }}>
          {snapshot.transcript.map((item) => {
            const isAgent = item.role.toLowerCase() === "agent" || item.role.toLowerCase() === "assistant" || item.role.toLowerCase() === "model";
            return (
              <div 
                key={item.id} 
                className={`chat-msg ${isAgent ? "agent" : "user"}`}
              >
                <span className="chat-msg-sender">
                  {isAgent ? "Agent Vocal" : "Vous"}
                </span>
                <p style={{ margin: 0, fontSize: '13px', color: 'inherit' }}>{item.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export function EventsPanel({ events }: { events: EventLogEntry[] }) {
  return (
    <Panel title="Journal d'Événements SDK" className="span2">
      <div className="events" style={{ height: '200px', maxHeight: '200px', overflowY: 'auto', display: 'grid', gap: '12px' }}>
        {events.length === 0 ? (
          <p className="muted" style={{ padding: '24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', margin: 0 }}>Aucun événement enregistré.</p>
        ) : (
          events.map((event) => (
            <article key={event.id} className="eventRow">
              <time style={{ fontSize: '11px', color: 'var(--slate-500)', fontFamily: 'monospace' }}>{event.timestamp}</time>
              <strong style={{ fontSize: '12px', color: 'var(--google-blue)' }}>{event.label}</strong>
              <span style={{ fontSize: '11px', color: 'var(--slate-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.detail}</span>
            </article>
          ))
        )}
      </div>
    </Panel>
  );
}
