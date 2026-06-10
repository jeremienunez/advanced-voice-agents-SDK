import type { AgentBankItem } from "../../../src/domain/builder/types.js";
import {
  defaultSelectedAgent,
  filterAgents,
  readinessLabel,
} from "../../../src/features/agent-bank/agent-bank-view-model.js";

const results = [
  scenarioQueryMatchesNameIntentAndDraftId(),
  scenarioStatusFiltersPartitionTheBank(),
  scenarioDefaultSelectionPrefersTheActiveAgent(),
  scenarioReadinessLabelsAreCoherent(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

function scenarioQueryMatchesNameIntentAndDraftId(): string {
  const bank = [
    makeAgent({ draftId: "draft-wine", publicAgentName: "Route des Vins", intent: "Wine tour concierge" }),
    makeAgent({ draftId: "draft-bank", publicAgentName: "Teller", intent: "Banking support agent" }),
  ];

  assert(filterAgents(bank, "ROUTE", "all").length === 1, "name match must be case-insensitive");
  assert(filterAgents(bank, "banking", "all").length === 1, "intent must be searchable");
  assert(filterAgents(bank, "draft-wine", "all").length === 1, "draft id must be searchable");
  assert(filterAgents(bank, "   ", "all").length === 2, "blank query must keep every agent");
  assert(filterAgents(bank, "nothing-matches", "all").length === 0, "miss must return empty");

  return "query-matches-name-intent-and-draft-id";
}

function scenarioStatusFiltersPartitionTheBank(): string {
  const compiledReady = makeAgent({ draftId: "a", kind: "compiled", canRunRtc: true });
  const compiledBroken = makeAgent({ draftId: "b", kind: "compiled", canRunRtc: false });
  const draft = makeAgent({ draftId: "c", kind: "draft", canRunRtc: false });
  const bank = [compiledReady, compiledBroken, draft];

  assert(filterAgents(bank, "", "compiled").length === 2, "compiled filter must keep both compiled agents");
  assert(filterAgents(bank, "", "draft").length === 1, "draft filter must keep only drafts");
  assert(filterAgents(bank, "", "ready").length === 1, "ready filter must require canRunRtc");
  assert(filterAgents(bank, "", "warning").length === 2, "warning filter must catch everything not runnable");
  assert(filterAgents(bank, "", "all").length === 3, "all filter must keep the whole bank");

  return "status-filters-partition-the-bank";
}

function scenarioDefaultSelectionPrefersTheActiveAgent(): string {
  const idle = makeAgent({ draftId: "idle" });
  const active = makeAgent({ draftId: "live", active: true });
  const bank = [idle, active];

  const chosen = defaultSelectedAgent(bank);
  assert(chosen?.draftId === "live", "the active agent must win the default selection");
  assert(defaultSelectedAgent([idle])?.draftId === "idle", "without an active agent the first one is selected");
  assert(defaultSelectedAgent([]) === null, "an empty bank selects nothing");
  /* the carousel index derives from this selection: it must always point
     inside the visible list, never at a stale two-state copy */
  assert(bank.includes(chosen!), "the default selection must be an element of the visible list");

  return "default-selection-prefers-the-active-agent";
}

function scenarioReadinessLabelsAreCoherent(): string {
  assert(
    readinessLabel(makeAgent({ canRunRtc: true })) === "Ready for RTC",
    "runnable agents must read ready",
  );
  assert(
    readinessLabel(makeAgent({ kind: "draft", canRunRtc: false })) === "Draft",
    "drafts must read draft",
  );
  assert(
    readinessLabel(makeAgent({ kind: "compiled", canRunRtc: false })) === "Needs attention",
    "broken compiled agents must ask for attention",
  );

  return "readiness-labels-are-coherent";
}

function makeAgent(overrides: Partial<AgentBankItem>): AgentBankItem {
  return {
    draftId: "draft-0",
    kind: "compiled",
    publicAgentName: "Agent",
    intent: "Test intent",
    status: "compiled",
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    active: false,
    canRunRtc: false,
    knowledge: null,
    database: null,
    selectedTools: [],
    promptChars: 0,
    ...overrides,
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
