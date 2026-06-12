/* Recording fake realtime provider for affect side-channel BDD tests. */

import type {
  AudioChunk,
  IRealtimeProvider,
  ProviderError,
  ProviderFunctionCall,
  RealtimeSessionUpdate,
  TransportState,
} from "../../../src/server/index.js";

export class FakeAffectProvider implements IRealtimeProvider {
  readonly providerId = "fake-affect";
  state: TransportState = "disconnected";
  lastSpeechEndMs: number | null = null;
  currentResponseItemId: string | null = null;
  readonly submittedResults: Array<{ callId: string; result: unknown; triggerResponse?: boolean }> = [];
  private functionHandler: ((call: ProviderFunctionCall) => void) | null = null;

  get isConnected(): boolean { return this.state === "connected"; }
  async connect(): Promise<void> { this.state = "connected"; }
  async disconnect(): Promise<void> { this.state = "disconnected"; }
  async dispose(): Promise<void> { await this.disconnect(); }
  async sendAudio(_chunk: AudioChunk): Promise<void> {}
  onAudio(_handler: (chunk: AudioChunk) => void): void {}
  async updateSession(_config: RealtimeSessionUpdate): Promise<void> {}
  async createResponse(): Promise<void> {}
  async cancelResponse(): Promise<void> {}
  async truncateResponse(): Promise<void> {}

  async submitFunctionResult(callId: string, result: unknown, triggerResponse?: boolean): Promise<void> {
    this.submittedResults.push({ callId, result, triggerResponse });
  }

  onFunctionCall(handler: (call: ProviderFunctionCall) => void): void {
    this.functionHandler = handler;
  }

  onSpeechStarted(_handler: () => void): void {}
  onSpeechStopped(_handler: (audioEndMs?: number) => void): void {}
  onResponseStarted(_handler: (responseId: string) => void): void {}
  onResponseCompleted(_handler: (responseId: string) => void): void {}
  onTranscript(_handler: (text: string, isFinal: boolean, role?: "user" | "assistant") => void): void {}
  onError(_handler: (error: ProviderError) => void): void {}

  emitFunctionCall(call: ProviderFunctionCall): void {
    this.functionHandler?.(call);
  }
}

export async function waitFor(predicate: () => boolean, timeoutMs = 250): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("timed out waiting for the voice session");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
