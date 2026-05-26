import type {
  AudioChunk,
  ProviderError,
  ProviderFunctionCall,
} from "../../types/transport.types.js";

export interface CascadedHandlers {
  onAudio: ((chunk: AudioChunk) => void) | null;
  onFunctionCall: ((call: ProviderFunctionCall) => void) | null;
  onSpeechStarted: (() => void) | null;
  onSpeechStopped: ((audioEndMs?: number) => void) | null;
  onResponseStarted: ((id: string) => void) | null;
  onResponseCompleted: ((id: string) => void) | null;
  onTranscript: ((text: string, isFinal: boolean) => void) | null;
  onError: ((error: ProviderError) => void) | null;
}

export function createCascadedHandlers(): CascadedHandlers {
  return {
    onAudio: null,
    onFunctionCall: null,
    onSpeechStarted: null,
    onSpeechStopped: null,
    onResponseStarted: null,
    onResponseCompleted: null,
    onTranscript: null,
    onError: null,
  };
}
