import type {
  AudioChunk,
  IRealtimeProvider,
  ProviderError,
  ProviderFunctionCall,
  RealtimeSessionUpdate,
  TransportState,
} from "@voiceagentsdk/core/server";

export class E2EFakeRealtimeProvider implements IRealtimeProvider {
  readonly providerId = "e2e-fake";
  state: TransportState = "disconnected";
  lastSpeechEndMs: number | null = null;
  currentResponseItemId: string | null = null;

  get isConnected(): boolean {
    return this.state === "connected";
  }

  async connect(): Promise<void> {
    this.state = "connected";
  }

  async disconnect(): Promise<void> {
    this.state = "disconnected";
  }

  async dispose(): Promise<void> {
    await this.disconnect();
  }

  async sendAudio(_chunk: AudioChunk): Promise<void> {}
  onAudio(_handler: (chunk: AudioChunk) => void): void {}
  async updateSession(_config: RealtimeSessionUpdate): Promise<void> {}
  async createResponse(_options?: Record<string, unknown>): Promise<void> {}
  async cancelResponse(): Promise<void> {}
  async truncateResponse(
    _itemId: string,
    _contentIndex: number,
    _audioEndMs: number,
  ): Promise<void> {}
  async submitFunctionResult(
    _callId: string,
    _result: unknown,
    _triggerResponse?: boolean,
  ): Promise<void> {}
  onFunctionCall(_handler: (call: ProviderFunctionCall) => void): void {}
  onSpeechStarted(_handler: () => void): void {}
  onSpeechStopped(_handler: (audioEndMs?: number) => void): void {}
  onResponseStarted(_handler: (responseId: string) => void): void {}
  onResponseCompleted(_handler: (responseId: string) => void): void {}
  onTranscript(_handler: (text: string, isFinal: boolean) => void): void {}
  onError(_handler: (error: ProviderError) => void): void {}
}

export function isE2EFakeProviderEnabled(): boolean {
  return Bun.env.RTC_E2E_FAKE_PROVIDER === "1";
}
