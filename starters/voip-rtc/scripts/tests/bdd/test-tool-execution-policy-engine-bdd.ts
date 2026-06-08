import {
  ToolExecutionPolicyEngine,
  createInMemoryPendingActionPort,
  type VoiceSessionTool,
} from "@voiceagentsdk/core/server";
import { assert } from "../shared/assertions.js";

const results = [
  await scenarioPolicyEngineValidatesArgumentsAndRedactsResult(),
  await scenarioPolicyEngineEnforcesAuthorizationAndCallLimit(),
  await scenarioPolicyEngineTimesOutHandlers(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioPolicyEngineValidatesArgumentsAndRedactsResult() {
  const audits: string[] = [];
  const engine = new ToolExecutionPolicyEngine({
    pendingActions: createInMemoryPendingActionPort({ idFactory: () => "pending-a" }),
    audit: (event) => {
      audits.push(`${event.type}:${event.toolName}`);
    },
  });
  const tool = readTool(async () => ({
    status: "ok",
    apiKey: "secret-value",
    nested: { token: "live-token" },
  }));
  const missing = await captureError(() =>
    engine.execute({
      tool,
      args: {},
      context: { sessionId: "session-policy-engine" },
    })
  );

  assert(
    missing?.message.includes("query"),
    `schema validation must reject missing required args, got ${missing?.message ?? "success"}`,
  );

  const result = await engine.execute({
    tool,
    args: { query: "Bordeaux" },
    context: { sessionId: "session-policy-engine" },
  }) as Record<string, unknown>;

  assert(result.apiKey === "[REDACTED]", "top-level secret fields must be redacted");
  assert(
    (result.nested as Record<string, unknown>).token === "[REDACTED]",
    "nested token fields must be redacted",
  );
  assert(
    audits.includes("tool.rejected:search_knowledge") &&
      audits.includes("tool.completed:search_knowledge"),
    `policy engine must audit rejected and completed calls, got ${audits.join(",")}`,
  );

  return "policy-engine-validates-arguments-and-redacts-result";
}

async function scenarioPolicyEngineEnforcesAuthorizationAndCallLimit() {
  const engine = new ToolExecutionPolicyEngine({
    pendingActions: createInMemoryPendingActionPort(),
    authorize: ({ args }) => args.query !== "blocked",
  });
  const tool = readTool(async () => ({ status: "ok" }), { maxCallsPerSession: 1 });
  const denied = await captureError(() =>
    engine.execute({
      tool,
      args: { query: "blocked" },
      context: { sessionId: "session-authz" },
    })
  );

  assert(
    denied?.message.includes("not authorized"),
    `authorization hook must reject blocked calls, got ${denied?.message ?? "success"}`,
  );

  await engine.execute({
    tool,
    args: { query: "first" },
    context: { sessionId: "session-authz" },
  });
  const limited = await captureError(() =>
    engine.execute({
      tool,
      args: { query: "second" },
      context: { sessionId: "session-authz" },
    })
  );

  assert(
    limited?.message.includes("maxCallsPerSession"),
    `call limit must reject repeated calls, got ${limited?.message ?? "success"}`,
  );

  return "policy-engine-enforces-authorization-and-call-limit";
}

async function scenarioPolicyEngineTimesOutHandlers() {
  const engine = new ToolExecutionPolicyEngine({
    pendingActions: createInMemoryPendingActionPort(),
  });
  const timeout = await captureError(() =>
    engine.execute({
      tool: readTool(() => new Promise(() => {}), { timeoutMs: 5 }),
      args: { query: "slow" },
      context: { sessionId: "session-timeout" },
    })
  );

  assert(
    timeout?.message.includes("timed out"),
    `policy engine must timeout slow handlers, got ${timeout?.message ?? "success"}`,
  );

  return "policy-engine-times-out-handlers";
}

function readTool(
  execute: VoiceSessionTool["execute"],
  policy: Partial<NonNullable<VoiceSessionTool["policy"]>> = {},
): VoiceSessionTool {
  return {
    type: "function",
    name: "search_knowledge",
    description: "Search knowledge.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    policy: {
      sideEffect: "read",
      executionMode: "explicit",
      ...policy,
    },
    execute,
  };
}

async function captureError(action: () => Promise<unknown>): Promise<Error | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
