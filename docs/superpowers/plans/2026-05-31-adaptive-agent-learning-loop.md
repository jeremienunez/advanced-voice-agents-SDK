# Adaptive Agent Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `Adaptive Agent Learning Loop` as a public SDK feature with embedded-first defaults, distributed-ready ports, profile-gated mutations, terminal learning statuses, and a starter demo that proves the closed loop.

**Architecture:** Add public learning loop contracts to the SDK, then implement a small orchestrator around run persistence, extraction, memory writes, policy decisions, evolution, approval, audit, and status sinks. Refactor the VOIP RTC starter to use the SDK loop while keeping the existing local and Temporal drivers behind adapters.

**Tech Stack:** TypeScript, Bun, pnpm, SDK public exports, starter VOIP RTC server, local file/in-memory adapters, optional Temporal worker dispatch, BDD scripts.

---

## File Structure

Create SDK files:

- `src/sdk/learning/index.ts` exports the SDK learning feature.
- `src/sdk/learning/in-memory-run-repository.ts` stores learning runs for embedded usage.
- `src/sdk/learning/default-extractor.ts` contains deterministic session signal extraction.
- `src/sdk/learning/default-policy.ts` maps extracted signals and profile into mutation decisions.
- `src/sdk/learning/agent-learning-loop.ts` orchestrates the feature.

Modify SDK files:

- `src/sdk/types/learning.ts` expands public learning statuses, profiles, records, and ports.
- `src/sdk/index.ts` exports `./learning/index.js`.
- `src/index.ts` picks up SDK exports through `src/sdk/index.ts`.

Create or modify test scripts:

- Create `scripts/test-adaptive-learning-loop-core-bdd.ts`.
- Modify `scripts/test-public-boundaries-bdd.ts`.
- Modify `package.json` to add `test:adaptive-learning-loop:bdd` and include it in `audit:solid`.

Modify starter server files:

- `starters/voip-rtc/server/learning/run-state.ts` implements the new repository port.
- `starters/voip-rtc/server/learning/workflow.ts` delegates extraction/policy shape to SDK primitives where possible.
- `starters/voip-rtc/server/learning/temporal-workflow.ts` emits richer statuses.
- `starters/voip-rtc/server/learning/temporal-worker/worker-port.ts` keeps dispatch semantics and supports terminal status reporting through the shared repository.
- `starters/voip-rtc/server/learning/service.ts` becomes the starter facade over `AgentLearningLoop`.
- `starters/voip-rtc/server/voice/learning-hook.ts` passes profile-aware options.
- `starters/voip-rtc/server/builder/onboarding/env-store.ts` and `starters/voip-rtc/server/builder/composition.ts` expose `AGENT_LEARNING_PROFILE`.

Modify starter client files:

- `starters/voip-rtc/src/domain/runtime.ts` accepts richer learning status snapshots.
- `starters/voip-rtc/src/domain/events.ts` summarizes `evaluated`, `pending_approval`, and `rejected`.
- `starters/voip-rtc/src/features/rtc/RtcLab.tsx` surfaces the latest learning state.
- Create `starters/voip-rtc/src/features/rtc/components/LearningTimeline.tsx`.
- Modify `starters/voip-rtc/src/features/rtc/components/RtcPanels.css` for compact timeline styling.

Modify docs:

- `README.md` adds the SDK feature summary.
- `starters/voip-rtc/README.md` documents `AGENT_LEARNING_PROFILE` and the starter demo profile.
- `TODO.md` moves this feature from planning into the implementation sprint list.

---

### Task 1: Public Learning Loop Types

**Files:**

- Modify: `src/sdk/types/learning.ts`
- Modify: `scripts/test-public-boundaries-bdd.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing public-boundary test**

In `scripts/test-public-boundaries-bdd.ts`, extend the type import block:

```ts
import type {
  AgentLearningLoopPort,
  AgentLearningPolicyPort,
  AgentSkillArtifact,
  EvaluationHarnessPort,
  LearningDelta,
  LearningPromotionState,
  LearningLoopProfile,
  LearningReceipt,
  LearningRunRecord,
  LearningRunRepositoryPort,
  LearningRunStatus,
  LearningWorkflowDriverPort,
} from "@voiceagentsdk/core/sdk";
```

Add a scenario to the `results` array:

```ts
await scenarioLearningLoopPortsArePublicTypes(),
```

Add the scenario function:

```ts
async function scenarioLearningLoopPortsArePublicTypes(): Promise<string> {
  type PublicLearningLoopTypes = [
    AgentLearningLoopPort,
    AgentLearningPolicyPort,
    AgentSkillArtifact,
    EvaluationHarnessPort,
    LearningDelta,
    LearningPromotionState,
    LearningLoopProfile,
    LearningReceipt,
    LearningRunRecord,
    LearningRunRepositoryPort,
    LearningRunStatus,
    LearningWorkflowDriverPort,
  ];
  const compileOnly: PublicLearningLoopTypes | null = null;
  assert(compileOnly === null, "learning loop ports must be public type exports");
  return "learning-loop-ports-are-public-types";
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test:public-boundaries:bdd
```

Expected: TypeScript fails because `AgentLearningLoopPort`, `LearningRunRecord`, and related types are not exported.

- [ ] **Step 3: Expand `src/sdk/types/learning.ts`**

Replace the existing `LearningRunStatus` type with:

```ts
export type LearningRunStatus =
  | "queued"
  | "running"
  | "evaluated"
  | "applied"
  | "pending_approval"
  | "rejected"
  | "failed"
  | "skipped";

export type LearningLoopProfile =
  | "observe"
  | "memory_only"
  | "memory_and_candidates"
  | "auto_apply_prompt_safe"
  | "approval_required";
```

Add these public records and ports after `LearningSessionInput`:

```ts
export interface LearningRunDecision {
  action: "none" | "write_memory" | "candidate" | "apply" | "pending_approval" | "reject";
  reason: string;
  requiresApproval?: boolean;
  confidence?: number;
  metadata?: JsonObject;
}

export type LearningDeltaKind = "memory" | "prompt" | "skill" | "tool" | "infra";
export type LearningPromotionScope = "session" | "user" | "agent" | "tenant" | "global";
export type LearningPromotionState =
  | "candidate"
  | "evaluated"
  | "approved"
  | "active"
  | "rolled_back"
  | "rejected"
  | "expired";

export interface LearningDelta {
  id: string;
  kind: LearningDeltaKind;
  scope: LearningPromotionScope;
  title: string;
  summary: string;
  confidence: number;
  payload: JsonObject;
  sourceSessionIds: string[];
  promotionState: LearningPromotionState;
}

export interface AgentSkillArtifact {
  id: string;
  title: string;
  description: string;
  scope: "agent" | "tenant" | "global";
  preconditions: string[];
  procedure: string[];
  pitfalls: string[];
  validationChecks: string[];
  sourceSessionIds: string[];
  confidence: number;
  createdAt: string;
  updatedAt?: string;
  metadata?: JsonObject;
}

export interface EvaluationResult {
  status: "passed" | "failed" | "skipped";
  score?: number;
  checks: Array<{
    name: string;
    status: "passed" | "failed" | "skipped";
    message?: string;
  }>;
  metadata?: JsonObject;
}

export interface LearningReceipt {
  id: string;
  runId: string;
  sourceSessionId: string;
  inputHash: string;
  redactions: string[];
  deltas: LearningDelta[];
  decision: LearningRunDecision;
  evaluation?: EvaluationResult;
  previousArtifactId?: string;
  nextArtifactId?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface LearningRunRecord {
  jobId: string;
  runId: string;
  status: LearningRunStatus;
  profile: LearningLoopProfile;
  agentId?: string;
  draftId?: string;
  tenantId?: string;
  userId?: string;
  sourceSessionId?: string;
  queuedAt: string;
  startedAt?: string;
  evaluatedAt?: string;
  finishedAt?: string;
  decision?: LearningRunDecision;
  message?: string;
  error?: string;
  metadata?: JsonObject;
}

export interface LearningLoopEnqueueOptions {
  profile?: LearningLoopProfile;
  onStatus?: (status: LearningRunRecord) => void;
}

export interface AgentLearningLoopPort {
  enqueueSessionLearning(
    input: LearningSessionInput,
    options?: LearningLoopEnqueueOptions,
  ): Promise<LearningRunRecord> | LearningRunRecord;
  getLearningRun(
    runId: string,
  ): Promise<LearningRunRecord | null> | LearningRunRecord | null;
}

export interface LearningRunRepositoryPort {
  createQueued(
    input: LearningSessionInput,
    options: { profile: LearningLoopProfile; runId: string; jobId: string },
  ): Promise<LearningRunRecord> | LearningRunRecord;
  save(record: LearningRunRecord): Promise<LearningRunRecord> | LearningRunRecord;
  get(runId: string): Promise<LearningRunRecord | null> | LearningRunRecord | null;
  findBySource?(
    input: { sourceSessionId: string; agentId?: string; draftId?: string },
  ): Promise<LearningRunRecord | null> | LearningRunRecord | null;
}

export interface LearningWorkflowDriverPort {
  enqueue(
    input: LearningSessionInput,
    run: LearningRunRecord,
  ): Promise<LearningRunRecord> | LearningRunRecord;
}

export interface LearningStatusSinkPort {
  publish(status: LearningRunRecord): void | Promise<void>;
}

export interface LearningAuditEvent {
  type: string;
  runId: string;
  at: string;
  payload?: JsonObject;
}

export interface LearningAuditSinkPort {
  emit(event: LearningAuditEvent): void | Promise<void>;
}

export interface EvaluationHarnessInput {
  input: LearningSessionInput;
  deltas: LearningDelta[];
}

export interface EvaluationHarnessPort {
  evaluate(input: EvaluationHarnessInput): EvaluationResult | Promise<EvaluationResult>;
}
```

Keep `LearningJobStatus` temporarily as a backwards-compatible alias:

```ts
export type LearningJobStatus = LearningRunRecord;
```

Do not change `TemporalWorkflowPort` yet; that compatibility is handled in a later task.

- [ ] **Step 4: Run the public-boundary test**

Run:

```bash
pnpm test:public-boundaries:bdd
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sdk/types/learning.ts scripts/test-public-boundaries-bdd.ts package.json
git commit -m "Expose adaptive learning loop contracts"
```

---

### Task 2: Embedded Run Repository and Status Persistence

**Files:**

- Create: `src/sdk/learning/in-memory-run-repository.ts`
- Create: `src/sdk/learning/index.ts`
- Modify: `src/sdk/index.ts`
- Create: `scripts/test-adaptive-learning-loop-core-bdd.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing repository test**

Create `scripts/test-adaptive-learning-loop-core-bdd.ts`:

```ts
import {
  createInMemoryLearningRunRepository,
} from "@voiceagentsdk/core/sdk";
import type {
  LearningRunRecord,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";

const results = [
  await scenarioRepositoryCreatesAndPersistsRuns(),
  await scenarioRepositoryFindsDuplicateSessionRuns(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioRepositoryCreatesAndPersistsRuns(): Promise<string> {
  const repository = createInMemoryLearningRunRepository();
  const input = learningInput();
  const queued = await repository.createQueued(input, {
    profile: "memory_only",
    runId: "learn-session-a",
    jobId: "job-session-a",
  });
  assert(queued.status === "queued", "repository must create queued run");
  assert(queued.sourceSessionId === "session-a", "run must track source session");
  const running: LearningRunRecord = {
    ...queued,
    status: "running",
    startedAt: new Date().toISOString(),
  };
  await repository.save(running);
  const stored = await repository.get("learn-session-a");
  assert(stored?.status === "running", "repository must persist updated status");
  return "repository-creates-and-persists-runs";
}

async function scenarioRepositoryFindsDuplicateSessionRuns(): Promise<string> {
  const repository = createInMemoryLearningRunRepository();
  const input = learningInput();
  await repository.createQueued(input, {
    profile: "memory_only",
    runId: "learn-session-a",
    jobId: "job-session-a",
  });
  const found = await repository.findBySource?.({
    sourceSessionId: "session-a",
    agentId: "agent-a",
    draftId: "draft-a",
  });
  assert(found?.runId === "learn-session-a", "repository must support idempotency lookup");
  return "repository-finds-duplicate-session-runs";
}

function learningInput(): LearningSessionInput {
  return {
    agentId: "agent-a",
    draftId: "draft-a",
    tenantId: "tenant-a",
    userId: "user-a",
    summary: {
      sessionId: "session-a",
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      startedAt: 0,
      endedAt: 100,
      durationMs: 100,
      messageCount: 1,
      toolCallCount: 0,
      endReason: "completed",
    },
    transcript: [],
    toolCalls: [],
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(JSON.stringify({ status: "error", error: message }, null, 2));
    process.exit(1);
  }
}
```

Add scripts to `package.json`:

```json
"test:adaptive-learning-loop:bdd": "pnpm build && pnpm exec tsc --noEmit --target ES2023 --module NodeNext --moduleResolution NodeNext --lib ES2023,DOM --strict --skipLibCheck scripts/test-adaptive-learning-loop-core-bdd.ts && bun run scripts/test-adaptive-learning-loop-core-bdd.ts"
```

Add `pnpm test:adaptive-learning-loop:bdd` to `audit:solid` after `pnpm test:learning-preserves-server-policy:bdd`.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test:adaptive-learning-loop:bdd
```

Expected: FAIL because `createInMemoryLearningRunRepository` is missing.

- [ ] **Step 3: Implement the repository**

Create `src/sdk/learning/in-memory-run-repository.ts`:

```ts
import type {
  LearningLoopProfile,
  LearningRunRecord,
  LearningRunRepositoryPort,
  LearningSessionInput,
} from "../types.js";

export function createInMemoryLearningRunRepository(): LearningRunRepositoryPort {
  const runs = new Map<string, LearningRunRecord>();

  return {
    createQueued(input, options) {
      const run: LearningRunRecord = {
        jobId: options.jobId,
        runId: options.runId,
        status: "queued",
        profile: options.profile,
        agentId: input.agentId,
        draftId: input.draftId,
        tenantId: input.tenantId,
        userId: input.userId,
        sourceSessionId: input.summary.sessionId,
        queuedAt: new Date().toISOString(),
        message: "Learning job queued.",
      };
      runs.set(run.runId, run);
      return run;
    },

    save(record) {
      runs.set(record.runId, record);
      return record;
    },

    get(runId) {
      return runs.get(runId) ?? null;
    },

    findBySource(input) {
      return Array.from(runs.values()).find((run) => {
        return (
          run.sourceSessionId === input.sourceSessionId &&
          (!input.agentId || run.agentId === input.agentId) &&
          (!input.draftId || run.draftId === input.draftId)
        );
      }) ?? null;
    },
  };
}

export function normalizeLearningLoopProfile(
  value: LearningLoopProfile | undefined,
  fallback: LearningLoopProfile = "memory_only",
): LearningLoopProfile {
  return value ?? fallback;
}
```

Create `src/sdk/learning/index.ts`:

```ts
export * from "./in-memory-run-repository.js";
```

Modify `src/sdk/index.ts`:

```ts
export * from "./learning/index.js";
```

- [ ] **Step 4: Run the test**

Run:

```bash
pnpm test:adaptive-learning-loop:bdd
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sdk/learning src/sdk/index.ts scripts/test-adaptive-learning-loop-core-bdd.ts package.json
git commit -m "Add embedded learning run repository"
```

---

### Task 3: Deterministic Extractor and Policy Decisions

**Files:**

- Modify: `src/sdk/types/learning.ts`
- Create: `src/sdk/learning/default-extractor.ts`
- Create: `src/sdk/learning/default-policy.ts`
- Modify: `src/sdk/learning/index.ts`
- Modify: `scripts/test-adaptive-learning-loop-core-bdd.ts`

- [ ] **Step 1: Write failing extractor and policy scenarios**

Add imports:

```ts
import {
  createDefaultLearningPolicy,
  extractDefaultSessionLearningSignals,
} from "@voiceagentsdk/core/sdk";
```

Add scenarios to the `results` array:

```ts
await scenarioExtractorRedactsSecretsAndFindsSignals(),
await scenarioPolicyProfilesGateMutations(),
```

Add functions:

```ts
async function scenarioExtractorRedactsSecretsAndFindsSignals(): Promise<string> {
  const signals = extractDefaultSessionLearningSignals(learningInput({
    transcript: "I prefer short answers for Acme Routes. api_key=sk-test-secret-value",
    toolStatus: "failed",
    toolError: "Unknown tool create_invoice",
  }));
  assert(signals.memories.length >= 3, "extractor must produce summary, preference, and failed tool memories");
  assert(signals.memories.every((memory) => !memory.text.includes("sk-test-secret-value")), "extractor must redact secrets");
  assert(signals.missingTools.includes("create_invoice"), "extractor must retain missing tool recommendation");
  return "extractor-redacts-secrets-and-finds-signals";
}

async function scenarioPolicyProfilesGateMutations(): Promise<string> {
  const policy = createDefaultLearningPolicy();
  const signals = extractDefaultSessionLearningSignals(learningInput({
    transcript: "I prefer short answers.",
    toolStatus: "failed",
    toolError: "Unknown tool create_invoice",
  }));
  const memoryOnly = await policy.decide({
    profile: "memory_only",
    input: learningInput(),
    signals,
  });
  const autoApply = await policy.decide({
    profile: "auto_apply_prompt_safe",
    input: learningInput(),
    signals,
  });
  const approvalRequired = await policy.decide({
    profile: "approval_required",
    input: learningInput(),
    signals,
  });
  assert(memoryOnly.action === "write_memory", "memory_only must not mutate agent artifacts");
  assert(autoApply.action === "apply", "auto_apply_prompt_safe must apply prompt-safe changes");
  assert(approvalRequired.action === "pending_approval", "approval_required must require approval");
  return "policy-profiles-gate-mutations";
}
```

Change `learningInput` to accept overrides:

```ts
function learningInput(options: {
  transcript?: string;
  toolStatus?: string;
  toolError?: string;
} = {}): LearningSessionInput {
  return {
    agentId: "agent-a",
    draftId: "draft-a",
    tenantId: "tenant-a",
    userId: "user-a",
    summary: {
      sessionId: "session-a",
      tenantId: "tenant-a",
      userId: "user-a",
      channel: "voice",
      startedAt: 0,
      endedAt: 100,
      durationMs: 100,
      messageCount: options.transcript ? 1 : 0,
      toolCallCount: options.toolStatus ? 1 : 0,
      endReason: "completed",
    },
    transcript: options.transcript
      ? [{ role: "user", text: options.transcript, isFinal: true, timestamp: 50 }]
      : [],
    toolCalls: options.toolStatus
      ? [{
          callId: "call-a",
          toolName: "create_invoice",
          arguments: {},
          status: options.toolStatus,
          startedAt: 60,
          completedAt: 80,
          error: options.toolError,
        }]
      : [],
  };
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test:adaptive-learning-loop:bdd
```

Expected: FAIL because extractor and policy exports are missing.

- [ ] **Step 3: Add signal and policy types**

In `src/sdk/types/learning.ts`, add:

```ts
export interface LearningMemorySignal {
  kind: TemporalMemoryRecord["kind"];
  text: string;
  data?: JsonValue;
}

export interface SessionLearningSignals {
  memories: LearningMemorySignal[];
  graph: {
    nodes: GraphMemoryNode[];
    edges: GraphMemoryEdge[];
  };
  missingTools: string[];
  promptRecommendation?: string;
  retrievalWeights?: Record<string, number>;
  confidence: number;
}

export interface SessionLearningExtractorPort {
  extract(input: LearningSessionInput): SessionLearningSignals | Promise<SessionLearningSignals>;
}

export interface AgentLearningPolicyInput {
  profile: LearningLoopProfile;
  input: LearningSessionInput;
  signals: SessionLearningSignals;
}

export interface AgentLearningPolicyPort {
  decide(
    input: AgentLearningPolicyInput,
  ): LearningRunDecision | Promise<LearningRunDecision>;
}
```

- [ ] **Step 4: Implement the extractor**

Create `src/sdk/learning/default-extractor.ts`:

```ts
import type {
  GraphMemoryEdge,
  GraphMemoryNode,
  LearningSessionInput,
  SessionLearningSignals,
} from "../types.js";

export function extractDefaultSessionLearningSignals(
  input: LearningSessionInput,
): SessionLearningSignals {
  const finalTranscript = input.transcript
    .filter((entry) => entry.isFinal && entry.text.trim())
    .map((entry) => sanitizeText(`${entry.role}: ${entry.text}`));
  const userText = input.transcript
    .filter((entry) => entry.isFinal && entry.role === "user")
    .map((entry) => entry.text.trim())
    .filter(Boolean)
    .join(" ");
  const failedTools = input.toolCalls.filter((call) => call.status === "failed");
  const missingTools = failedTools
    .filter((call) => /unknown tool|missing|not configured/i.test(call.error ?? ""))
    .map((call) => call.toolName);
  const memories = [
    {
      kind: "summary" as const,
      text: finalTranscript.length
        ? `Session summary: ${finalTranscript.slice(0, 6).join(" | ")}`
        : "Session summary: no final user transcript was captured.",
      data: {
        durationMs: input.summary.durationMs,
        messageCount: input.summary.messageCount,
        toolCallCount: input.summary.toolCallCount,
        endReason: input.summary.endReason,
      },
    },
    ...extractPreferences(userText).map((text) => ({
      kind: "preference" as const,
      text,
      data: { source: "transcript" },
    })),
    ...failedTools.map((call) => ({
      kind: "failed_intent" as const,
      text: `Tool ${call.toolName} failed: ${sanitizeText(call.error ?? "unknown error")}`,
      data: { toolName: call.toolName },
    })),
    ...missingTools.map((toolName) => ({
      kind: "missing_tool" as const,
      text: `Missing or unavailable tool requested: ${toolName}`,
      data: { toolName },
    })),
  ];
  const nodes = graphNodes(input, userText);
  const edges = graphEdges(input, nodes);
  return {
    memories,
    graph: { nodes, edges },
    missingTools,
    promptRecommendation: memories.map((memory) => memory.text).join("\n"),
    retrievalWeights: {
      temporal: finalTranscript.length ? 0.35 : 0.2,
      graph: nodes.length > 1 ? 0.3 : 0.15,
      knowledge: 0.35,
    },
    confidence: finalTranscript.length || failedTools.length ? 0.8 : 0.35,
  };
}
```

Keep helper functions short by copying the existing `extractPreferences`, `graphNodes`, `graphEdges`, `extractEntities`, `uniqueNodes`, `stableToken`, and `sanitizeText` from `starters/voip-rtc/server/learning/workflow.ts`. Keep this file under 300 LOC.

- [ ] **Step 5: Implement the policy**

Create `src/sdk/learning/default-policy.ts`:

```ts
import type {
  AgentLearningPolicyPort,
  LearningRunDecision,
} from "../types.js";

export function createDefaultLearningPolicy(): AgentLearningPolicyPort {
  return {
    decide({ profile, signals }): LearningRunDecision {
      if (profile === "observe") {
        return {
          action: "none",
          reason: "Learning profile is observe; no writes or mutations were performed.",
          confidence: signals.confidence,
        };
      }
      if (profile === "memory_only") {
        return {
          action: "write_memory",
          reason: "Learning profile allows scoped memory writes only.",
          confidence: signals.confidence,
        };
      }
      if (profile === "memory_and_candidates") {
        return {
          action: "candidate",
          reason: "Learning profile writes memory and creates inactive candidate deltas.",
          confidence: signals.confidence,
        };
      }
      if (profile === "approval_required") {
        return {
          action: "pending_approval",
          reason: "Learning profile requires approval before agent mutation.",
          requiresApproval: true,
          confidence: signals.confidence,
        };
      }
      if (signals.confidence < 0.5) {
        return {
          action: "reject",
          reason: "Learning signal confidence is too low for automatic evolution.",
          confidence: signals.confidence,
        };
      }
      return {
        action: "apply",
        reason: "Prompt-safe learning is eligible for automatic application.",
        confidence: signals.confidence,
      };
    },
  };
}
```

Modify `src/sdk/learning/index.ts`:

```ts
export * from "./default-extractor.js";
export * from "./default-policy.js";
export * from "./in-memory-run-repository.js";
```

- [ ] **Step 6: Run the test**

Run:

```bash
pnpm test:adaptive-learning-loop:bdd
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/sdk/types/learning.ts src/sdk/learning scripts/test-adaptive-learning-loop-core-bdd.ts
git commit -m "Add adaptive learning extraction and policy"
```

---

### Task 4: AgentLearningLoop Orchestrator

**Files:**

- Create: `src/sdk/learning/agent-learning-loop.ts`
- Modify: `src/sdk/learning/index.ts`
- Modify: `src/sdk/types/learning.ts`
- Modify: `scripts/test-adaptive-learning-loop-core-bdd.ts`

- [ ] **Step 1: Write failing orchestrator profile scenarios**

Add imports:

```ts
import {
  createAgentLearningLoop,
  createDefaultLearningPolicy,
} from "@voiceagentsdk/core/sdk";
```

Add scenarios:

```ts
await scenarioLoopRunsMemoryOnlyWithoutEvolution(),
await scenarioLoopAppliesPromptSafeEvolution(),
await scenarioLoopIsIdempotentBySourceSession(),
```

Add functions:

```ts
async function scenarioLoopRunsMemoryOnlyWithoutEvolution(): Promise<string> {
  const repository = createInMemoryLearningRunRepository();
  const memoryWrites: number[] = [];
  const evolutionCalls: string[] = [];
  const loop = createAgentLearningLoop({
    repository,
    extractor: { extract: extractDefaultSessionLearningSignals },
    policy: createDefaultLearningPolicy(),
    memoryStore: {
      isConfigured: () => true,
      write: async (writeInput) => {
        memoryWrites.push(writeInput.records.length);
        return writeInput.records.map((record, index) => ({
          ...record,
          id: `memory-${index}`,
          scope: writeInput.scope,
          createdAt: new Date().toISOString(),
        }));
      },
      list: async () => [],
    },
    graphStore: { isConfigured: () => false, upsert: async () => ({ nodeCount: 0, edgeCount: 0 }) },
    evolution: {
      async validateAndApply(input) {
        evolutionCalls.push(input.draftId);
        return { status: "applied", draftId: input.draftId, version: 2, reason: "applied" };
      },
    },
  });
  const final = await waitForTerminal(loop.enqueueSessionLearning(learningInput({ transcript: "I prefer short answers." }), {
    profile: "memory_only",
  }), repository);
  assert(final.status === "evaluated", "memory_only loop must stop after evaluation");
  assert(memoryWrites[0] > 0, "memory_only loop must write memory");
  assert(evolutionCalls.length === 0, "memory_only loop must not apply evolution");
  return "loop-runs-memory-only-without-evolution";
}

async function scenarioLoopAppliesPromptSafeEvolution(): Promise<string> {
  const repository = createInMemoryLearningRunRepository();
  let applied = false;
  const loop = createAgentLearningLoop({
    repository,
    extractor: { extract: extractDefaultSessionLearningSignals },
    policy: createDefaultLearningPolicy(),
    memoryStore: fakeMemoryStore(),
    graphStore: fakeGraphStore(),
    evolution: {
      async validateAndApply(input) {
        applied = true;
        return { status: "applied", draftId: input.draftId, version: 2, reason: "applied" };
      },
    },
  });
  const final = await waitForTerminal(loop.enqueueSessionLearning(learningInput({ transcript: "I prefer short answers." }), {
    profile: "auto_apply_prompt_safe",
  }), repository);
  assert(final.status === "applied", "auto_apply_prompt_safe must apply eligible evolution");
  assert(applied, "loop must call evolution port");
  return "loop-applies-prompt-safe-evolution";
}

async function scenarioLoopIsIdempotentBySourceSession(): Promise<string> {
  const repository = createInMemoryLearningRunRepository();
  const loop = createAgentLearningLoop({
    repository,
    extractor: { extract: extractDefaultSessionLearningSignals },
    policy: createDefaultLearningPolicy(),
    memoryStore: fakeMemoryStore(),
    graphStore: fakeGraphStore(),
    evolution: {
      async validateAndApply(input) {
        return { status: "applied", draftId: input.draftId, version: 2, reason: "applied" };
      },
    },
  });
  const first = await loop.enqueueSessionLearning(learningInput({ transcript: "I prefer short answers." }), {
    profile: "memory_only",
  });
  const second = await loop.enqueueSessionLearning(learningInput({ transcript: "I prefer short answers." }), {
    profile: "memory_only",
  });
  assert(first.runId === second.runId, "duplicate session learning must reuse the existing run");
  return "loop-is-idempotent-by-source-session";
}
```

Add helpers:

```ts
function fakeMemoryStore() {
  return {
    isConfigured: () => true,
    write: async (writeInput: Parameters<import("@voiceagentsdk/core/sdk").TemporalMemoryStorePort["write"]>[0]) =>
      writeInput.records.map((record, index) => ({
        ...record,
        id: `memory-${index}`,
        scope: writeInput.scope,
        createdAt: new Date().toISOString(),
      })),
    list: async () => [],
  };
}

function fakeGraphStore() {
  return {
    isConfigured: () => true,
    upsert: async () => ({ nodeCount: 1, edgeCount: 1 }),
  };
}

async function waitForTerminal(
  queued: import("@voiceagentsdk/core/sdk").LearningRunRecord,
  repository: import("@voiceagentsdk/core/sdk").LearningRunRepositoryPort,
) {
  const terminal = new Set(["evaluated", "applied", "pending_approval", "rejected", "failed", "skipped"]);
  for (let attempt = 0; attempt < 40; attempt++) {
    const current = await repository.get(queued.runId);
    if (current && terminal.has(current.status)) return current;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for terminal learning run ${queued.runId}`);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test:adaptive-learning-loop:bdd
```

Expected: FAIL because `createAgentLearningLoop` is missing.

- [ ] **Step 3: Add options type**

In `src/sdk/types/learning.ts`, add:

```ts
export interface AgentLearningLoopOptions {
  repository: LearningRunRepositoryPort;
  extractor: SessionLearningExtractorPort;
  policy: AgentLearningPolicyPort;
  memoryStore?: TemporalMemoryStorePort;
  graphStore?: GraphMemoryStorePort;
  evolution?: AgentEvolutionPort;
  statusSink?: LearningStatusSinkPort;
  auditSink?: LearningAuditSinkPort;
  defaultProfile?: LearningLoopProfile;
}
```

- [ ] **Step 4: Implement orchestrator**

Create `src/sdk/learning/agent-learning-loop.ts`:

```ts
import type {
  AgentEvolutionInput,
  AgentLearningLoopOptions,
  AgentLearningLoopPort,
  LearningLoopEnqueueOptions,
  LearningRunRecord,
  LearningSessionInput,
  TemporalMemoryRecord,
} from "../types.js";
import { normalizeLearningLoopProfile } from "./in-memory-run-repository.js";

const terminalStatuses = new Set([
  "evaluated",
  "applied",
  "pending_approval",
  "rejected",
  "failed",
  "skipped",
]);

export function createAgentLearningLoop(
  options: AgentLearningLoopOptions,
): AgentLearningLoopPort {
  return {
    async enqueueSessionLearning(input, enqueueOptions) {
      const duplicate = await options.repository.findBySource?.({
        sourceSessionId: input.summary.sessionId,
        agentId: input.agentId,
        draftId: input.draftId,
      });
      if (duplicate && terminalStatuses.has(duplicate.status)) return duplicate;
      const profile = normalizeLearningLoopProfile(
        enqueueOptions?.profile,
        options.defaultProfile ?? "memory_only",
      );
      const run = duplicate ?? await options.repository.createQueued(input, {
        profile,
        runId: input.runId ?? `learn_${crypto.randomUUID()}`,
        jobId: `job_${crypto.randomUUID()}`,
      });
      await publish(options, enqueueOptions, run);
      setTimeout(() => {
        void executeLearningRun(options, enqueueOptions, input, run).catch((error) => {
          void publish(options, enqueueOptions, {
            ...run,
            status: "failed",
            finishedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
            message: "Learning loop failed.",
          });
        });
      }, 0);
      return run;
    },

    getLearningRun(runId) {
      return options.repository.get(runId);
    },
  };
}
```

Add helper functions in the same file:

```ts
async function executeLearningRun(
  options: AgentLearningLoopOptions,
  enqueueOptions: LearningLoopEnqueueOptions | undefined,
  input: LearningSessionInput,
  queued: LearningRunRecord,
): Promise<void> {
  const now = new Date().toISOString();
  const running = await publish(options, enqueueOptions, {
    ...queued,
    status: "running",
    startedAt: now,
    message: "Learning loop running.",
  });
  if (!input.draftId && !input.agentId) {
    await publish(options, enqueueOptions, {
      ...running,
      status: "skipped",
      finishedAt: new Date().toISOString(),
      message: "No agent or draft id was attached to the session.",
    });
    return;
  }
  const signals = await options.extractor.extract(input);
  const memories = await writeMemory(options, input, signals.memories);
  await writeGraph(options, input, signals.graph);
  const decision = await options.policy.decide({
    profile: running.profile,
    input,
    signals,
  });
  const evaluated = await publish(options, enqueueOptions, {
    ...running,
    status: "evaluated",
    evaluatedAt: new Date().toISOString(),
    decision,
    message: decision.reason,
  });
  if (decision.action === "reject") {
    await publish(options, enqueueOptions, {
      ...evaluated,
      status: "rejected",
      finishedAt: new Date().toISOString(),
      message: decision.reason,
    });
    return;
  }
  if (decision.action === "pending_approval") {
    await publish(options, enqueueOptions, {
      ...evaluated,
      status: "pending_approval",
      finishedAt: new Date().toISOString(),
      message: decision.reason,
    });
    return;
  }
  if (decision.action !== "apply" || !options.evolution) {
    return;
  }
  const evolution = await options.evolution.validateAndApply(evolutionInput(input, memories, signals));
  await publish(options, enqueueOptions, {
    ...evaluated,
    status: evolution.status === "applied" ? "applied" : "skipped",
    finishedAt: new Date().toISOString(),
    message: evolution.reason,
  });
}
```

Add `writeMemory`, `writeGraph`, `evolutionInput`, and `publish` helpers. Keep the file below 300 LOC.

Modify `src/sdk/learning/index.ts`:

```ts
export * from "./agent-learning-loop.js";
export * from "./default-extractor.js";
export * from "./default-policy.js";
export * from "./in-memory-run-repository.js";
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm test:adaptive-learning-loop:bdd
pnpm test:public-boundaries:bdd
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sdk/types/learning.ts src/sdk/learning scripts/test-adaptive-learning-loop-core-bdd.ts
git commit -m "Add adaptive agent learning loop orchestrator"
```

---

### Task 5: Refactor Starter Learning Service onto the SDK Loop

**Files:**

- Modify: `starters/voip-rtc/server/learning/run-state.ts`
- Modify: `starters/voip-rtc/server/learning/service.ts`
- Modify: `starters/voip-rtc/server/learning/workflow.ts`
- Modify: `starters/voip-rtc/server/voice/learning-hook.ts`
- Modify: `starters/voip-rtc/scripts/test-learning.ts`
- Modify: `starters/voip-rtc/scripts/learning-bdd/scenarios.ts`

- [ ] **Step 1: Write failing starter profile behavior tests**

In `starters/voip-rtc/scripts/test-learning.ts`, add a new test to the top-level `Promise.all`:

```ts
testStarterLearningProfiles(),
```

Add the test:

```ts
async function testStarterLearningProfiles() {
  const input = learningSessionInput();
  const memoryOnly = createTestLearningService("memory_only");
  const memoryOnlyStatus = await waitForLearning(memoryOnly.enqueueSessionLearning(input));
  assert(memoryOnlyStatus.status === "evaluated", "memory_only profile must stop after evaluation");

  const autoApply = createTestLearningService("auto_apply_prompt_safe");
  const autoApplyStatus = await waitForLearning(autoApply.enqueueSessionLearning({
    ...input,
    runId: "learn-auto-apply",
    summary: { ...input.summary, sessionId: "session-auto-apply" },
  }));
  assert(autoApplyStatus.status === "applied", "auto_apply_prompt_safe must apply safe learning");
}
```

Add helpers that create a service with explicit env:

```ts
function createTestLearningService(profile: string) {
  return createStarterLearningServiceFromEnv({
    AGENT_LEARNING_PROFILE: profile,
    AGENT_LEARNING_MEMORY_DRIVER: "local",
    AGENT_LEARNING_GRAPH_DRIVER: "local",
    AGENT_LEARNING_WORKFLOW_DRIVER: "local",
  });
}

async function waitForLearning(initial: LearningJobStatus): Promise<LearningJobStatus> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const status = createTestLearningService("memory_only").getLearningStatus(initial.runId);
    if (status && ["evaluated", "applied", "pending_approval", "rejected", "failed", "skipped"].includes(status.status)) {
      return status;
    }
    await Bun.sleep(10);
  }
  throw new Error(`Timed out waiting for ${initial.runId}`);
}
```

If this helper creates isolated repositories and cannot observe status, move `waitForLearning` to use the existing `getLearningRun` function from `run-state.ts`.

- [ ] **Step 2: Run the starter learning test to verify it fails**

Run:

```bash
pnpm test:learning
```

Expected: FAIL because `AGENT_LEARNING_PROFILE` and `evaluated` behavior are not wired.

- [ ] **Step 3: Implement repository adapter in `run-state.ts`**

Keep existing functions and add:

```ts
import type {
  LearningLoopProfile,
  LearningRunRecord,
  LearningRunRepositoryPort,
  LearningSessionInput,
} from "@voiceagentsdk/core/sdk";

export function createLocalLearningRunRepository(): LearningRunRepositoryPort {
  return {
    createQueued(input, options) {
      const run: LearningRunRecord = {
        jobId: options.jobId,
        runId: options.runId,
        status: "queued",
        profile: options.profile,
        agentId: input.agentId,
        draftId: input.draftId,
        tenantId: input.tenantId,
        userId: input.userId,
        sourceSessionId: input.summary.sessionId,
        queuedAt: new Date().toISOString(),
        message: "Learning job queued.",
      };
      saveLearningRun(run);
      return run;
    },
    save(record) {
      saveLearningRun(record);
      return record;
    },
    get(runId) {
      return getLearningRun(runId);
    },
    findBySource(input) {
      return Array.from(runs.values()).find((run) => {
        return (
          run.sourceSessionId === input.sourceSessionId &&
          (!input.agentId || run.agentId === input.agentId) &&
          (!input.draftId || run.draftId === input.draftId)
        );
      }) ?? null;
    },
  };
}

export function learningProfileFromEnv(
  env: Record<string, string | undefined>,
): LearningLoopProfile {
  const value = env.AGENT_LEARNING_PROFILE;
  if (
    value === "observe" ||
    value === "memory_only" ||
    value === "memory_and_candidates" ||
    value === "auto_apply_prompt_safe" ||
    value === "approval_required"
  ) {
    return value;
  }
  return "auto_apply_prompt_safe";
}
```

- [ ] **Step 4: Refactor service facade**

Modify `starters/voip-rtc/server/learning/service.ts` to build an `AgentLearningLoop`:

```ts
import {
  createAgentLearningLoop,
  createDefaultLearningPolicy,
  extractDefaultSessionLearningSignals,
  type LearningLoopProfile,
} from "@voiceagentsdk/core/sdk";
import {
  createLocalLearningRunRepository,
  learningProfileFromEnv,
} from "./run-state.js";
```

Create the loop once in `createStarterLearningServiceFromEnv`:

```ts
const repository = createLocalLearningRunRepository();
const profile = learningProfileFromEnv(env);
const loop = createAgentLearningLoop({
  repository,
  extractor: { extract: extractDefaultSessionLearningSignals },
  policy: createDefaultLearningPolicy(),
  memoryStore,
  graphStore,
  evolution,
  defaultProfile: profile,
});
```

Change `enqueueSessionLearning`:

```ts
enqueueSessionLearning(input, onStatus) {
  return loop.enqueueSessionLearning(input, {
    profile,
    onStatus,
  });
}
```

Keep `approveInfraEvolution`, `rollback`, and `getLearningStatus` as facade methods.

- [ ] **Step 5: Remove duplicate classifier from workflow**

If `LearnFromSessionWorkflow` is still used by tests or Temporal local paths, make it delegate to SDK extraction:

```ts
const learned = extractDefaultSessionLearningSignals(input);
```

Remove local `classifySession` only if the file stays under 300 LOC and all tests remain clear. Otherwise leave the old workflow intact until Task 6 removes driver coupling.

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm test:learning
pnpm test:learning:bdd
pnpm test:learning-preserves-server-policy:bdd
pnpm test:rtc-e2e
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add starters/voip-rtc/server/learning starters/voip-rtc/server/voice/learning-hook.ts starters/voip-rtc/scripts/test-learning.ts starters/voip-rtc/scripts/learning-bdd/scenarios.ts
git commit -m "Wire starter learning through adaptive loop"
```

---

### Task 6: Distributed Terminal Status Contract

**Files:**

- Modify: `src/sdk/types/learning.ts`
- Create: `src/sdk/learning/status.ts`
- Modify: `src/sdk/learning/index.ts`
- Modify: `starters/voip-rtc/server/learning/temporal-worker/worker-port.ts`
- Modify: `starters/voip-rtc/server/learning/temporal-worker/types.ts`
- Modify: `starters/voip-rtc/scripts/test-temporal-worker-bdd.ts`

- [ ] **Step 1: Write failing Temporal terminal-status scenario**

In `starters/voip-rtc/scripts/test-temporal-worker-bdd.ts`, add scenario:

```ts
await scenarioTemporalWorkerCanPublishTerminalStatus(),
```

Add function:

```ts
async function scenarioTemporalWorkerCanPublishTerminalStatus(): Promise<string> {
  const repository = createLocalLearningRunRepository();
  const port = new TemporalWorkerWorkflowPort({
    address: "temporal:7233",
    namespace: "default",
    taskQueue: "agent-learning",
    workflowType: "learnFromSession",
    client: recordingClient(),
    repository,
  });
  const queued = port.enqueueLearningSession(learningInput());
  await waitFor(() => clientStarted(recordingClient));
  const terminal = await port.publishWorkerStatus({
    runId: queued.runId,
    status: "applied",
    message: "Worker applied learning.",
  });
  assert(terminal.status === "applied", "worker terminal status must be persisted");
  assert(port.getLearningStatus(queued.runId)?.status === "applied", "terminal status must be queryable");
  return "temporal-worker-can-publish-terminal-status";
}
```

If `recordingClient` scope makes `clientStarted` awkward, use the existing `client.starts.length` pattern from the file.

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test:temporal-worker:bdd
```

Expected: FAIL because `publishWorkerStatus` and repository injection are missing.

- [ ] **Step 3: Add terminal status input type**

In `src/sdk/types/learning.ts`, add:

```ts
export interface LearningRunStatusUpdate {
  runId: string;
  status: LearningRunStatus;
  message?: string;
  error?: string;
  decision?: LearningRunDecision;
  metadata?: JsonObject;
}
```

Create `src/sdk/learning/status.ts`:

```ts
import type {
  LearningRunRecord,
  LearningRunRepositoryPort,
  LearningRunStatusUpdate,
} from "../types.js";

export async function publishLearningRunStatus(
  repository: LearningRunRepositoryPort,
  update: LearningRunStatusUpdate,
): Promise<LearningRunRecord> {
  const current = await repository.get(update.runId);
  if (!current) throw new Error(`Learning run not found: ${update.runId}`);
  const now = new Date().toISOString();
  const next: LearningRunRecord = {
    ...current,
    status: update.status,
    message: update.message ?? current.message,
    error: update.error,
    decision: update.decision ?? current.decision,
    metadata: update.metadata ?? current.metadata,
    evaluatedAt: update.status === "evaluated" ? now : current.evaluatedAt,
    finishedAt: isTerminal(update.status) ? now : current.finishedAt,
  };
  return repository.save(next);
}

function isTerminal(status: string): boolean {
  return ["applied", "pending_approval", "rejected", "failed", "skipped"].includes(status);
}
```

Export it from `src/sdk/learning/index.ts`.

- [ ] **Step 4: Inject repository into Temporal worker port**

Modify `starters/voip-rtc/server/learning/temporal-worker/types.ts` to include:

```ts
import type { LearningRunRepositoryPort, LearningRunStatusUpdate } from "@voiceagentsdk/core/sdk";
```

Extend `LearningWorkflowPortInput`:

```ts
repository?: LearningRunRepositoryPort;
```

Modify `TemporalWorkerWorkflowPort` constructor options:

```ts
repository: LearningRunRepositoryPort;
```

Use `this.options.repository.save` and `get` instead of direct `saveLearningRun` and `getLearningRun`. Add:

```ts
async publishWorkerStatus(
  update: LearningRunStatusUpdate,
): Promise<LearningJobStatus> {
  const status = await publishLearningRunStatus(this.options.repository, update);
  this.options.onStatus?.(status);
  return status;
}
```

Keep `saveLearningRun` compatibility in the factory by passing `createLocalLearningRunRepository()`.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm test:temporal-worker:bdd
pnpm test:learning:bdd
pnpm test:rtc-e2e
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sdk/types/learning.ts src/sdk/learning/status.ts src/sdk/learning/index.ts starters/voip-rtc/server/learning/temporal-worker starters/voip-rtc/scripts/test-temporal-worker-bdd.ts
git commit -m "Add distributed learning terminal status contract"
```

---

### Task 7: Starter Profile Env and Learning Timeline UI

**Files:**

- Modify: `starters/voip-rtc/server/builder/composition.ts`
- Modify: `starters/voip-rtc/server/builder/onboarding/env-store.ts`
- Modify: `starters/voip-rtc/.env.example`
- Modify: `starters/voip-rtc/src/domain/runtime.ts`
- Modify: `starters/voip-rtc/src/domain/events.ts`
- Create: `starters/voip-rtc/src/features/rtc/components/LearningTimeline.tsx`
- Modify: `starters/voip-rtc/src/features/rtc/RtcLab.tsx`
- Modify: `starters/voip-rtc/src/features/rtc/components/RtcPanels.css`
- Modify: `starters/voip-rtc/scripts/test-rtc-e2e.ts`

- [ ] **Step 1: Write failing RTC E2E richer-status check**

In `starters/voip-rtc/scripts/test-rtc-e2e.ts`, after collecting `eventTypes`, add:

```ts
const learningStatuses = events
  .filter((event) => event.type === "learning.status")
  .map((event) => readString(asRecord(event.learning), "status"));
assert(
  learningStatuses.includes("evaluated"),
  "learning.status evaluated was not received",
);
assert(
  learningStatuses.some((status) => status === "applied" || status === "pending_approval"),
  "learning terminal status was not received",
);
```

- [ ] **Step 2: Run E2E to verify it fails**

Run:

```bash
pnpm test:rtc-e2e
```

Expected: FAIL until the richer `evaluated` status is emitted.

- [ ] **Step 3: Add env profile**

In `.env.example`, add:

```bash
AGENT_LEARNING_PROFILE=auto_apply_prompt_safe
```

In `env-store.ts`, add a field:

```ts
field("AGENT_LEARNING_PROFILE", "infra", "Learning profile", "Controls post-session learning mutation behavior.", ["observe", "memory_only", "memory_and_candidates", "auto_apply_prompt_safe", "approval_required"], "auto_apply_prompt_safe"),
```

In `composition.ts`, pass the env through any infra planning metadata if the builder currently surfaces learning settings. Keep the default in the learning service if composition does not need it.

- [ ] **Step 4: Add timeline component**

Create `LearningTimeline.tsx`:

```tsx
import type { BrowserVoiceSessionSnapshot } from "@voiceagentsdk/core/client/browser";

const order = ["queued", "running", "evaluated", "applied", "pending_approval", "rejected", "failed", "skipped"];

export function LearningTimeline({
  learning,
}: {
  learning: BrowserVoiceSessionSnapshot["learning"];
}) {
  if (!learning) {
    return <p className="muted">Learning timeline appears after session end.</p>;
  }
  return (
    <div className="learningTimeline" aria-label="Learning timeline">
      {order.map((status) => {
        const active = learning.status === status;
        return (
          <span key={status} className={active ? "active" : ""}>
            {status}
          </span>
        );
      })}
      <p>{learning.message ?? learning.runId}</p>
    </div>
  );
}
```

Modify `RtcLab.tsx` to import and render it in the left session panel under the duration row:

```tsx
import { LearningTimeline } from "./components/LearningTimeline.js";
```

```tsx
<LearningTimeline learning={rtc.snapshot.learning} />
```

Add CSS to `RtcPanels.css`:

```css
.learningTimeline {
  display: grid;
  gap: 8px;
  margin-top: 14px;
}

.learningTimeline span {
  border: 1px solid var(--slate-200);
  border-radius: 6px;
  color: var(--slate-500);
  font-size: 11px;
  padding: 4px 6px;
}

.learningTimeline span.active {
  border-color: var(--google-blue);
  color: var(--google-blue);
  font-weight: 700;
}

.learningTimeline p {
  color: var(--slate-700);
  font-size: 12px;
  margin: 0;
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm typecheck:starters
pnpm test:rtc-e2e
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add starters/voip-rtc/.env.example starters/voip-rtc/server/builder starters/voip-rtc/src/domain starters/voip-rtc/src/features/rtc starters/voip-rtc/scripts/test-rtc-e2e.ts
git commit -m "Show adaptive learning timeline in starter"
```

---

### Task 8: Documentation and Release Gates

**Files:**

- Modify: `README.md`
- Modify: `starters/voip-rtc/README.md`
- Modify: `TODO.md`
- Modify: `.github/workflows/ci.yml` only if it does not already run `audit:solid` and `pack:dry-run`

- [ ] **Step 1: Update README feature summary**

Add a concise SDK section:

```md
### Adaptive Agent Learning Loop

The SDK includes an embedded-first, distributed-ready learning loop for post-session adaptation. A completed session can produce scoped memory, graph signals, evolution proposals, prompt-safe agent versions, pending approvals, audit records, and observable learning statuses.

Default SDK behavior is conservative: `memory_only`. Applications can opt into `observe`, `memory_and_candidates`, `auto_apply_prompt_safe`, or `approval_required` profiles. Production readiness still depends on application-owned adapters for workflow durability, auth, storage, approvals, audit, and telemetry.
```

- [ ] **Step 2: Update starter README**

Add `AGENT_LEARNING_PROFILE` to the learning env table:

```md
| `AGENT_LEARNING_PROFILE` | `observe`, `memory_only`, `memory_and_candidates`, `auto_apply_prompt_safe`, or `approval_required`; starter default is `auto_apply_prompt_safe` for demo visibility. |
```

Add a demo paragraph:

```md
The RTC Lab demonstrates the closed loop: after session end, the UI shows `queued`, `running`, `evaluated`, and a terminal learning status. In demo mode, prompt-safe learning can append a new agent version while tool and infra changes remain approval-gated.
```

- [ ] **Step 3: Update TODO**

Under P1 or the active sprint, add:

```md
### Adaptive Agent Learning Loop

- Public SDK contracts: profiles, run records, repository, workflow, extractor, policy, status.
- Embedded implementation: in-memory run repository and local orchestrator.
- Starter integration: default `auto_apply_prompt_safe` demo profile.
- Distributed readiness: worker terminal status updates through shared run repository.
- UI proof: RTC learning timeline and Agent Bank version/audit visibility.
```

- [ ] **Step 4: Run release gates**

Run:

```bash
pnpm audit:solid
pnpm pack:dry-run
git diff --check
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md starters/voip-rtc/README.md TODO.md .github/workflows/ci.yml
git commit -m "Document adaptive learning loop feature"
```

---

### Task 9: Skill Distillation and Promotion Receipts

**Files:**

- Modify: `src/sdk/types/learning.ts`
- Create: `src/sdk/learning/receipts.ts`
- Create: `src/sdk/learning/noop-evaluation-harness.ts`
- Modify: `src/sdk/learning/default-extractor.ts`
- Modify: `src/sdk/learning/default-policy.ts`
- Modify: `src/sdk/learning/agent-learning-loop.ts`
- Modify: `scripts/test-adaptive-learning-loop-core-bdd.ts`

- [ ] **Step 1: Write failing candidate-delta and receipt tests**

In `scripts/test-adaptive-learning-loop-core-bdd.ts`, add scenarios:

```ts
await scenarioMemoryAndCandidatesCreatesInactiveSkillDelta(),
await scenarioLearningReceiptCapturesRedactedDeltaDecision(),
```

Add the first scenario:

```ts
async function scenarioMemoryAndCandidatesCreatesInactiveSkillDelta(): Promise<string> {
  const signals = extractDefaultSessionLearningSignals(learningInput({
    transcript: "When a route wine customer asks for pairing, first ask region, budget, and cuisine.",
  }));
  const skillDelta = signals.deltas.find((delta) => delta.kind === "skill");
  assert(skillDelta, "repeated procedural guidance must create a skill candidate delta");
  assert(skillDelta.promotionState === "candidate", "skill delta must remain inactive by default");
  assert(skillDelta.scope === "agent", "default skill candidates must be agent-scoped");
  return "memory-and-candidates-creates-inactive-skill-delta";
}
```

Add the receipt scenario:

```ts
async function scenarioLearningReceiptCapturesRedactedDeltaDecision(): Promise<string> {
  const repository = createInMemoryLearningRunRepository();
  const receipts: import("@voiceagentsdk/core/sdk").LearningReceipt[] = [];
  const loop = createAgentLearningLoop({
    repository,
    extractor: { extract: extractDefaultSessionLearningSignals },
    policy: createDefaultLearningPolicy(),
    memoryStore: fakeMemoryStore(),
    graphStore: fakeGraphStore(),
    receiptSink: { emit: (receipt) => receipts.push(receipt) },
  });
  await waitForTerminal(loop.enqueueSessionLearning(learningInput({
    transcript: "I prefer short answers. api_key=sk-test-secret-value",
  }), { profile: "memory_and_candidates" }), repository);
  assert(receipts.length === 1, "learning loop must emit one receipt");
  assert(receipts[0].redactions.length > 0, "receipt must mention redactions");
  assert(receipts[0].deltas.every((delta) => !JSON.stringify(delta).includes("sk-test-secret-value")), "receipt deltas must be redacted");
  return "learning-receipt-captures-redacted-delta-decision";
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test:adaptive-learning-loop:bdd
```

Expected: FAIL because `signals.deltas` and `receiptSink` do not exist yet.

- [ ] **Step 3: Extend signal and loop option types**

In `src/sdk/types/learning.ts`, extend `SessionLearningSignals`:

```ts
deltas: LearningDelta[];
redactions: string[];
```

Add:

```ts
export interface LearningReceiptSinkPort {
  emit(receipt: LearningReceipt): void | Promise<void>;
}
```

Extend `AgentLearningLoopOptions`:

```ts
evaluationHarness?: EvaluationHarnessPort;
receiptSink?: LearningReceiptSinkPort;
```

- [ ] **Step 4: Implement receipt creation**

Create `src/sdk/learning/receipts.ts`:

```ts
import type {
  EvaluationResult,
  LearningReceipt,
  LearningRunDecision,
  LearningSessionInput,
  SessionLearningSignals,
} from "../types.js";

export function createLearningReceipt(input: {
  runId: string;
  session: LearningSessionInput;
  signals: SessionLearningSignals;
  decision: LearningRunDecision;
  evaluation?: EvaluationResult;
  previousArtifactId?: string;
  nextArtifactId?: string;
}): LearningReceipt {
  return {
    id: `receipt_${crypto.randomUUID()}`,
    runId: input.runId,
    sourceSessionId: input.session.summary.sessionId,
    inputHash: stableHash(JSON.stringify({
      sessionId: input.session.summary.sessionId,
      agentId: input.session.agentId,
      draftId: input.session.draftId,
      tenantId: input.session.tenantId,
      userId: input.session.userId,
    })),
    redactions: input.signals.redactions,
    deltas: input.signals.deltas,
    decision: input.decision,
    evaluation: input.evaluation,
    previousArtifactId: input.previousArtifactId,
    nextArtifactId: input.nextArtifactId,
    createdAt: new Date().toISOString(),
  };
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return `sha-lite:${Math.abs(hash).toString(16)}`;
}
```

- [ ] **Step 5: Add no-op evaluation harness**

Create `src/sdk/learning/noop-evaluation-harness.ts`:

```ts
import type { EvaluationHarnessPort } from "../types.js";

export function createNoopEvaluationHarness(): EvaluationHarnessPort {
  return {
    evaluate() {
      return {
        status: "skipped",
        checks: [{
          name: "noop",
          status: "skipped",
          message: "No evaluation harness configured.",
        }],
      };
    },
  };
}
```

- [ ] **Step 6: Emit deltas and receipts from the loop**

In `default-extractor.ts`, create memory deltas for memories, prompt deltas for prompt recommendations, missing-tool tool deltas, and a skill delta when final user text contains procedural language such as `first`, `when`, `always`, or `step`.

In `agent-learning-loop.ts`, after policy decision:

```ts
const evaluation = await (options.evaluationHarness ?? createNoopEvaluationHarness()).evaluate({
  input,
  deltas: signals.deltas,
});
await options.receiptSink?.emit(createLearningReceipt({
  runId: evaluated.runId,
  session: input,
  signals,
  decision,
  evaluation,
}));
```

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm test:adaptive-learning-loop:bdd
pnpm test:public-boundaries:bdd
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/sdk/types/learning.ts src/sdk/learning scripts/test-adaptive-learning-loop-core-bdd.ts
git commit -m "Add learning deltas and receipts"
```

---

## Final Verification

- [ ] Run the complete local gate:

```bash
pnpm audit:solid
pnpm pack:dry-run
git diff --check
```

- [ ] Confirm public package still resolves:

```bash
pnpm test:public-boundaries:bdd
```

- [ ] Confirm learning loop behavior:

```bash
pnpm test:adaptive-learning-loop:bdd
pnpm test:learning
pnpm test:learning:bdd
pnpm test:temporal-worker:bdd
pnpm test:rtc-e2e
```

- [ ] Confirm no large-file regression:

```bash
pnpm audit:loc
```

- [ ] Confirm working tree status:

```bash
git status --short --branch
```

Expected: clean branch with all task commits present.

---

## Execution Notes

- Keep each new source file under 300 LOC.
- Preserve `LearningJobStatus` as a temporary alias so existing starter code can migrate incrementally.
- Do not make Temporal a required dependency.
- Do not move production auth, tenant ownership, or durable storage into the SDK.
- Treat `auto_apply_prompt_safe` as starter demo behavior, not SDK default behavior.
- Use `apply_patch` for manual edits and run the failing test before the implementation in each task.
