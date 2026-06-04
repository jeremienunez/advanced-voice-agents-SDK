import {
  createA2AJsonRpcMailboxAdapter,
  createA2AMailboxTaskRouter,
  createInMemoryAgentMailbox,
} from "@voiceagentsdk/core/server";

const mailbox = createInMemoryAgentMailbox({
  idFactory: idSequence("mail"),
  now: clock([
    "2026-06-04T10:00:00.000Z",
    "2026-06-04T10:00:01.000Z",
    "2026-06-04T10:00:02.000Z",
  ]),
});
const adapter = createA2AJsonRpcMailboxAdapter({
  router: createA2AMailboxTaskRouter({ mailbox }),
});

const results = [
  await scenarioJsonRpcMessageSendCreatesTask(),
  await scenarioJsonRpcMethodAliasesReadAndCancelTask(),
  await scenarioJsonRpcUnknownTaskReturnsA2AError(),
  await scenarioJsonRpcUnknownMethodReturnsProtocolError(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioJsonRpcMessageSendCreatesTask(): Promise<string> {
  const response = await adapter.handle(
    {
      jsonrpc: "2.0",
      id: "send-1",
      method: "message/send",
      params: {
        sourceAgentId: "researcher",
        targetAgentId: "planner",
        message: {
          messageId: "msg-1",
          role: "ROLE_USER",
          taskId: "task_json",
          contextId: "ctx_json",
          parts: [{ text: "Prepare a JSON-RPC itinerary." }],
        },
      },
    },
    { tenantId: "local", sourceAgentId: "researcher" },
  );
  const result = response.result as Record<string, any> | undefined;

  assert(response.jsonrpc === "2.0", "JSON-RPC response must declare version");
  assert(response.id === "send-1", "JSON-RPC response must preserve id");
  assert(result?.task?.id === "task_json", "message/send must return an A2A SendMessageResponse task");
  assert(result?.task?.history?.[0]?.messageId === "msg-1", "message/send must preserve client messageId");
  assert(result?.task?.status?.state === "TASK_STATE_SUBMITTED", "message/send task must be submitted");

  return "json-rpc-message-send-creates-task";
}

async function scenarioJsonRpcMethodAliasesReadAndCancelTask(): Promise<string> {
  const context = { tenantId: "local", sourceAgentId: "researcher" };
  const getResponse = await adapter.handle({
    jsonrpc: "2.0",
    id: "get-1",
    method: "GetTask",
    params: { id: "task_json", targetAgentId: "planner" },
  }, context);
  const listResponse = await adapter.handle({
    jsonrpc: "2.0",
    id: "list-1",
    method: "tasks/list",
    params: { targetAgentId: "planner", contextId: "ctx_json" },
  }, context);
  const cancelResponse = await adapter.handle({
    jsonrpc: "2.0",
    id: "cancel-1",
    method: "CancelTask",
    params: { id: "task_json", targetAgentId: "planner" },
  }, context);
  const task = getResponse.result as Record<string, any> | undefined;
  const listed = listResponse.result as Array<Record<string, any>> | undefined;
  const canceled = cancelResponse.result as Record<string, any> | undefined;

  assert(task?.id === "task_json", "PascalCase GetTask alias must read tasks");
  assert(listed?.[0]?.id === "task_json", "tasks/list must list recipient tasks");
  assert(canceled?.status?.state === "TASK_STATE_CANCELED", "PascalCase CancelTask alias must cancel tasks");

  return "json-rpc-method-aliases-read-and-cancel-task";
}

async function scenarioJsonRpcUnknownTaskReturnsA2AError(): Promise<string> {
  const response = await adapter.handle({
    jsonrpc: "2.0",
    id: "missing-task",
    method: "GetTask",
    params: { id: "missing", targetAgentId: "planner" },
  }, { tenantId: "local", sourceAgentId: "researcher" });

  assert(response.id === "missing-task", "task not found error must preserve id");
  assert(response.error?.code === -32001, "unknown task must return A2A TaskNotFoundError");
  assert(response.error?.message === "Task not found", "unknown task must use A2A task error message");
  assert(Array.isArray(response.error?.data), "A2A errors must include structured error data");

  return "json-rpc-unknown-task-returns-a2a-error";
}

async function scenarioJsonRpcUnknownMethodReturnsProtocolError(): Promise<string> {
  const response = await adapter.handle({
    jsonrpc: "2.0",
    id: "bad-1",
    method: "unknown/method",
  });

  assert(response.id === "bad-1", "error response must preserve id");
  assert(response.error?.code === -32601, "unknown method must return method-not-found");
  assert(!("result" in response), "JSON-RPC error response must not include result");

  return "json-rpc-unknown-method-returns-protocol-error";
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
