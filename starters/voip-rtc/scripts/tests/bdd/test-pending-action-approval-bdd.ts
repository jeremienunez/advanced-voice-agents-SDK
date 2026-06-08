import {
  ToolExecutionPolicyEngine,
  createInMemoryPendingActionPort,
  type VoiceSessionTool,
} from "@voiceagentsdk/core/server";
import type { AuthTicketPort, PendingActionRecord } from "@voiceagentsdk/core/sdk";
import type { WsData } from "../../../server/adapters/bun/voice-socket-adapter.js";
import { createFetchHandler } from "../../../server/http/routes.js";
import type { StarterRouteContext } from "../../../server/http/types.js";
import { createRuntimePendingActionApprovalService } from "../../../server/voice/pending-action-approval.js";
import { assert } from "../shared/assertions.js";
import { serverEnv } from "../fixtures/solid-seams/fixtures.js";

const results = [
  await scenarioApprovedPendingActionExecutesStoredArgsOnly(),
  await scenarioHttpApproveEndpointExecutesPendingAction(),
  await scenarioPendingActionScopeMismatchRejected(),
  await scenarioRejectedPendingActionDoesNotExecute(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioApprovedPendingActionExecutesStoredArgsOnly(): Promise<string> {
  const pendingActions = createInMemoryPendingActionPort({ idFactory: () => "pending-approved" });
  const calls: unknown[] = [];
  const engine = new ToolExecutionPolicyEngine({ pendingActions });
  const tool = writeTool(calls);
  const context = {
    sessionId: "session-approved",
    tenantId: "tenant-a",
    userId: "user-a",
    providerId: "provider-a",
  };
  const pending = await engine.execute({
    tool,
    args: { topic: "server stored topic", confirmed: true },
    context,
  }) as Record<string, unknown>;

  assert(pending.status === "confirmation_required", "write tool must create a pending action");
  assert(calls.length === 0, "write handler must not run before approval");
  pendingActions.resolve?.({ id: "pending-approved", status: "approved" });

  const result = await engine.executeApprovedPendingAction({
    pendingActionId: "pending-approved",
    tool,
    context,
  }) as Record<string, unknown>;

  assert(result.status === "follow_up_scheduled", "approved pending action must execute");
  assert(callCount(calls) === 1, "handler must run exactly once after approval");
  assert(
    (calls[0] as Record<string, unknown>).topic === "server stored topic",
    "approved execution must use stored pending arguments",
  );

  const stored = await pendingActions.get?.("pending-approved");
  assert(stored?.status === "executed", "pending action must record executed status");

  return "approved-pending-action-executes-stored-args-only";
}

async function scenarioHttpApproveEndpointExecutesPendingAction(): Promise<string> {
  const pendingActions = createInMemoryPendingActionPort({ idFactory: () => "pending-http" });
  const calls: Array<Record<string, unknown>> = [];
  const engine = new ToolExecutionPolicyEngine({ pendingActions });
  const tool = writeTool(calls);
  await engine.execute({
    tool,
    args: { topic: "http approved" },
    context: {
      sessionId: "session-http",
      tenantId: "tenant-http",
      userId: "user-http",
      providerId: "provider-http",
      agentId: "draft-http",
    },
  });
  const app = routeContext({
    runtimePendingActions: createRuntimePendingActionApprovalService({
      pendingActions,
      toolPolicyEngine: engine,
      resolveTools: (pending: PendingActionRecord) => {
        assert(
          pending.metadata?.agentId === "draft-http",
          "pending approval must preserve server-side agent metadata",
        );
        return [tool];
      },
    }),
  });
  const response = await createFetchHandler(app)(
    new Request("http://127.0.0.1:8787/builder/runtime/pending-actions/pending-http/approve", {
      method: "POST",
    }),
    {} as Bun.Server<WsData>,
  );

  assert(response?.status === 200, `approve endpoint must succeed, got ${response?.status}`);
  assert(calls.length === 1, "approve endpoint must execute handler once");
  assert(calls[0].topic === "http approved", "approve endpoint must use stored args");

  const stored = await pendingActions.get?.("pending-http");
  assert(stored?.status === "executed", "approve endpoint must mark pending action executed");

  return "http-approve-endpoint-executes-pending-action";
}

async function scenarioPendingActionScopeMismatchRejected(): Promise<string> {
  const pendingActions = createInMemoryPendingActionPort({ idFactory: () => "pending-mismatch" });
  const engine = new ToolExecutionPolicyEngine({ pendingActions });
  const tool = writeTool([]);
  await engine.execute({
    tool,
    args: { topic: "tenant scoped" },
    context: {
      sessionId: "session-a",
      tenantId: "tenant-a",
      userId: "user-a",
    },
  });
  pendingActions.resolve?.({ id: "pending-mismatch", status: "approved" });

  const error = await captureError(() =>
    engine.executeApprovedPendingAction({
      pendingActionId: "pending-mismatch",
      tool,
      context: {
        sessionId: "session-a",
        tenantId: "tenant-b",
        userId: "user-a",
      },
    })
  );

  assert(
    error?.message.includes("does not match"),
    `scope mismatch must be rejected, got ${error?.message ?? "success"}`,
  );

  return "pending-action-scope-mismatch-rejected";
}

async function scenarioRejectedPendingActionDoesNotExecute(): Promise<string> {
  const pendingActions = createInMemoryPendingActionPort({ idFactory: () => "pending-rejected" });
  const calls: unknown[] = [];
  const engine = new ToolExecutionPolicyEngine({ pendingActions });
  const tool = writeTool(calls);
  const context = { sessionId: "session-rejected", tenantId: "tenant-a" };
  await engine.execute({ tool, args: { topic: "blocked" }, context });
  pendingActions.resolve?.({ id: "pending-rejected", status: "rejected" });

  const error = await captureError(() =>
    engine.executeApprovedPendingAction({
      pendingActionId: "pending-rejected",
      tool,
      context,
    })
  );

  assert(
    error?.message.includes("approved"),
    `rejected pending action must not execute, got ${error?.message ?? "success"}`,
  );
  assert(calls.length === 0, "rejected action must not call handler");

  return "rejected-pending-action-does-not-execute";
}

function writeTool(calls: unknown[]): VoiceSessionTool {
  return {
    type: "function",
    name: "schedule_follow_up",
    description: "Schedule a follow-up.",
    parameters: {
      type: "object",
      properties: { topic: { type: "string" } },
      required: ["topic"],
    },
    policy: {
      sideEffect: "write",
      executionMode: "confirmation",
      timeoutMs: 100,
    },
    execute: async (args) => {
      calls.push(args);
      return { status: "follow_up_scheduled" };
    },
  };
}

function routeContext(
  overrides: Partial<StarterRouteContext>,
): StarterRouteContext {
  return {
    authTicketVerifier: authVerifier(),
    builderService: {
      handle: async () => ({ response: null }),
    },
    defaultProviderId: "gemini",
    env: serverEnv(),
    learningService: {
      approveInfraEvolution: async () => ({}),
      rollback: async () => ({}),
    },
    providerCatalog: [],
    voiceService: { activeSessionCount: 0 },
    ...overrides,
  };
}

function authVerifier(): AuthTicketPort {
  return {
    verifyTicket: () => ({ tenantId: "tenant-http", userId: "user-http" }),
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

function callCount(calls: readonly unknown[]): number {
  return calls.length;
}
