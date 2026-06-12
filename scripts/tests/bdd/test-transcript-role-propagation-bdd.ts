/* Transcript role propagation: assistant text from realtime transports
   must reach the browser bridge labeled "assistant" — today everything
   is hardcoded "user", which mislabels Gemini/Grok model speech. */

import {
  createRealtimeVoiceSession,
  type AudioChunk,
  type IRealtimeProvider,
  type ProviderError,
  type ProviderFunctionCall,
  type RealtimeSessionUpdate,
  type TransportState,
} from "../../../src/server/index.js";
import {
  handleGeminiServerMessage,
  type GeminiRealtimeEventState,
} from "../../../src/server/agent/transports/gemini-realtime/events.js";
import {
  handleGrokRealtimeMessage,
  type GrokRealtimeEventState,
} from "../../../src/server/agent/transports/grok-realtime/events.js";
import { GROK_EVENTS } from "../../../src/server/agent/types/grok.types.js";
import {
  createBrowserSessionCallbacks,
  type BrowserSessionCallbackDeps,
} from "../../../src/server/browser/voice-service/callbacks.js";
import type { ServerVoiceMessage } from "../../../src/sdk/types/browser-voice.js";

interface TranscriptEvent {
  text: string;
  isFinal: boolean;
  role: "user" | "assistant" | undefined;
}

const results = [
  scenarioGeminiModelTextIsLabeledAssistant(),
  scenarioGrokModelTranscriptIsLabeledAssistant(),
  await scenarioSessionPassesRoleThroughToCallbacks(),
  scenarioBridgeUsesProvidedRoleAndDefaultsToUser(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioGeminiModelTextIsLabeledAssistant(): string {
  const seen: TranscriptEvent[] = [];
  const state = {
    audioBuffer: { nextSequence: () => 0 },
    currentResponseId: null,
    currentItemId: null,
    lastAudioEndMs: null,
    responseStarted: false,
    handlers: {
      onTranscript: (text: string, isFinal: boolean, role?: "user" | "assistant") => {
        seen.push({ text, isFinal, role });
      },
    },
    logger: silentLogger(),
  } as unknown as GeminiRealtimeEventState;

  handleGeminiServerMessage(
    { serverContent: { modelTurn: { parts: [{ text: "bonjour" }] } } } as never,
    state,
  );

  assert(seen.length === 1, "gemini model text must reach onTranscript");
  assert(seen[0].text === "bonjour" && seen[0].isFinal === false, "gemini text payload intact");
  assert(seen[0].role === "assistant", `gemini model text must be role assistant, got ${seen[0].role}`);

  return "gemini-model-text-labeled-assistant";
}

function scenarioGrokModelTranscriptIsLabeledAssistant(): string {
  const seen: TranscriptEvent[] = [];
  const state = {
    lastSpeechEndMs: null,
    currentResponseItemId: null,
    audioSeq: 0,
    config: {},
    handlers: {
      onTranscript: (text: string, isFinal: boolean, role?: "user" | "assistant") => {
        seen.push({ text, isFinal, role });
      },
    },
    logger: silentLogger(),
  } as unknown as GrokRealtimeEventState;

  handleGrokRealtimeMessage(
    Buffer.from(JSON.stringify({ type: GROK_EVENTS.TRANSCRIPT_DELTA, delta: "sal" })),
    state,
  );
  handleGrokRealtimeMessage(
    Buffer.from(JSON.stringify({ type: GROK_EVENTS.TRANSCRIPT_DONE, transcript: "salut" })),
    state,
  );

  assert(seen.length === 2, "grok delta and done must both reach onTranscript");
  assert(seen[0].role === "assistant", `grok delta must be assistant, got ${seen[0].role}`);
  assert(seen[1].role === "assistant" && seen[1].isFinal, "grok done must be a final assistant transcript");

  return "grok-model-transcript-labeled-assistant";
}

async function scenarioSessionPassesRoleThroughToCallbacks(): Promise<string> {
  const provider = new FakeTranscriptProvider();
  const seen: TranscriptEvent[] = [];
  const session = createRealtimeVoiceSession(
    {
      sessionId: "session-role-bdd",
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      providerId: "fake",
    },
    { provider, tools: [] },
    {
      onTranscript: (text, isFinal, role) => {
        seen.push({ text, isFinal, role });
      },
    },
  );

  await session.start();
  provider.emitTranscript("model speech", true, "assistant");
  provider.emitTranscript("user speech", true, "user");
  provider.emitTranscript("legacy", false);
  await session.end();

  assert(seen.length === 3, "session must forward every transcript");
  assert(seen[0].role === "assistant", `session must pass assistant role through, got ${seen[0].role}`);
  assert(seen[1].role === "user", "session must pass user role through");
  assert(seen[2].role === undefined, "session must not invent a role when the transport gives none");

  return "session-passes-role-through";
}

function scenarioBridgeUsesProvidedRoleAndDefaultsToUser(): string {
  const emitted: ServerVoiceMessage[] = [];
  const active = { transcript: [] as Array<{ role: string }>, messageCount: 0 };
  const deps = {
    socket: {},
    mediaBridge: { sendAudio: async () => {} },
    browserSampleRate: 24000,
    getActiveSession: () => active,
    emitControl: (_socket: unknown, message: ServerVoiceMessage) => {
      emitted.push(message);
    },
  } as unknown as BrowserSessionCallbackDeps;

  const callbacks = createBrowserSessionCallbacks(deps);
  callbacks.onTranscript?.("model line", true, "assistant");
  callbacks.onTranscript?.("mic line", true);

  const transcripts = emitted.filter(
    (m): m is Extract<ServerVoiceMessage, { type: "transcript" }> => m.type === "transcript",
  );
  assert(transcripts.length === 2, "bridge must emit both transcripts");
  assert(
    transcripts[0].role === "assistant",
    `bridge must keep the assistant role, got ${transcripts[0].role}`,
  );
  assert(transcripts[1].role === "user", "bridge must default a role-less transcript to user");
  assert(active.transcript[0]?.role === "assistant", "stored learning entry must keep the assistant role");
  assert(active.transcript[1]?.role === "user", "stored learning entry must default to user");

  return "bridge-keeps-role-and-defaults-to-user";
}

class FakeTranscriptProvider implements IRealtimeProvider {
  readonly providerId = "fake-transcript-role";
  state: TransportState = "disconnected";
  lastSpeechEndMs: number | null = null;
  currentResponseItemId: string | null = null;
  private transcriptHandler:
    | ((text: string, isFinal: boolean, role?: "user" | "assistant") => void)
    | null = null;

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
  async createResponse(): Promise<void> {}
  async cancelResponse(): Promise<void> {}
  async truncateResponse(): Promise<void> {}
  async submitFunctionResult(): Promise<void> {}
  onFunctionCall(_handler: (call: ProviderFunctionCall) => void): void {}
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

  emitTranscript(text: string, isFinal: boolean, role?: "user" | "assistant"): void {
    this.transcriptHandler?.(text, isFinal, role);
  }
}

function silentLogger(): unknown {
  const noop = () => {};
  return { debug: noop, info: noop, warn: noop, error: noop };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.log(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
