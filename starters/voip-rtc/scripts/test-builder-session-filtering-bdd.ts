import type { AgentBuildDraft, AuthTicketIdentity } from "@voiceagentsdk/core/sdk";
import { mutateDraft } from "../server/builder/domain/drafts.js";
import { appendServerOwnedPromptPolicy } from "../server/builder/domain/prompt-policy.js";
import { builderAgentBankPayload } from "../server/builder/state/agent-bank-payload.js";
import { saveDraft } from "../server/builder/state/draft-store.js";
import { builderSessionPayload } from "../server/builder/state/session-payload.js";
import { setActiveDraft } from "../server/builder/state/session-store.js";
import { agentDraft } from "./solid-seams/fixtures.js";
import { assert } from "./shared/assertions.js";

const results = [
  scenarioBuilderSessionFiltersByOwner(),
  scenarioBuilderAgentBankFiltersByOwner(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioBuilderSessionFiltersByOwner(): string {
  const draftA = saveOwnedCompiledDraft("draft_session_filter_a", owner("tenant-a", "user-a"));
  const draftB = saveOwnedCompiledDraft("draft_session_filter_b", owner("tenant-b", "user-b"));
  setActiveDraft(draftA.id);

  const payload = builderSessionPayload({ identity: owner("tenant-b", "user-b") });
  const availableIds = availableDraftIds(payload);

  assert(payload.activeDraftId !== draftA.id, "session payload must not expose another owner active draft");
  assert(availableIds.includes(draftB.id), "session payload must include caller owned draft");
  assert(!availableIds.includes(draftA.id), "session payload must filter foreign drafts");
  return "builder-session-filters-by-owner";
}

function scenarioBuilderAgentBankFiltersByOwner(): string {
  const draftA = saveOwnedCompiledDraft("draft_agent_bank_filter_a", owner("tenant-a", "user-a"));
  const draftB = saveOwnedCompiledDraft("draft_agent_bank_filter_b", owner("tenant-b", "user-b"));
  setActiveDraft(draftA.id);

  const payload = builderAgentBankPayload({ identity: owner("tenant-b", "user-b") });
  const agentIds = agentDraftIds(payload);

  assert(agentIds.includes(draftB.id), "agent bank must include caller owned draft");
  assert(!agentIds.includes(draftA.id), "agent bank must filter foreign drafts");
  assert(payload.activeDraftId !== draftA.id, "agent bank must not expose foreign active draft");
  return "builder-agent-bank-filters-by-owner";
}

function saveOwnedCompiledDraft(
  id: string,
  identity: AuthTicketIdentity,
): AgentBuildDraft {
  const base = agentDraft(id);
  const prompt = appendServerOwnedPromptPolicy("Base prompt.", base, []);
  const draft = mutateDraft(base)
    .finalPrompt(prompt)
    .compiled({ ...base.compiled!, prompt })
    .metadata({
      builderOwner: {
        tenantId: identity.tenantId,
        userId: identity.userId,
        planId: identity.planId,
      },
    })
    .build();
  saveDraft(draft);
  return draft;
}

function owner(tenantId: string, userId: string): AuthTicketIdentity {
  return { tenantId, userId, planId: "dev" };
}

function availableDraftIds(payload: Record<string, unknown>): string[] {
  const available = payload.available;
  assert(Array.isArray(available), "session payload must include available drafts");
  return available
    .map((item) => (item as Record<string, unknown>).draftId)
    .filter((id): id is string => typeof id === "string");
}

function agentDraftIds(payload: Record<string, unknown>): string[] {
  const agents = payload.agents;
  assert(Array.isArray(agents), "agent bank payload must include agents");
  return agents
    .map((item) => (item as Record<string, unknown>).draftId)
    .filter((id): id is string => typeof id === "string");
}
