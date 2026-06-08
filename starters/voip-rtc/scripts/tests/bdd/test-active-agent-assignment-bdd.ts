import type { AgentBuildDraft } from "@voiceagentsdk/core/sdk";
import type { BrowserVoiceSessionRequest } from "@voiceagentsdk/core/server/browser";
import {
  createGlobalActiveAgentAssignment,
  createScopedActiveAgentAssignment,
} from "../../../server/builder/state/active-agent-assignment.js";
import { createVoiceSessionFactory } from "../../../server/voice/session-factory.js";
import { agentDraft, runtimeProvider, voiceOptions } from "../fixtures/solid-seams/fixtures.js";
import { assert } from "../shared/assertions.js";

const results = [
  await scenarioGlobalAssignmentKeepsLocalDx(),
  await scenarioScopedAssignmentIsolatesTenants(),
  await scenarioProductionVoiceUsesScopedAssignment(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioGlobalAssignmentKeepsLocalDx(): Promise<string> {
  const assignment = createGlobalActiveAgentAssignment();
  await assignment.setActiveAgent({ draftId: "draft-global" });
  const active = await assignment.getActiveAgent({
    tenantId: "any-tenant",
    userId: "any-user",
  });

  assert(active === "draft-global", "global assignment must keep local active draft DX");
  return "global-assignment-keeps-local-dx";
}

async function scenarioScopedAssignmentIsolatesTenants(): Promise<string> {
  const assignment = createScopedActiveAgentAssignment();
  await assignment.setActiveAgent({
    tenantId: "tenant-a",
    userId: "user-a",
    planId: "dev",
    draftId: "draft-a",
  });

  const sameScope = await assignment.getActiveAgent({
    tenantId: "tenant-a",
    userId: "user-a",
    planId: "dev",
  });
  const otherTenant = await assignment.getActiveAgent({
    tenantId: "tenant-b",
    userId: "user-a",
    planId: "dev",
  });

  assert(sameScope === "draft-a", "scoped assignment must resolve the scoped draft");
  assert(!otherTenant, "scoped assignment must not leak across tenants");
  return "scoped-assignment-isolates-tenants";
}

async function scenarioProductionVoiceUsesScopedAssignment(): Promise<string> {
  const draft = agentDraft("draft-scoped-voice");
  const assignment = createScopedActiveAgentAssignment();
  await assignment.setActiveAgent({
    tenantId: "tenant-a",
    userId: "user-a",
    planId: "dev",
    draftId: draft.id,
  });
  let requestedDraftId: string | undefined;
  const baseOptions = voiceOptions();
  const factory = createVoiceSessionFactory(voiceOptions({
    activeAgentAssignment: assignment,
    builderService: trackingBuilderService(draft, (draftId) => {
      requestedDraftId = draftId;
    }),
    providerCatalog: [runtimeProvider("GEMINI_API_KEY")],
    sdk: {
      ...baseOptions.sdk,
      getMediaBridge: () => ({ id: "browser", kind: "browser-websocket" }),
      getProvider: () => ({
        id: "gemini",
        kind: "gemini-live",
        model: "gemini-test",
        voice: "Puck",
        apiKey: { name: "GEMINI_API_KEY" },
      }),
      promptFor: () => "test prompt",
    },
    starterMode: "production",
    tenantResolver: {
      resolveTenant: () => ({
        tenantId: "tenant-a",
        providerId: "gemini",
        mediaBridgeId: "browser",
        planId: "dev",
        userId: "user-a",
      }),
    },
  }));

  await factory(requestWithoutAgent(), {});

  assert(
    requestedDraftId === draft.id,
    `production voice session must use scoped active assignment, got ${requestedDraftId ?? "none"}`,
  );
  return "production-voice-uses-scoped-assignment";
}

function trackingBuilderService(
  draft: AgentBuildDraft,
  onDraftId: (draftId: string | undefined) => void,
) {
  return {
    getCompiledArtifact: (draftId: string | undefined) => {
      onDraftId(draftId);
      return draftId === draft.id ? draft.compiled : undefined;
    },
    getCompiledDraft: (draftId: string | undefined) => {
      onDraftId(draftId);
      return draftId === draft.id ? draft : undefined;
    },
    getActiveSession: () => ({}),
    handle: async () => ({ response: null }),
  };
}

function requestWithoutAgent(): BrowserVoiceSessionRequest {
  return {
    sessionId: "session-active-assignment",
    provider: "gemini",
    user: { tenantId: "tenant-a", userId: "user-a", planId: "dev" },
  };
}
