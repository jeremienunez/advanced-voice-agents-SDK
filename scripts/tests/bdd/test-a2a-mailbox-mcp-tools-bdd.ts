import {
  createA2AMailboxMcpTools,
  createA2AMailboxTaskRouter,
  createInMemoryAgentMailbox,
  createMcpJsonRpcToolAdapter,
  ToolExecutionPolicyEngine,
} from "@voiceagentsdk/core/server";

const mailbox = createInMemoryAgentMailbox({
  idFactory: idSequence("mail"),
  now: clock([
    "2026-06-04T09:00:00.000Z",
    "2026-06-04T09:00:01.000Z",
    "2026-06-04T09:00:02.000Z",
    "2026-06-04T09:00:03.000Z",
  ]),
});
const router = createA2AMailboxTaskRouter({ mailbox });
const adapter = createMcpJsonRpcToolAdapter({
  tools: createA2AMailboxMcpTools({ router }),
  policy: new ToolExecutionPolicyEngine(),
  context: {
    sessionId: "mcp_a2a_mailbox_session",
    tenantId: "local",
    userId: "planner-user",
    agentId: "planner",
    providerId: "mcp",
  },
});

const results = [
  await scenarioMcpToolsExposeMailboxActions(),
  await scenarioMcpCanSendAndListA2ATasks(),
  await scenarioMcpCanClaimAndAckMailboxTasks(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioMcpToolsExposeMailboxActions(): Promise<string> {
  const response = await adapter.handle({
    jsonrpc: "2.0",
    id: "list-tools",
    method: "tools/list",
  });
  const result = response?.result as {
    tools?: Array<{
      annotations?: { readOnlyHint?: boolean; sideEffect?: string };
      name?: string;
    }>;
  } | undefined;
  const names = new Set(result?.tools?.map((tool) => tool.name));
  const send = result?.tools?.find((tool) => tool.name === "a2a_send_message");
  const list = result?.tools?.find((tool) => tool.name === "a2a_list_tasks");

  assert(names.has("a2a_send_message"), "MCP bridge must expose a2a_send_message");
  assert(names.has("a2a_list_tasks"), "MCP bridge must expose a2a_list_tasks");
  assert(names.has("a2a_claim_tasks"), "MCP bridge must expose a2a_claim_tasks");
  assert(names.has("a2a_ack_task"), "MCP bridge must expose a2a_ack_task");
  assert(send?.annotations?.sideEffect === "write", "mailbox send must be annotated as a write");
  assert(send?.annotations?.readOnlyHint === false, "mailbox send must not be read-only");
  assert(list?.annotations?.readOnlyHint === true, "mailbox list must be read-only");

  return "mcp-tools-expose-mailbox-actions";
}

async function scenarioMcpCanSendAndListA2ATasks(): Promise<string> {
  const sent = await callTool("send-1", "a2a_send_message", {
    targetAgentId: "researcher",
    contextId: "ctx_wine_trip",
    taskId: "task_research",
    subject: "Research",
    text: "Find source documents.",
  }) as A2AToolResult;
  const listed = await callTool("list-1", "a2a_list_tasks", {
    targetAgentId: "researcher",
    contextId: "ctx_wine_trip",
  }) as A2AToolResult[];

  assert(sent.id === "task_research", "send tool must preserve A2A task id");
  assert(sent.status?.state === "TASK_STATE_SUBMITTED", "send tool must create submitted task");
  assert(listed.length === 1, "list tool must expose target inbox");
  assert(listed[0]?.id === "task_research", "list tool must return the sent task");

  return "mcp-can-send-and-list-a2a-tasks";
}

async function scenarioMcpCanClaimAndAckMailboxTasks(): Promise<string> {
  await callTool("send-2", "a2a_send_message", {
    targetAgentId: "critic",
    contextId: "ctx_wine_trip",
    taskId: "task_review",
    text: "Review the final plan.",
  });
  const claimed = await callTool("claim-1", "a2a_claim_tasks", {
    targetAgentId: "critic",
    workerId: "critic-worker-1",
    leaseMs: 30_000,
    limit: 1,
  }) as A2AToolResult[];
  const acked = await callTool("ack-1", "a2a_ack_task", {
    targetAgentId: "critic",
    taskId: "task_review",
    status: "completed",
  }) as A2AToolResult;

  assert(claimed.length === 1, "claim tool must claim one mailbox task");
  assert(claimed[0]?.status?.state === "TASK_STATE_WORKING", "claim tool must map task to working");
  assert(acked.status?.state === "TASK_STATE_COMPLETED", "ack tool must complete the mailbox task");

  return "mcp-can-claim-and-ack-mailbox-tasks";
}

async function callTool(
  id: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const response = await adapter.handle({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const result = response?.result as {
    content?: Array<{ text?: string }>;
    isError?: boolean;
  } | undefined;

  assert(response?.id === id, "tools/call must preserve JSON-RPC id");
  assert(!response?.error, `tools/call ${name} must not return a JSON-RPC error`);
  assert(result?.isError !== true, `tools/call ${name} must not be marked error`);
  const text = result?.content?.[0]?.text;
  assert(typeof text === "string", `tools/call ${name} must return text content`);
  return JSON.parse(text);
}

interface A2AToolResult {
  id?: string;
  status?: { state?: string };
}

function idSequence(prefix: string): () => string {
  let current = 0;
  return () => `${prefix}_${++current}`;
}

function clock(values: string[]): () => Date {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]!);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
