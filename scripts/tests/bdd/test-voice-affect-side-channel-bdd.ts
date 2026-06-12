/* Affect side-channel: a server-DEFINED tool marked sideChannel:"affect"
   lets the model signal facial affect alongside speech. The signal must
   bypass the pending-tool flow (it is a no-op render hint), while ACTION
   tools must keep the full policy lifecycle even if the model smuggles
   "sideChannel" into its arguments — that is the security falsification. */

import {
  createInMemoryPendingActionPort,
  createRealtimeVoiceSession,
  ToolExecutionPolicyEngine,
  type VoiceSessionTool,
} from "../../../src/server/index.js";
import { FakeAffectProvider, waitFor } from "./fake-affect-provider.js";
import {
  createBrowserSessionCallbacks,
  type BrowserSessionCallbackDeps,
} from "../../../src/server/browser/voice-service/callbacks.js";
import { createBrowserVoiceSessionClient } from "../../../src/client/browser/index.js";
import type {
  ServerVoiceMessage,
  VoiceAffect,
} from "../../../src/sdk/types/browser-voice.js";

const results = [
  await scenarioAffectToolIsInterceptedAsSideChannel(),
  await scenarioAffectIntensityIsClampedAndLabelsClosed(),
  await scenarioMalformedAffectArgumentsStayHarmless(),
  await scenarioActionToolCannotSmuggleSideChannelThroughArguments(),
  scenarioBridgeEmitsAffectMessage(),
  scenarioClientReducesAffectIntoSnapshot(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

interface AffectRun {
  affects: VoiceAffect[];
  toolEvents: string[];
  executeCalls: unknown[];
  provider: FakeAffectProvider;
}

async function runAffectCall(args: string): Promise<AffectRun> {
  const run: AffectRun = {
    affects: [],
    toolEvents: [],
    executeCalls: [],
    provider: new FakeAffectProvider(),
  };
  const session = createRealtimeVoiceSession(
    {
      sessionId: "session-affect-bdd",
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      providerId: "fake",
    },
    { provider: run.provider, tools: [affectTool(run.executeCalls)] },
    {
      onToolCall: (call) => run.toolEvents.push(call.status),
      onAffect: (affect) => run.affects.push(affect),
    },
  );
  await session.start();
  run.provider.emitFunctionCall({ callId: "call-affect", name: "set_affect", arguments: args });
  await waitFor(() => run.provider.submittedResults.length > 0 || run.toolEvents.length > 0);
  await session.end();
  return run;
}

async function scenarioAffectToolIsInterceptedAsSideChannel(): Promise<string> {
  const run = await runAffectCall(JSON.stringify({ label: "smile", intensity: 0.7 }));

  assert(run.affects.length === 1, "affect tool must emit exactly one onAffect");
  assert(
    run.affects[0].label === "smile" && Math.abs(run.affects[0].intensity - 0.7) < 1e-9,
    `affect payload must pass through, got ${JSON.stringify(run.affects[0])}`,
  );
  assert(run.toolEvents.length === 0, "affect side-channel must never enter the pending-tool flow");
  assert(run.executeCalls.length === 0, "affect tool execute must never run");
  assert(
    run.provider.submittedResults.length === 1,
    "the provider must still receive a function result so the model keeps talking",
  );
  const submitted = run.provider.submittedResults[0].result as Record<string, unknown>;
  assert(submitted.ok === true, `provider answer must be {ok:true}, got ${JSON.stringify(submitted)}`);

  return "affect-tool-intercepted-as-side-channel";
}

async function scenarioAffectIntensityIsClampedAndLabelsClosed(): Promise<string> {
  const over = await runAffectCall(JSON.stringify({ label: "concern", intensity: 5 }));
  assert(over.affects[0]?.intensity === 1, "intensity above 1 must clamp to 1");

  const under = await runAffectCall(JSON.stringify({ label: "concern", intensity: -2 }));
  assert(under.affects[0]?.intensity === 0, "intensity below 0 must clamp to 0");

  const omitted = await runAffectCall(JSON.stringify({ label: "smile" }));
  assert(
    Math.abs((omitted.affects[0]?.intensity ?? 0) - 0.6) < 1e-9,
    `omitted intensity on a valid label must use the documented default 0.6, got ${
      omitted.affects[0]?.intensity
    }`,
  );

  const unknown = await runAffectCall(JSON.stringify({ label: "rage", intensity: 0.5 }));
  assert(
    unknown.affects[0]?.label === "neutral",
    `labels outside the closed set must coerce to neutral, got ${unknown.affects[0]?.label}`,
  );
  assert(unknown.affects[0]?.intensity === 0.5, "coerced label must keep its clamped intensity");

  return "affect-intensity-clamped-and-labels-closed";
}

async function scenarioMalformedAffectArgumentsStayHarmless(): Promise<string> {
  const run = await runAffectCall("this is not json");
  assert(run.affects.length === 1, "malformed args must still resolve to a harmless affect");
  assert(
    run.affects[0].label === "neutral" && run.affects[0].intensity === 0,
    `malformed args must yield neutral/0, got ${JSON.stringify(run.affects[0])}`,
  );
  assert(run.provider.submittedResults.length === 1, "the provider must still be answered (no hang)");

  return "malformed-affect-arguments-stay-harmless";
}

async function scenarioActionToolCannotSmuggleSideChannelThroughArguments(): Promise<string> {
  const provider = new FakeAffectProvider();
  const affects: VoiceAffect[] = [];
  const toolEvents: string[] = [];
  const executeCalls: unknown[] = [];
  const pendingActions = createInMemoryPendingActionPort({
    idFactory: () => "pending-affect-smuggle",
  });
  const session = createRealtimeVoiceSession(
    {
      sessionId: "session-affect-smuggle-bdd",
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      providerId: "fake",
    },
    {
      provider,
      toolPolicyEngine: new ToolExecutionPolicyEngine({ pendingActions }),
      tools: [writeTool(executeCalls)],
    },
    {
      onToolCall: (call) => toolEvents.push(call.status),
      onAffect: (affect) => affects.push(affect),
    },
  );

  await session.start();
  provider.emitFunctionCall({
    callId: "call-smuggle",
    name: "schedule_follow_up",
    arguments: JSON.stringify({
      topic: "Call the customer",
      sideChannel: "affect",
      label: "smile",
      intensity: 1,
      confirmed: true,
    }),
  });
  await waitFor(
    () =>
      toolEvents.includes("awaiting_confirmation") ||
      toolEvents.includes("completed") ||
      toolEvents.includes("failed") ||
      provider.submittedResults.length > 0,
  );
  await session.end();

  assert(affects.length === 0, "model-supplied sideChannel argument must never trigger onAffect");
  assert(executeCalls.length === 0, "the write handler must not execute without approval");
  assert(
    provider.submittedResults.length === 0,
    "confirmation_required must not leak to the model as a tool result",
  );
  assert(
    toolEvents.join(",") === "pending,executing,awaiting_confirmation",
    `action tool must keep the full policy lifecycle, got ${toolEvents.join(",")}`,
  );

  return "action-tool-cannot-smuggle-side-channel";
}

function scenarioBridgeEmitsAffectMessage(): string {
  const emitted: ServerVoiceMessage[] = [];
  const deps = {
    socket: {},
    mediaBridge: { sendAudio: async () => {} },
    browserSampleRate: 24000,
    getActiveSession: () => undefined,
    emitControl: (_socket: unknown, message: ServerVoiceMessage) => {
      emitted.push(message);
    },
  } as unknown as BrowserSessionCallbackDeps;

  const callbacks = createBrowserSessionCallbacks(deps);
  callbacks.onAffect?.({ label: "surprise", intensity: 0.8 });

  const affect = emitted.find((m) => m.type === "affect");
  assert(
    affect !== undefined &&
      affect.type === "affect" &&
      affect.affect.label === "surprise" &&
      affect.affect.intensity === 0.8,
    `bridge must emit the typed affect message, got ${JSON.stringify(affect)}`,
  );

  return "bridge-emits-affect-message";
}

function scenarioClientReducesAffectIntoSnapshot(): string {
  const snapshots: Array<{ affect: (VoiceAffect & { at: number }) | null }> = [];
  const client = createBrowserVoiceSessionClient({
    getWsUrl: () => "ws://localhost/unused",
    callbacks: {
      onSnapshot: (snapshot) => snapshots.push(snapshot as (typeof snapshots)[number]),
    },
    audioMode: "silent",
  });
  const testClient = client as unknown as {
    handleServerMessage(message: ServerVoiceMessage): void;
  };

  testClient.handleServerMessage({
    type: "affect",
    affect: { label: "thinking", intensity: 0.6 },
  } as ServerVoiceMessage);

  const affect = snapshots.at(-1)?.affect ?? null;
  assert(
    affect !== null &&
      affect.label === "thinking" &&
      affect.intensity === 0.6 &&
      typeof affect.at === "number",
    `snapshot must carry the timestamped affect, got ${JSON.stringify(affect)}`,
  );

  return "client-reduces-affect-into-snapshot";
}

function affectTool(calls: unknown[]): VoiceSessionTool {
  return {
    type: "function",
    name: "set_affect",
    description: "Signal the agent's current facial affect.",
    parameters: {
      type: "object",
      properties: {
        label: { type: "string", enum: ["neutral", "smile", "concern", "surprise", "thinking"] },
        intensity: { type: "number" },
      },
      required: ["label"],
    },
    sideChannel: "affect",
    execute: async (args) => {
      calls.push(args);
      return { status: "should_never_run" };
    },
  };
}

function writeTool(calls: unknown[]): VoiceSessionTool {
  return {
    type: "function",
    name: "schedule_follow_up",
    description: "Schedule a follow-up task.",
    parameters: {
      type: "object",
      properties: { topic: { type: "string" } },
      required: ["topic"],
    },
    policy: {
      sideEffect: "write",
      executionMode: "confirmation",
      confirmationReason: "Write side effect.",
    },
    execute: async (args) => {
      calls.push(args);
      return { status: "follow_up_scheduled" };
    },
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.log(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
