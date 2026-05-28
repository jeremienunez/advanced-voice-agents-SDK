import type {
  LearningJobStatus,
  LearningSessionInput,
  ProviderDefinition,
} from "@voiceagentsdk/core/sdk";
import type { WsData } from "../server/adapters/bun/voice-socket-adapter.js";
import { createDevAuthTicketVerifier } from "../server/auth/dev-ticket-verifier.js";
import { validateInfraProvisionInput } from "../server/builder/domain/infra-provisioning.js";
import { summarizeDraftForBank } from "../server/builder/state/draft-bank-summary.js";
import { summarizePlannedKnowledge } from "../server/builder/state/draft-knowledge-summary.js";
import { summarizeDraftForSession } from "../server/builder/state/session-draft-summary.js";
import { accessGuard, originGuard } from "../server/http/guards.js";
import { createFetchHandler } from "../server/http/routes.js";
import type { StarterRouteContext } from "../server/http/types.js";
import { createSessionEndedLearningHook } from "../server/voice/learning-hook.js";
import { createProvider } from "../server/voice/provider-factory.js";
import { assert, assertThrows } from "./shared/assertions.js";
import {
  agentDraft,
  builderService,
  infraPlan,
  learningStatus,
  runtimeProvider,
  serverEnv,
  sessionEndedInput,
  voiceOptions,
} from "./solid-seams/fixtures.js";

const results = await Promise.all([
  scenarioHttpGuardsRejectCrossOriginAndMissingTokens(),
  scenarioVoiceProviderFactoryRejectsUnsupportedCatalogChoices(),
  scenarioVoiceLearningHookSkipsAndEnqueuesSessionLearning(),
  scenarioVoiceWsUsesVerifiedIdentity(),
  scenarioBuilderStateSerializersKeepDraftSummariesStable(),
  scenarioInfraProvisioningRejectsUnsafePlans(),
]);

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioHttpGuardsRejectCrossOriginAndMissingTokens() {
  const env = serverEnv();
  const verifier = createDevAuthTicketVerifier(env);
  const allowed = new Request("http://starter.test/builder/config", {
    headers: { origin: "http://localhost:5177" },
  });
  const blocked = new Request("http://starter.test/builder/config", {
    headers: { origin: "https://evil.example" },
  });

  assert(originGuard(env, allowed) === null, "allowed origins must pass");
  assert(originGuard(env, blocked)?.status === 403, "unknown origins must fail");
  assert(
    (await accessGuard(
      env,
      verifier,
      new Request("http://starter.test/health"),
      new URL("http://starter.test/health"),
    )).response === undefined,
    "unprotected routes must not require a token",
  );
  assert(
    (await accessGuard(
      env,
      verifier,
      new Request("http://starter.test/builder/config"),
      new URL("http://starter.test/builder/config"),
    )).response?.status === 401,
    "builder routes must reject missing tokens",
  );
  assert(
    (await accessGuard(
      env,
      verifier,
      new Request("http://starter.test/builder/config", {
        headers: { "x-voice-agent-token": "secret-token" },
      }),
      new URL("http://starter.test/builder/config"),
    )).identity?.tenantId === "local",
    "builder routes must accept the configured token",
  );

  return "http-guards";
}

async function scenarioVoiceWsUsesVerifiedIdentity() {
  const env = serverEnv();
  let captured: unknown;
  const app: StarterRouteContext = {
    authTicketVerifier: {
      verifyTicket: () => ({
        tenantId: "verified-tenant",
        userId: "verified-user",
        planId: "verified-plan",
      }),
    },
    builderService: { handle: async () => ({ response: null }) },
    defaultProviderId: "gemini",
    env,
    learningService: {
      approveInfraEvolution: async () => ({}),
      rollback: async () => ({}),
    },
    providerCatalog: [],
    voiceService: { activeSessionCount: 0 },
  };
  const server = {
    upgrade(_request: Request, options: { data: unknown }) {
      captured = options.data;
      return true;
    },
  } as unknown as Bun.Server<WsData>;
  const response = await createFetchHandler(app)(
    new Request("http://starter.test/voice/ws?tenantId=query&userId=query"),
    server,
  );
  const data = captured as { user?: { tenantId?: string; userId?: string } };

  assert(response === undefined, "successful websocket upgrade must return undefined");
  assert(data.user?.tenantId === "verified-tenant", "voice ws must use verified tenant");
  assert(data.user?.userId === "verified-user", "voice ws must use verified user");

  return "voice-ws-verified-identity";
}

async function scenarioVoiceProviderFactoryRejectsUnsupportedCatalogChoices() {
  const envName = "SOLID_SEAMS_PROVIDER_KEY";
  const previous = Bun.env[envName];
  Bun.env[envName] = "test-key";

  try {
    const definition: ProviderDefinition = {
      id: "gemini",
      kind: "gemini-live",
      model: "gemini-test",
      voice: "Puck",
    };
    const provider = createProvider(
      definition,
      {},
      [],
      voiceOptions({ providerCatalog: [runtimeProvider(envName)] }),
    );

    assert(typeof provider.connect === "function", "provider must expose connect");
    assert(typeof provider.sendAudio === "function", "provider must expose sendAudio");
    assertThrows(
      () => createProvider(
        definition,
        { model: "unsupported-model" },
        [],
        voiceOptions({ providerCatalog: [runtimeProvider(envName)] }),
      ),
      "Unsupported model",
    );
  } finally {
    if (previous === undefined) delete Bun.env[envName];
    else Bun.env[envName] = previous;
  }

  return "voice-provider-factory";
}

async function scenarioVoiceLearningHookSkipsAndEnqueuesSessionLearning() {
  const skippedStatuses: LearningJobStatus[] = [];
  const skippedHook = createSessionEndedLearningHook(voiceOptions());
  await skippedHook(sessionEndedInput(), (status) => skippedStatuses.push(status));
  assert(skippedStatuses.at(0)?.status === "skipped", "missing learning service must skip");

  const capture: { value?: LearningSessionInput } = {};
  const queuedStatuses: LearningJobStatus[] = [];
  const learning = {
    async approveInfraEvolution() {
      return {
        status: "skipped" as const,
        draftId: "draft-solid",
        version: 1,
        reason: "test",
      };
    },
    enqueueSessionLearning(input: LearningSessionInput, emit?: (status: LearningJobStatus) => void) {
      capture.value = input;
      const status = learningStatus("queued", input.draftId ?? "missing");
      emit?.(status);
      return status;
    },
    getLearningStatus() {
      return null;
    },
    async rollback() {
      return {
        status: "skipped" as const,
        draftId: "draft-solid",
        version: 1,
        reason: "test",
      };
    },
  };
  const enqueuedHook = createSessionEndedLearningHook(
    voiceOptions({
      learning,
      builderService: builderService(agentDraft("draft-solid")),
    }),
  );
  await enqueuedHook(sessionEndedInput(), (status) => queuedStatuses.push(status));

  const seen = capture.value;
  assert(seen, "learning service must receive a payload");
  assert(seen.agentId === "draft-solid", "payload must include agent id");
  assert(seen.userId === "user-a", "payload must include user id");
  assert(seen.transcript.length === 1, "payload must include transcript");
  assert(seen.toolCalls.length === 1, "payload must include tool calls");
  assert(seen.metadata?.provider === "gemini", "metadata must keep provider");
  assert(!("voice" in (seen.metadata ?? {})), "metadata must omit empty fields");
  assert(queuedStatuses.at(0)?.status === "queued", "hook must emit queued status");

  return "voice-learning-hook";
}

async function scenarioBuilderStateSerializersKeepDraftSummariesStable() {
  const draft = agentDraft("draft-summary");
  const bank = summarizeDraftForBank(draft, draft.id);
  const session = summarizeDraftForSession(draft);
  const plannedKnowledge = summarizePlannedKnowledge(draft);

  assert(bank.active === true, "active draft must be marked active");
  assert(bank.canRunRtc === true, "compiled draft must be RTC runnable");
  assert(bank.promptChars === draft.compiled?.prompt.length, "bank prompt size must use compiled prompt");
  assert(session.promptChars === draft.compiled?.prompt.length, "session prompt size must use compiled prompt");
  assert(plannedKnowledge?.chunkCount === 7, "planned knowledge must expose stored chunk count");

  return "builder-state-serializers";
}

async function scenarioInfraProvisioningRejectsUnsafePlans() {
  const draft = agentDraft("draft-infra");
  const valid = validateInfraProvisionInput({ draft, plan: infraPlan(draft.id) });
  assert(valid.ok, "valid local infra plan must pass");

  const invalid = validateInfraProvisionInput({
    draft,
    plan: infraPlan("other-draft", {
      defaultBackendId: "missing-backend",
      migrationPolicy: {
        source: "server_owned_templates",
        allowGeneratedSql: true,
        requiresApproval: false,
        versionTable: "agent_solid.schema_migrations",
      },
    }),
  });
  assert(!invalid.ok, "unsafe infra plan must fail");
  assert(
    invalid.errors.some((error) => error.includes("draftId must match")),
    "infra validation must bind plans to drafts",
  );
  assert(
    invalid.errors.some((error) => error.includes("Default backend")),
    "infra validation must reject unknown default backend",
  );
  assert(
    invalid.errors.some((error) => error.includes("generated SQL")),
    "infra validation must reject generated SQL execution",
  );

  return "infra-provisioning-validation";
}
