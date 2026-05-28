import { useState } from "react";
import { StatusBadge } from "../../components/ui/StatusBadge.js";
import type { CompiledAgentSummary } from "../../domain/builder.js";
import { useRtcLab } from "../../hooks/useRtcLab.js";
import { RtcControlPanel } from "./components/RtcControlPanel.js";
import { VoiceOrb } from "./components/VoiceOrb.js";
import { RtcDiagnosticsDrawer } from "./RtcDiagnosticsDrawer.js";

export function RtcLab({
  compiledAgent,
}: {
  compiledAgent: CompiledAgentSummary | null;
}) {
  const rtc = useRtcLab(compiledAgent);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);

  const latestTranscript = rtc.snapshot.transcript[rtc.snapshot.transcript.length - 1];
  const isAgent = latestTranscript
    ? latestTranscript.role.toLowerCase() === "agent" ||
      latestTranscript.role.toLowerCase() === "assistant" ||
      latestTranscript.role.toLowerCase() === "model"
    : false;

  return (
    <section className="rtcImmersive fade-in">
      <header className="rtcImmersiveHeader">
        <div>
          <p className="studioEyebrow">RTC test</p>
          <h1>{compiledAgent?.draftId ?? "No compiled agent selected"}</h1>
          <p>
            {rtc.provider} · {rtc.model || "model not selected"} ·{" "}
            {rtc.snapshot.state}
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            className="openDiagBtn"
            onClick={() => setIsDiagnosticsOpen(true)}
            type="button"
            title="Ouvrir le panneau de diagnostics"
          >
            <span>Diagnostics</span>
            <span className="diagBadge">{rtc.events.length}</span>
          </button>
          <StatusBadge state={rtc.snapshot.state} />
        </div>
      </header>

      <main className="rtcImmersiveStage">
        <aside className="rtcSidePanel">
          <h2>Session</h2>
          <dl>
            <div>
              <dt>Provider</dt>
              <dd>{rtc.provider}</dd>
            </div>
            <div>
              <dt>Voice</dt>
              <dd>{rtc.voice || "Not selected"}</dd>
            </div>
            <div>
              <dt>Audio</dt>
              <dd>{rtc.audioMode}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{Math.round(rtc.snapshot.durationMs / 1000)}s</dd>
            </div>
          </dl>
        </aside>

        <section className="rtcOrbStage" aria-label="Voice state">
          <VoiceOrb
            state={rtc.snapshot.state}
            isMuted={rtc.snapshot.isMuted}
            outputLevel={rtc.snapshot.outputLevel}
          />
        </section>

        <aside className="rtcSidePanel">
          <h2>Live transcript</h2>
          {latestTranscript ? (
            <div className={`rtcLiveTranscript ${isAgent ? "agent" : "user"}`}>
              <strong>{isAgent ? "Agent" : "You"}</strong>
              <span>{latestTranscript.text}</span>
            </div>
          ) : (
            <p className="muted">
              Transcript will appear after the voice session starts.
            </p>
          )}
        </aside>
      </main>

      <footer className="rtcControlDock">
        <RtcControlPanel
          wsUrl={rtc.wsUrl}
          setWsUrl={rtc.setWsUrl}
          provider={rtc.provider}
          setProvider={rtc.setProvider}
          model={rtc.model}
          setModel={rtc.setModel}
          voice={rtc.voice}
          setVoice={rtc.setVoice}
          audioMode={rtc.audioMode}
          setAudioMode={rtc.setAudioMode}
          providerOptions={rtc.providerOptions}
          selectedProvider={rtc.selectedProvider}
          isActive={rtc.isActive}
          canStart={rtc.canStart}
          isMuted={rtc.snapshot.isMuted}
          onDiagnose={rtc.runMicrophoneDiagnostic}
          onStart={rtc.startRtc}
          onStop={() => rtc.client.disconnect()}
          onToggleMute={() => rtc.client.toggleMute()}
        />
      </footer>

      <RtcDiagnosticsDrawer
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        rtc={rtc}
      />
    </section>
  );
}
