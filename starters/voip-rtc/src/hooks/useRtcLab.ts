import {
  createBrowserVoiceSessionClient,
  type BrowserVoiceAudioMode,
  type VoiceProvider,
} from "@voiceagentsdk/core/client/browser";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CONFIG_URL, DEFAULT_WS_URL } from "../api/constants.js";
import { fetchRuntimeConfig } from "../api/runtimeApi.js";
import type { CompiledAgentSummary } from "../domain/builder.js";
import { eventFromMessage, type EventLogEntry } from "../domain/events.js";
import {
  createFallbackRuntimeProviders,
  initialSnapshot,
  type RuntimeConfig,
} from "../domain/runtime.js";
import {
  collectMicrophoneDiagnostic,
  useMicrophoneDiagnostic,
} from "./useMicrophoneDiagnostic.js";

export function useRtcLab(compiledAgent: CompiledAgentSummary | null) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [provider, setProvider] = useState<VoiceProvider>("gemini");
  const [model, setModel] = useState("");
  const [voice, setVoice] = useState("");
  const [audioMode, setAudioMode] =
    useState<BrowserVoiceAudioMode>("microphone");
  const [wsUrl, setWsUrl] = useState(
    withWsAuthToken(import.meta.env.VITE_VOICE_WS_URL ?? DEFAULT_WS_URL),
  );
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(
    null,
  );
  const [configError, setConfigError] = useState<string | null>(null);
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const {
    microphoneDiagnostic,
    setMicrophoneDiagnostic,
    runMicrophoneDiagnostic,
  } = useMicrophoneDiagnostic();

  const client = useMemo(() => {
    return createBrowserVoiceSessionClient({
      getWsUrl: () => wsUrl,
      audioMode,
      callbacks: {
        onSnapshot: setSnapshot,
        onMessage: (message) => {
          setEvents((current) =>
            [eventFromMessage(message), ...current].slice(0, 24),
          );
        },
        onError: (error) => {
          if (audioMode === "microphone") {
            void collectMicrophoneDiagnostic().then(setMicrophoneDiagnostic);
          }
          setEvents((current) => [
            {
              id: crypto.randomUUID(),
              label: "client.error",
              detail: error.message,
              timestamp: new Date().toLocaleTimeString(),
            },
            ...current,
          ]);
        },
      },
    });
  }, [audioMode, setMicrophoneDiagnostic, wsUrl]);

  useEffect(() => {
    return () => client.destroy();
  }, [client]);

  useEffect(() => {
    const configUrl = import.meta.env.VITE_VOICE_CONFIG_URL ?? DEFAULT_CONFIG_URL;
    const controller = new AbortController();

    async function loadRuntimeConfig(): Promise<void> {
      try {
        const config = await fetchRuntimeConfig(configUrl, controller.signal);
        setRuntimeConfig(config);
        setConfigError(null);

        const nextProvider =
          config.providers.find((item) => {
            return item.id === config.defaultProviderId && item.enabled;
          }) ?? config.providers.find((item) => item.enabled);

        if (nextProvider) {
          setProvider(nextProvider.id);
          setModel(nextProvider.defaultModel);
          setVoice(compiledAgent?.knowledge ? "Puck" : nextProvider.defaultVoice);
        }
        if (!import.meta.env.VITE_VOICE_WS_URL) {
          setWsUrl(withWsAuthToken(config.wsUrl));
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setConfigError(
          error instanceof Error ? error.message : "Failed to load config",
        );
      }
    }

    void loadRuntimeConfig();
    return () => controller.abort();
  }, [compiledAgent]);

  const providerOptions =
    runtimeConfig?.providers ?? createFallbackRuntimeProviders();
  const selectedProvider =
    providerOptions.find((item) => item.id === provider) ?? providerOptions[0];
  const isActive =
    snapshot.state !== "idle" &&
    snapshot.state !== "ended" &&
    snapshot.state !== "error";
  const canStart = Boolean(selectedProvider?.enabled) && !isActive;

  return {
    snapshot,
    provider,
    setProvider,
    model,
    setModel,
    voice,
    setVoice,
    audioMode,
    setAudioMode,
    wsUrl,
    setWsUrl,
    runtimeConfig,
    configError,
    events,
    client,
    microphoneDiagnostic,
    runMicrophoneDiagnostic,
    providerOptions,
    selectedProvider,
    isActive,
    canStart,
    startRtc: () =>
      client.connect({
        provider,
        model,
        voice,
        agent: compiledAgent?.draftId,
      }),
  };
}

function withWsAuthToken(url: string): string {
  const token = import.meta.env.VITE_VOICE_DEV_AUTH_TOKEN;
  if (!token) return url;
  try {
    const next = new URL(url);
    next.searchParams.set("token", token);
    return next.toString();
  } catch {
    return url;
  }
}
