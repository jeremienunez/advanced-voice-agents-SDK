import {
  createBrowserVoiceSessionClient,
  type BrowserVoiceSessionSnapshot,
  type ServerVoiceMessage,
} from "../../../src/client/browser/index.js";

const results = [
  scenarioToolCallStateUpsertsByCallId(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioToolCallStateUpsertsByCallId(): string {
  const snapshots: BrowserVoiceSessionSnapshot[] = [];
  const client = createBrowserVoiceSessionClient({
    getWsUrl: () => "ws://localhost/unused",
    callbacks: {
      onSnapshot: (snapshot) => snapshots.push(snapshot),
    },
    audioMode: "silent",
  });

  deliver(client, {
    type: "tool.call",
    tool: {
      callId: "call-approval",
      name: "schedule_follow_up",
      arguments: { topic: "Call customer" },
      status: "pending",
    },
  });
  deliver(client, {
    type: "tool.call",
    tool: {
      callId: "call-approval",
      name: "schedule_follow_up",
      arguments: { topic: "Call customer" },
      status: "executing",
    },
  });
  deliver(client, {
    type: "tool.call",
    tool: {
      callId: "call-approval",
      name: "schedule_follow_up",
      arguments: { topic: "Call customer" },
      status: "awaiting_confirmation",
    },
  });

  let snapshot = snapshots.at(-1);
  assert(snapshot, "client must publish a snapshot");
  assert(
    snapshot.toolCalls.length === 1,
    `same provider call id must upsert one tool call, got ${snapshot.toolCalls.length}`,
  );
  const awaitingCall = snapshot.toolCalls[0] as unknown as
    | Record<string, unknown>
    | undefined;
  assert(
    awaitingCall?.callId === "call-approval",
    "tool call snapshot must preserve callId",
  );
  assert(
    awaitingCall?.status === "awaiting_confirmation",
    `tool call snapshot must expose awaiting_confirmation, got ${String(awaitingCall?.status)}`,
  );

  deliver(client, {
    type: "tool.result",
    tool: {
      callId: "call-approval",
      name: "schedule_follow_up",
      result: { status: "approved" },
      status: "completed",
    },
  });

  snapshot = snapshots.at(-1);
  assert(snapshot, "client must publish final snapshot");
  assert(
    snapshot.toolCalls.length === 1,
    `tool result must complete the existing call, got ${snapshot.toolCalls.length}`,
  );
  const completedCall = snapshot.toolCalls[0] as unknown as
    | Record<string, unknown>
    | undefined;
  assert(
    completedCall?.status === "completed",
    `tool result must mark the call completed, got ${String(completedCall?.status)}`,
  );
  assert(
    JSON.stringify(completedCall?.result).includes("approved"),
    "tool result must preserve result payload",
  );

  return "browser-tool-call-state-upserts-by-call-id";
}

function deliver(
  client: ReturnType<typeof createBrowserVoiceSessionClient>,
  message: unknown,
): void {
  const testClient = client as unknown as {
    handleServerMessage(message: ServerVoiceMessage): void;
  };
  testClient.handleServerMessage(message as ServerVoiceMessage);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
