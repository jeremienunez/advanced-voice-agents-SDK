import {
  createA2AAgentCard,
  createInMemoryAgentMailbox,
  mailboxMessageToA2ATask,
  toMcpToolDescriptor,
  toMcpToolDescriptors,
  type A2ATask,
  type AgentMailboxMessage,
  type AgentMailboxPort,
  type McpToolDescriptor,
} from "@voiceagentsdk/core/server";
import type {
  AgentMailboxSendInput,
  ProtocolCompatibilityProfile,
} from "@voiceagentsdk/core/sdk";

const results = [
  await scenarioMailboxSendsListsClaimsAndAcks(),
  await scenarioMailboxMapsToA2ATaskInbox(),
  await scenarioMcpToolMappingPreservesPolicyHints(),
  await scenarioProtocolCompatibilityTypesArePublic(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioMailboxSendsListsClaimsAndAcks(): Promise<string> {
  const mailbox = createInMemoryAgentMailbox({
    idFactory: idSequence("mail"),
    now: clock([
      "2026-06-04T08:00:00.000Z",
      "2026-06-04T08:00:01.000Z",
      "2026-06-04T08:00:02.000Z",
    ]),
  });

  const sent = await mailbox.send(messageInput({
    contextId: "ctx_trip",
    subject: "Find wine route hotels",
  }));
  const listed = await mailbox.list({
    tenantId: "local",
    targetAgentId: "planner",
    status: ["queued"],
  });
  const claimed = await mailbox.claim({
    tenantId: "local",
    targetAgentId: "planner",
    workerId: "planner-worker-1",
    leaseMs: 30_000,
    limit: 1,
  });
  const acked = await mailbox.ack({
    messageId: sent.id,
    tenantId: "local",
    targetAgentId: "planner",
    status: "completed",
  });

  assert(sent.id === "mail_1", "mailbox must use injected ids");
  assert(listed.length === 1, "mailbox must list queued messages for a recipient");
  assert(claimed[0]?.status === "claimed", "mailbox claim must mark message claimed");
  assert(
    claimed[0]?.leaseExpiresAt === "2026-06-04T08:00:31.000Z",
    "mailbox claim must record lease expiry",
  );
  assert(acked.status === "completed", "mailbox ack must persist terminal status");

  return "mailbox-sends-lists-claims-and-acks";
}

async function scenarioMailboxMapsToA2ATaskInbox(): Promise<string> {
  const mailbox = createInMemoryAgentMailbox({
    idFactory: idSequence("mail"),
    now: clock(["2026-06-04T08:00:00.000Z"]),
  });
  const message = await mailbox.send(messageInput({
    contextId: "ctx_trip",
    taskId: "task_route",
    referenceTaskIds: ["task_research"],
    subject: "Plan itinerary",
  }));
  const task = mailboxMessageToA2ATask(message);
  const firstMessage = task.history?.[0] as Record<string, any> | undefined;
  const firstPart = firstMessage?.parts?.[0] as Record<string, any> | undefined;

  assert(!hasOwn(task, "kind"), "A2A v1 task must not emit a legacy kind discriminator");
  assert(task.id === "task_route", "A2A task must preserve mailbox task id");
  assert(task.contextId === "ctx_trip", "A2A task must preserve context id");
  assert(task.status.state === "TASK_STATE_SUBMITTED" as any, "queued mailbox message must map to submitted task");
  assert(
    firstMessage?.role === "ROLE_USER",
    "A2A task history must expose ProtoJSON role values",
  );
  assert(
    firstPart?.text === "Please handle this.",
    "A2A task history must expose v1 text parts",
  );
  assert(!hasOwn(firstPart ?? {}, "kind"), "A2A v1 parts must not emit legacy kind");
  assert(
    task.history?.[0]?.referenceTaskIds?.[0] === "task_research",
    "A2A task history must preserve reference task links",
  );

  return "mailbox-maps-to-a2a-task-inbox";
}

async function scenarioMcpToolMappingPreservesPolicyHints(): Promise<string> {
  const tool = toMcpToolDescriptor({
    name: "mailbox_send",
    description: "Send a message to another agent mailbox.",
    category: "coordination",
    parameters: {
      type: "object",
      properties: { targetAgentId: { type: "string" } },
      required: ["targetAgentId"],
    },
    outputSchema: {
      type: "object",
      properties: { messageId: { type: "string" } },
    },
    sideEffect: "external_action",
    executionMode: "confirmation",
    maxCallsPerSession: 5,
    timeoutMs: 3000,
  });
  const tools = toMcpToolDescriptors([{
    name: "mailbox_list",
    description: "List mailbox messages.",
    parameters: { type: "object", properties: {}, required: [] },
    sideEffect: "read",
    executionMode: "automatic",
  }]);

  assert(tool.name === "mailbox_send", "MCP mapper must preserve tool name");
  assert(requiredFields(tool.inputSchema)[0] === "targetAgentId", "MCP mapper must preserve input schema");
  assert(tool.outputSchema?.type === "object", "MCP mapper must preserve output schema");
  assert(tool.annotations?.requiresConfirmation === true, "MCP mapper must mark confirmation tools");
  assert(tool.annotations?.sideEffect === "external_action", "MCP mapper must expose side effect hint");
  assert(tools[0]?.annotations?.readOnlyHint === true, "MCP mapper must mark read-only tools");

  return "mcp-tool-mapping-preserves-policy-hints";
}

async function scenarioProtocolCompatibilityTypesArePublic(): Promise<string> {
  const profile: ProtocolCompatibilityProfile = {
    mcp: { protocolVersion: "2025-11-25", transports: ["stdio", "streamable-http"] },
    a2a: { protocolVersion: "1.0", bindings: ["json-rpc-http", "http-json-rest"] },
  };
  const mailbox: AgentMailboxPort | null = null;
  const message: AgentMailboxMessage | null = null;
  const mcpTool: McpToolDescriptor | null = null;
  const task: A2ATask | null = null;
  const card = createA2AAgentCard({
    name: "Route des Vins Concierge",
    description: "Travel planning voice agent",
    url: "http://127.0.0.1:8787/a2a",
    version: "0.1.0-alpha.1",
    skills: [{
      id: "route-planning",
      name: "Route planning",
      description: "Plan wine route itineraries",
      tags: ["travel", "wine"],
    }],
    capabilities: { streaming: true, extendedAgentCard: true },
  });

  assert(profile.a2a?.protocolVersion === "1.0", "A2A profile type must compile");
  assert(card.protocolVersion === "1.0", "A2A card must default to v1.0");
  assert(
    card.supportedInterfaces?.[0]?.protocolBinding === "JSONRPC",
    "A2A card must advertise a JSON-RPC supported interface by default",
  );
  assert(
    card.supportedInterfaces?.[0]?.url === "http://127.0.0.1:8787/a2a",
    "A2A card supported interface must mirror the primary endpoint URL",
  );
  assert(mailbox === null, "mailbox port type must compile");
  assert(message === null, "mailbox message type must compile");
  assert(mcpTool === null, "MCP tool descriptor type must compile");
  assert(task === null, "A2A task type must compile");

  return "protocol-compatibility-types-are-public";
}

function messageInput(
  overrides: Partial<AgentMailboxSendInput> = {},
): AgentMailboxSendInput {
  return {
    tenantId: "local",
    source: { agentId: "researcher", userId: "demo" },
    target: { agentId: "planner", userId: "demo" },
    parts: [{ kind: "text", text: "Please handle this." }],
    ...overrides,
  };
}

function idSequence(prefix: string): () => string {
  let current = 0;
  return () => `${prefix}_${++current}`;
}

function clock(values: string[]): () => Date {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]!);
}

function requiredFields(schema: Record<string, unknown>): string[] {
  return Array.isArray(schema.required)
    ? schema.required.filter((value): value is string => typeof value === "string")
    : [];
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
