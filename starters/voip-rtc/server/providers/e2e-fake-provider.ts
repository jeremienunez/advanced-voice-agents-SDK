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
  private transcriptHandler:
    | ((text: string, isFinal: boolean, role?: "user" | "assistant") => void)
    | null = null;
  private functionHandler: ((call: ProviderFunctionCall) => void) | null = null;
  readonly submittedResults: Array<{ callId: string; result: unknown }> = [];

  get isConnected(): boolean {
    return this.state === "connected";
  }

  async connect(): Promise<void> {
    this.state = "connected";
    this.transcriptHandler?.(
      "I prefer concise answers for route planning tests.",
      true,
    );
    /* deterministic affect probe: lets the E2E harness (and a human)
       see the hologram smile without a real model */
    setTimeout(() => {
      if (this.state !== "connected") return;
      this.emitFunctionCall({
        callId: "e2e-affect-1",
        name: "set_affect",
        arguments: JSON.stringify({ label: "smile", intensity: 0.8 }),
      });
    }, 2500);
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
    callId: string,
    result: unknown,
    _triggerResponse?: boolean,
  ): Promise<void> {
    this.submittedResults.push({ callId, result });
  }
  onFunctionCall(handler: (call: ProviderFunctionCall) => void): void {
    this.functionHandler = handler;
  }
  /** E2E hook: lets harness code drive a deterministic function call
      (e.g. set_affect) without a real model. */
  emitFunctionCall(call: ProviderFunctionCall): void {
    this.functionHandler?.(call);
  }
  onSpeechStarted(_handler: () => void): void {}
  onSpeechStopped(_handler: (audioEndMs?: number) => void): void {}
  onResponseStarted(_handler: (responseId: string) => void): void {}
  onResponseCompleted(_handler: (responseId: string) => void): void {}
  onTranscript(
    handler: (text: string, isFinal: boolean, role?: "user" | "assistant") => void,
  ): void {
    this.transcriptHandler = handler;
  }
  onError(_handler: (error: ProviderError) => void): void {}
}

export function isE2EFakeProviderEnabled(): boolean {
  return Bun.env.RTC_E2E_FAKE_PROVIDER === "1";
}
