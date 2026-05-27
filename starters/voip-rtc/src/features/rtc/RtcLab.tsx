import type { ReactNode } from "react";
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
    <section className="rtcLab">
      <section className="topbar rtcTopbar">
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

      {renderVoiceStage("rtcCentralStage")}

      <section className="rtcDrawerDeck" aria-label="RTC lab drawers">
        <RtcDrawer
          title="Connection"
          detail={`${rtc.provider} · ${rtc.snapshot.state}`}
          defaultOpen
        >
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
        </RtcDrawer>

        <div className="rtcDrawerGrid">
          <RtcDrawer title="Session" detail={rtc.snapshot.sessionId ?? "idle"}>
            <SessionPanel
              snapshot={rtc.snapshot}
              audioMode={rtc.audioMode}
              microphoneDiagnostic={rtc.microphoneDiagnostic}
              configError={rtc.configError}
              selectedProvider={rtc.selectedProvider}
            />
          </RtcDrawer>

          <RtcDrawer
            title="Transcript"
            detail={`${rtc.snapshot.transcript.length} lines`}
          >
            <TranscriptPanel snapshot={rtc.snapshot} />
          </RtcDrawer>

          <RtcDrawer title="Audio contract" detail={rtc.audioMode}>
            <AudioContractPanel
              audioMode={rtc.audioMode}
              runtimeConfig={rtc.runtimeConfig}
              selectedProvider={rtc.selectedProvider}
            />
          </RtcDrawer>

          <RtcDrawer title="SDK events" detail={`${rtc.events.length} events`}>
            <EventsPanel events={rtc.events} />
          </RtcDrawer>
        </div>
      </section>
    </section>
  );
}

function RtcDrawer({
  title,
  detail,
  children,
  defaultOpen = false,
}: {
  title: string;
  detail: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="rtcDrawer" open={defaultOpen}>
      <summary>
        <span>{title}</span>
        <small>{detail}</small>
      </summary>
      <div className="rtcDrawerBody">{children}</div>
    </details>
  );
}
