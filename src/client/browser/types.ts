import type {
  ClientVoiceMessage,
  ServerVoiceMessage,
} from "../../sdk/types/browser-voice.js";

export type {
  BrowserVoiceState,
  ClientVoiceMessage,
  ServerVoiceMessage,
  VoiceLearningStatus,
  VoiceLearningSummary,
  VoiceProvider,
  VoiceSessionStartOptions,
  VoiceSessionSummary,
} from "../../sdk/types/browser-voice.js";

export interface VoiceWSCallbacks {
  onAudio: (buffer: ArrayBuffer) => void;
  onMessage: (message: ServerVoiceMessage) => void;
  onOpen: () => void;
  onClose: () => void;
  onError: (error: Event) => void;
}

export interface VoiceWSClient {
  readonly isConnected: boolean;
  connect(url: string): void;
  disconnect(): void;
  sendAudio(buffer: ArrayBuffer): void;
  sendControl(message: ClientVoiceMessage): void;
}

export const BROWSER_VOICE_AUDIO = {
  SAMPLE_RATE: 24000,
  CHANNELS: 1,
  BYTES_PER_SAMPLE: 2,
  CHUNK_SIZE: 1920,
} as const;
