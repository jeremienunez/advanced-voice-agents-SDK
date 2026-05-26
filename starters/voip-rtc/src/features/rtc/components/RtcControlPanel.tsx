import type {
  BrowserVoiceAudioMode,
  VoiceProvider,
} from "@voiceagentsdk/core/client/browser";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "../../../components/ui/Button.js";
import type { RuntimeProviderConfig } from "../../../domain/runtime.js";

export function RtcControlPanel({
  wsUrl,
  setWsUrl,
  provider,
  setProvider,
  model,
  setModel,
  voice,
  setVoice,
  audioMode,
  setAudioMode,
  providerOptions,
  selectedProvider,
  isActive,
  canStart,
  isMuted,
  onDiagnose,
  onStart,
  onStop,
  onToggleMute,
}: {
  wsUrl: string;
  setWsUrl: Dispatch<SetStateAction<string>>;
  provider: VoiceProvider;
  setProvider: Dispatch<SetStateAction<VoiceProvider>>;
  model: string;
  setModel: Dispatch<SetStateAction<string>>;
  voice: string;
  setVoice: Dispatch<SetStateAction<string>>;
  audioMode: BrowserVoiceAudioMode;
  setAudioMode: Dispatch<SetStateAction<BrowserVoiceAudioMode>>;
  providerOptions: RuntimeProviderConfig[];
  selectedProvider: RuntimeProviderConfig | undefined;
  isActive: boolean;
  canStart: boolean;
  isMuted: boolean;
  onDiagnose: () => Promise<void>;
  onStart: () => Promise<void>;
  onStop: () => void;
  onToggleMute: () => void;
}) {
  return (
    <section className="controlPanel">
      <label className="field fieldWide">
        <span>WebSocket endpoint</span>
        <input
          name="wsUrl"
          value={wsUrl}
          onChange={(event) => setWsUrl(event.target.value)}
          disabled={isActive}
        />
      </label>

      <label className="field">
        <span>Provider</span>
        <select
          name="provider"
          value={provider}
          onChange={(event) => {
            const nextProvider = providerOptions.find((item) => {
              return item.id === event.target.value;
            });
            if (!nextProvider) return;
            setProvider(nextProvider.id);
            setModel(nextProvider.defaultModel);
            setVoice(nextProvider.defaultVoice);
          }}
          disabled={isActive}
        >
          {providerOptions.map((item) => (
            <option key={item.id} value={item.id} disabled={!item.enabled}>
              {item.enabled ? item.label : `${item.label} - missing key`}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Model</span>
        <select
          name="model"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          disabled={isActive || !selectedProvider?.enabled}
        >
          {(selectedProvider?.models ?? []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Voice</span>
        <select
          name="voice"
          value={voice}
          onChange={(event) => setVoice(event.target.value)}
          disabled={isActive || !selectedProvider?.enabled}
        >
          {(selectedProvider?.voices ?? []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <div className="actions">
        <label className="inlineControl">
          <span>Input</span>
          <select
            name="audioMode"
            value={audioMode}
            onChange={(event) =>
              setAudioMode(event.target.value as BrowserVoiceAudioMode)
            }
            disabled={isActive}
          >
            <option value="microphone">Microphone</option>
            <option value="silent">E2E silence</option>
          </select>
        </label>
        <Button onClick={() => void onDiagnose()} disabled={isActive}>
          Diagnose mic
        </Button>
        <Button
          onClick={() => void onStart()}
          disabled={!canStart}
          variant="primary"
        >
          Start RTC
        </Button>
        <Button onClick={onStop} disabled={!isActive}>
          Stop
        </Button>
        <Button onClick={onToggleMute} disabled={!isActive}>
          {isMuted ? "Unmute" : "Mute"}
        </Button>
      </div>
    </section>
  );
}
