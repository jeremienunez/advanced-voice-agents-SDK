# Adaptive Agent Learning Loop Design

## Goal

Add an official SDK feature for adaptive post-session learning: a policy-governed, observable, rollbackable learning loop that runs embedded by default and can be wired to distributed production infrastructure through ports.

## Product Positioning

The feature is not a SaaS learning platform and does not own production auth, tenant storage, workflow hosting, or compliance. It gives application teams a reusable control loop for agents that learn from completed sessions while keeping model output untrusted and server policies authoritative.

The public message is:

> Embedded-first adaptive learning, distributed-ready by design.

The SDK provides the protocol, types, ports, local implementation, safety invariants, and starter demo. Production apps plug their own durable workflow, memory, approval, audit, and repository adapters.

## Recommended Approach

Use a progressive learning loop rather than a purely local callback or a fully mandatory distributed control plane.

- Embedded/local mode gives npm users a working loop with minimal setup.
- Distributed-ready ports let production apps replace local memory, run repositories, workflow dispatch, approvals, and audit.
- The same conceptual flow applies across local demo, starter integration, and production integration.

## Learning Profiles

The SDK should expose a small profile set that controls mutation behavior:

```ts
export type LearningLoopProfile =
  | "observe"
  | "memory_only"
  | "memory_and_candidates"
  | "auto_apply_prompt_safe"
  | "approval_required";
```

Profile semantics:

- `observe`: classify the session and emit evaluation results; no memory write and no agent mutation.
- `memory_only`: write scoped memory and graph signals; do not create or apply agent evolution.
- `memory_and_candidates`: write scoped memory and create candidate learning deltas; do not promote them automatically.
- `auto_apply_prompt_safe`: apply prompt-only evolution when all server-side policies pass; sensitive tool, handoff, or infra changes remain pending.
- `approval_required`: create pending approvals for every agent, tool, handoff, or infra mutation.

Recommended defaults:

- SDK default: `memory_only`
- Starter demo default: `auto_apply_prompt_safe`
- Regulated app guidance: `observe` or `approval_required`

## External Inspiration

Hermes Agent and OpenClaw point to a useful direction: agent-layer learning should accumulate reusable capabilities, not pretend to fine-tune foundation models after every call. The relevant patterns are persistent memories, versioned skills, isolated sessions/workspaces, profile or allowlist controls, and explicit promotion of learned artifacts.

The SDK should adapt these patterns without copying their product shape:

- Hermes-style skill learning becomes a portable `AgentSkillArtifact` candidate.
- OpenClaw-style isolation becomes strict tenant/user/agent/channel/session scoping.
- GEPA/SkillOpt-style optimization becomes evaluation-gated promotion, not automatic mutation.
- Security research on OpenClaw-style agents reinforces that skills and memories are untrusted supply-chain inputs until validated.

Reference themes:

- Hermes Agent architecture and skills: persistent memory, tools, sessions, profiles, skill reuse.
- OpenClaw gateway and multi-agent routing: isolated workspaces, session stores, agent bindings, and scoped permissions.
- GEPA, SkillOpt, and SkillOps: text/skill optimization through traces, evaluation, and maintenance.

## Learning Deltas

The loop should produce typed deltas instead of a single opaque recommendation:

```ts
export type LearningDeltaKind =
  | "memory"
  | "prompt"
  | "skill"
  | "tool"
  | "infra";

export interface LearningDelta {
  id: string;
  kind: LearningDeltaKind;
  scope: "session" | "user" | "agent" | "tenant" | "global";
  title: string;
  summary: string;
  confidence: number;
  payload: JsonObject;
  sourceSessionIds: string[];
}
```

Default behavior:

- memory deltas can be written automatically in `memory_only`, `memory_and_candidates`, `auto_apply_prompt_safe`, and `approval_required`;
- prompt deltas can auto-promote only in `auto_apply_prompt_safe` and only after policy/evaluation pass;
- skill, tool, and infra deltas remain candidates or pending approvals by default;
- global-scope deltas are never auto-promoted by the SDK default implementation.

## Skill Distillation

Repeated session patterns should become skill candidates. This is a second-stage feature on top of the learning loop, not a prerequisite for the first embedded implementation.

```ts
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
```

The first SDK implementation can expose the type and candidate delta path. A later slice can add a `SkillDistillerPort` that creates a skill candidate after repeated similar traces.

## Promotion Pipeline

Learned artifacts should move through explicit states:

```text
candidate -> evaluated -> approved -> active -> rolled_back
                       \-> rejected
                       \-> expired
```

Promotion rules:

- `candidate`: created from extracted learning signals.
- `evaluated`: policy and evaluation harness completed.
- `approved`: a server/user approval accepted a sensitive candidate.
- `active`: artifact was promoted to an agent version, skill library, or memory store.
- `rolled_back`: active artifact was reverted.
- `rejected`: policy, evaluation, or reviewer rejected it.
- `expired`: pending candidate exceeded its TTL.

This pipeline should apply independently to memory, prompt, skill, tool, and infra deltas.

## Learning Receipts

Every run should be able to emit a receipt that can be stored or shown in the Agent Bank:

```ts
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
```

The receipt is the audit-friendly proof that the loop learned from redacted evidence, passed or failed policy, and produced traceable deltas.

## Logical SOA

The feature should be organized as logical services behind ports. They can live in one Node process for local use or map to separate services in production.

### Learning Orchestrator

Responsibility:

- Accept `SessionEnded` input.
- Create or reuse a `LearningRun`.
- Drive extraction, memory writes, policy evaluation, evolution, approval, audit, and status events.
- Enforce profile semantics.

This is the central SDK-facing object, likely named `AgentLearningLoop`.

### Learning Run Repository

Responsibility:

- Persist `queued`, `running`, `evaluated`, `applied`, `pending_approval`, `rejected`, `skipped`, and `failed` statuses.
- Support idempotency by `runId` and source session id.
- Return terminal and latest run state for UI/API polling.

Local implementation can use memory or local file state. Production apps can use SQL, Redis, durable object storage, or an outbox-backed repository.

### Workflow Driver

Responsibility:

- Decide whether learning runs in-process or through an external worker.
- Preserve the same status contract in both modes.
- Let Temporal, queue, or custom workflow systems report terminal states back into the run repository.

Local mode executes directly. Temporal mode dispatches a worker and requires a terminal status callback, poller, or worker-side repository write.

### Session Learning Extractor

Responsibility:

- Convert transcript, tool calls, session metadata, and runtime metrics into typed learning signals.
- Produce memory records, graph nodes/edges, missing-tool recommendations, prompt recommendations, and confidence scores.
- Redact secret-like values before persistence.

The default extractor can remain deterministic and lightweight. Apps can replace it with model-assisted extraction.

### Memory Writer

Responsibility:

- Write temporal memory with tenant/user/agent/session scope.
- Write graph memory best-effort.
- Keep memory failures visible without forcing prompt evolution to succeed when memory persistence fails.

Local implementation remains available for DX. Redis, SQL, graph DB, Neo4j, Memgraph, or app-owned stores are adapters.

### Evolution Policy

Responsibility:

- Treat extracted learning as untrusted input.
- Validate server-owned prompt policy remains final.
- Enforce tool execution, confirmation, side-effect, safety, identity, uncertainty, and success invariants.
- Reject recursive or runaway AgentRx patterns.
- Classify mutation decisions as apply, candidate, pending approval, reject, or skip.
- Separate memory, prompt, skill, tool, and infra deltas before promotion.

This is the key safety boundary. No agent artifact changes without this policy layer.

### Agent Evolution Repository

Responsibility:

- Append new agent versions.
- Preserve rollback artifact pointers.
- Save audit metadata.
- Keep active agent assignment scoped when an evolution becomes active.

Local starter implementation can continue using local draft state. Production apps replace it with durable repositories.

### Evaluation Harness

Responsibility:

- Replay a small agent-specific benchmark before promotion.
- Compare previous and candidate artifacts on success, safety, tool behavior, confirmation behavior, and regression checks.
- Return a structured result that policy can use before activation.

The default embedded implementation can be a no-op pass for `memory_only`. Production integrations can plug deterministic scenario replay, CI jobs, or offline evaluators.

### Approval Service

Responsibility:

- Create pending approvals for sensitive changes.
- Execute approved changes outside model arguments.
- Mark approvals approved, rejected, expired, executed, or failed.

Tool additions, external side effects, handoff changes, and infra changes should never be silently auto-applied.

### Status and Audit Sinks

Responsibility:

- Stream status updates to UI clients.
- Emit structured audit events for every run and decision.
- Avoid leaking raw secrets or unredacted transcript details in logs.

The starter should expose these statuses in the RTC Lab and Agent Bank.

## Core Flow

```text
RTC session ended
  -> AgentLearningLoop.enqueue(input)
  -> LearningRun queued
  -> WorkflowDriver starts local or distributed work
  -> LearningRun running
  -> SessionLearningExtractor emits learning signals
  -> Candidate deltas are produced
  -> MemoryWriter writes scoped temporal/graph memory according to profile
  -> EvolutionPolicy evaluates proposal and profile
  -> EvaluationHarness validates promotable candidates
  -> AgentEvolutionRepository applies version, creates proposal, or skips
  -> ApprovalService creates pending approval for sensitive changes
  -> LearningRun terminal status is persisted
  -> StatusSink emits updates to client/UI
```

## Status Model

The public status model should be explicit enough for UI and automation:

```ts
export type LearningRunStatus =
  | "queued"
  | "running"
  | "evaluated"
  | "applied"
  | "pending_approval"
  | "rejected"
  | "skipped"
  | "failed";
```

Status rules:

- `queued` is created synchronously.
- `running` starts when the local workflow or worker begins work.
- `evaluated` means extraction and policy evaluation completed.
- `applied` means a safe mutation was committed.
- `pending_approval` means at least one sensitive mutation awaits server/user approval.
- `rejected` means policy blocked the evolution.
- `skipped` means no eligible agent/session/profile action existed.
- `failed` means an infrastructure or unexpected execution failure occurred.

## SDK Public Surface

The SDK should expose ports and types from public entrypoints, not starter-only modules.

Proposed public types:

```ts
export interface AgentLearningLoopPort {
  enqueueSessionLearning(
    input: LearningSessionInput,
    options?: LearningLoopEnqueueOptions,
  ): Promise<LearningRunRecord> | LearningRunRecord;
  getLearningRun(runId: string): Promise<LearningRunRecord | null> | LearningRunRecord | null;
}

export interface LearningLoopEnqueueOptions {
  profile?: LearningLoopProfile;
  onStatus?: (status: LearningRunRecord) => void;
}
```

Proposed public ports:

- `LearningRunRepositoryPort`
- `LearningWorkflowDriverPort`
- `SessionLearningExtractorPort`
- `LearningMemoryStorePort`
- `GraphMemoryStorePort`
- `AgentEvolutionPolicyPort`
- `AgentEvolutionRepositoryPort`
- `SkillDistillerPort`
- `EvaluationHarnessPort`
- `PendingApprovalPort`
- `LearningStatusSinkPort`
- `AuditEventSinkPort`

Existing ports should be reused where they already match these responsibilities. New names should not duplicate existing public contracts.

## Starter Demonstration

The starter should demonstrate a complete closed loop:

```text
Voice session starts with compiled agent vN
User says a preference
Tool call fails with an unknown tool
Session ends
Learning timeline shows queued/running/evaluated/applied
Temporal memory contains scoped preference
Graph memory receives entities and relations
Agent Bank shows vN+1 with learned memory before server policy
Missing tool appears as a proposal
Infra/tool mutation remains pending approval
Rollback restores previous artifact
```

This demo proves:

- observable async learning;
- scoped memory writes;
- prompt-safe auto evolution;
- sensitive-change approval;
- auditability;
- rollback;
- local-to-distributed adapter readiness.

## Distributed-Ready Contract

Distributed infrastructure should be optional. When enabled, the contract must still be the same:

- The API returns a `LearningRunRecord` immediately.
- Workers update the same run repository or call back through a status port.
- Terminal states are observable after worker completion.
- Duplicate session-end events are idempotent by `sourceSessionId` and `agentId`.
- Approval execution is separate from model output and workflow extraction.

Temporal is one supported driver, not a mandatory dependency.

## Security Invariants

The feature must preserve these invariants:

- model output and extracted learning are untrusted;
- uploaded/session content is untrusted data;
- server-owned prompt policy remains the final prompt suffix after learning;
- tool confirmations never come from model arguments;
- sensitive side effects require pending approval;
- infra mutations require pending approval;
- failed policy evaluation cannot partially activate a new agent artifact;
- every apply, reject, approval, rollback, and failure emits audit metadata;
- local/demo storage paths remain explicit and documented as local-only.

## Failure Handling

Expected behavior:

- Missing learning service: emit `skipped`.
- No draft or agent id: emit `skipped`.
- Graph write failure: continue if temporal memory and policy can still proceed; status/audit records the degraded write.
- Temporal dispatch failure: return initial `queued`, then publish `failed`.
- Worker execution failure: persist `failed` with redacted error.
- Policy rejection: persist `rejected`, no artifact mutation.
- Approval timeout: persist `pending_approval` until the approval port marks it `expired` or rejected.

## Implementation Slices

1. Stabilize the public status/run types and repository port.
2. Introduce `AgentLearningLoop` as the orchestration boundary.
3. Move the current starter local learning path behind the new orchestration boundary.
4. Add terminal status propagation for distributed workflow drivers.
5. Add profile handling, learning deltas, and policy decisions.
6. Add evaluation receipts and promotion states.
7. Update the starter UI/API to show the richer learning timeline.
8. Document local, starter, and production integration modes.

## Test Strategy

Required tests:

- profile behavior for `observe`, `memory_only`, `memory_and_candidates`, `auto_apply_prompt_safe`, and `approval_required`;
- local status progression through terminal states;
- distributed driver can report terminal worker status;
- idempotent duplicate session-end handling;
- policy rejection prevents artifact mutation;
- server-owned prompt policy remains final;
- memory writes are scoped and redacted;
- graph failure is degraded but observable;
- sensitive changes create pending approvals;
- skill candidates remain inactive until evaluated and approved;
- learning receipts include redacted evidence and delta decisions;
- RTC E2E shows learning timeline and version increment in demo mode.

## Non-Goals

The feature will not:

- impose OAuth, JWT, user accounts, or tenant DBs;
- require Temporal, Redis, Postgres, Neo4j, or Memgraph;
- train foundation models;
- auto-create external tools from model suggestions;
- auto-apply infra changes;
- make the starter a production multi-tenant SaaS by itself.
