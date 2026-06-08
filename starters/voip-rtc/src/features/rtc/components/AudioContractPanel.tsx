import type { BrowserVoiceAudioMode } from "@voiceagentsdk/core/client/browser";
import { Metric } from "../../../components/ui/Metric.js";
import { Panel } from "../../../components/ui/Panel.js";
import { formatKhz } from "../../../domain/shared/formatters.js";
import type {
  RuntimeConfig,
  RuntimeProviderConfig,
} from "../../../domain/runtime/config.js";

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
      <div className="field" style={{ gap: "12px" }}>
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
