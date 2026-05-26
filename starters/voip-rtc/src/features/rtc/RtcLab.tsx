import { StatusBadge } from "../../components/ui/StatusBadge.js";
import type { CompiledAgentSummary } from "../../domain/builder.js";
import { useRtcLab } from "../../hooks/useRtcLab.js";
import {
  AudioContractPanel,
  EventsPanel,
  SessionPanel,
  TranscriptPanel,
} from "./components/RtcPanels.js";
import { RtcControlPanel } from "./components/RtcControlPanel.js";
import { VoiceOrb } from "./components/VoiceOrb.js";

export function RtcLab({
  compiledAgent,
}: {
  compiledAgent: CompiledAgentSummary | null;
}) {
  const rtc = useRtcLab(compiledAgent);

  const latestTranscript = rtc.snapshot.transcript[rtc.snapshot.transcript.length - 1];
  const isAgent = latestTranscript
    ? latestTranscript.role.toLowerCase() === "agent" ||
      latestTranscript.role.toLowerCase() === "assistant" ||
      latestTranscript.role.toLowerCase() === "model"
    : false;

  const renderVoiceStage = (className: string) => (
    <div className={className}>
      <VoiceOrb
        state={rtc.snapshot.state}
        isMuted={rtc.snapshot.isMuted}
        outputLevel={rtc.snapshot.outputLevel}
      />
      {latestTranscript && (
        <div className="jarvis-live-bubble-wrapper">
          <div className={`jarvis-live-bubble ${isAgent ? "agent" : "user"}`}>
            <strong>{isAgent ? "Agent" : "Vous"}</strong>
            <span>{latestTranscript.text}</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <section className="topbar">
        <div>
          <p className="eyebrow">VoiceAgentSDK Starter</p>
          <h1>VOIP RTC Lab</h1>
          {compiledAgent ? (
            <p className="muted">
              Compiled builder agent loaded: {compiledAgent.draftId}
            </p>
          ) : null}
        </div>
        <StatusBadge state={rtc.snapshot.state} />
      </section>

      {renderVoiceStage("mobile-orb-slot")}

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

      <div className="jarvis-hud-layout">
        {/* LEFT COLUMN : Session Metrics & Transcript */}
        <div className="hud-column left">
          <SessionPanel
            snapshot={rtc.snapshot}
            audioMode={rtc.audioMode}
            microphoneDiagnostic={rtc.microphoneDiagnostic}
            configError={rtc.configError}
            selectedProvider={rtc.selectedProvider}
          />
          <TranscriptPanel snapshot={rtc.snapshot} />
        </div>

        {/* CENTER : 3D ORB & Live Transcript Bubble */}
        {renderVoiceStage("hud-centerpiece")}

        {/* RIGHT COLUMN : Audio Contract & Events Log */}
        <div className="hud-column right">
          <AudioContractPanel
            audioMode={rtc.audioMode}
            runtimeConfig={rtc.runtimeConfig}
            selectedProvider={rtc.selectedProvider}
          />
          <EventsPanel events={rtc.events} />
        </div>
      </div>
    </>
  );
}
