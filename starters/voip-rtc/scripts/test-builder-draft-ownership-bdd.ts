import type {
  AgentBuildDraft,
  AuthTicketIdentity,
  DatabaseProvisionInput,
} from "@voiceagentsdk/core/sdk";
import { fallbackDatabasePlan } from "../server/builder/domain/database.js";
import { mutateDraft } from "../server/builder/domain/drafts.js";
import { saveDraft } from "../server/builder/state/draft-store.js";
import type { BuilderWorkflowDependencies } from "../server/builder/types.js";
import { createBuilderWorkflows } from "../server/builder/workflows.js";
import { agentDraft } from "./solid-seams/fixtures.js";
import { assert } from "./shared/assertions.js";

const results = [
  await scenarioPrivilegedWorkflowRejectsCrossOwnerDraft(),
  await scenarioPrivilegedWorkflowUsesServerOwnedDraft(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioPrivilegedWorkflowRejectsCrossOwnerDraft() {
  const owner = identity("tenant-a", "user-a");
  const serverDraft = ownedDatabaseDraft("draft_owner_rejected", owner);
  const calls: DatabaseProvisionInput[] = [];
  saveDraft(serverDraft);

  const workflows = createBuilderWorkflows(workflowDeps(calls));
  const result = await captureError(() =>
    workflows.applyDatabase({
      draft: hostileDraft(serverDraft),
      draftId: serverDraft.id,
    }, { identity: identity("tenant-b", "user-b") })
  );

  assert(
    result?.message.includes("not owned by authenticated identity"),
    `cross-owner apply must be rejected, got ${result?.message ?? "success"}`,
  );
  assert(calls.length === 0, "database apply must not run for cross-owner drafts");

  return "privileged-cross-owner-draft-rejected";
}

async function scenarioPrivilegedWorkflowUsesServerOwnedDraft() {
  const owner = identity("tenant-c", "user-c");
  const serverDraft = ownedDatabaseDraft("draft_owner_applied", owner);
  const hostile = hostileDraft(serverDraft);
  const calls: DatabaseProvisionInput[] = [];
  saveDraft(serverDraft);

  const workflows = createBuilderWorkflows(workflowDeps(calls));
  await workflows.applyDatabase(
    { draft: hostile, draftId: serverDraft.id },
    { identity: owner },
  );

  assert(calls.length === 1, "database apply must run once for the owner");
  assert(calls[0].draft.id === serverDraft.id, "apply must use server draft id");
  assert(
    calls[0].plan.schemaName === serverDraft.databasePlan?.schemaName,
    "apply must use the server-side database plan",
  );
  assert(
    calls[0].plan.schemaName !== hostile.databasePlan?.schemaName,
    "request-supplied draft plan must be ignored",
  );

  return "privileged-owner-uses-server-draft";
}

function ownedDatabaseDraft(
  id: string,
  owner: AuthTicketIdentity,
): AgentBuildDraft {
  const draft = agentDraft(id);
  return mutateDraft(draft)
    .databasePlan(fallbackDatabasePlan({ draft, documents: [] }))
    .metadata({ builderOwner: owner })
    .build();
}

function hostileDraft(serverDraft: AgentBuildDraft): AgentBuildDraft {
  const draft = agentDraft(`${serverDraft.id}_hostile`);
  const plan = fallbackDatabasePlan({ draft, documents: [] });
  return mutateDraft(draft).databasePlan(plan).build();
}

function workflowDeps(
  calls: DatabaseProvisionInput[],
): BuilderWorkflowDependencies {
  return {
    databaseProvisioner: {
      isConfigured: () => true,
      validate: () => ({ ok: true, status: "validated", errors: [], warnings: [] }),
      async apply(input: DatabaseProvisionInput) {
        calls.push(input);
        return {
          status: "applied",
          schemaName: input.plan.schemaName,
          appliedStatements: [],
          warnings: [],
          appliedAt: new Date(0).toISOString(),
        };
      },
    },
  } as unknown as BuilderWorkflowDependencies;
}

function identity(
  tenantId: string,
  userId: string,
): AuthTicketIdentity {
  return { tenantId, userId, scopes: ["builder:access"] };
}

async function captureError(
  action: () => Promise<unknown>,
): Promise<Error | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
