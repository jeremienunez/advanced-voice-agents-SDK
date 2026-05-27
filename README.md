# Voice Agent SDK

Provider-pluggable SDK for building realtime conversational voice agents with
declarative prompts, tools, knowledge, safe stores, browser audio, and server
runtime orchestration.

In plain English: this repo turns "make me an AI that talks" into a structured
voice agent with a goal, tools, retrieval, providers, and guardrails, so it does
not confidently improvise its way into production.

## What You Get

- Declarative SDK for agents, prompts, tools, providers, media bridges, stores,
  databases, plans, onboarding metadata, and domain packs.
- Server runtime for realtime voice sessions, provider transports, tool calls,
  media handlers, state machines, and browser WebSocket sessions.
- Browser client for microphone capture, playback, WebSocket control messages,
  mute state, transcripts, tool call snapshots, and audio levels.
- VOIP RTC starter with Bun, React, Vite, Gemini Live, OpenAI Realtime, builder
  workflows, knowledge compilation, and Postgres/pgvector adapters.
- Post-session learning loop that queues async memory/evolution work after RTC
  shutdown, with Redis TTL memory, graph memory, audit metadata, and rollbackable
  agent versions.
- Safe repository layer that enforces tenant/user scope, allowed operations,
  filter fields, sort fields, writable fields, and page limits.

## Architecture

```mermaid
flowchart TD
  UI[Browser UI] --> Client[client/browser]
  Client --> WS[Browser WebSocket]
  WS --> BrowserService[server/browser BrowserVoiceService]
  BrowserService --> Session[RealtimeVoiceSession]
  Session --> Provider[IRealtimeProvider]
  Provider --> Model[Realtime Model]

  BuilderUI[Builder UI] --> BuilderAPI[starter builder routes]
  BuilderAPI --> Draft[AgentBuildDraft]
  Draft --> Planner[Planner ports]
  Planner --> Artifact[CompiledAgentArtifact]
  Artifact --> Session

  Artifact --> KnowledgeTool[search_knowledge]
  KnowledgeTool --> KnowledgeStore[Postgres FTS + pgvector]
```

## Repository Map

| Path | Role |
| --- | --- |
| `src/sdk` | Declarative SDK types, builders, compiler, ports, store, diagnostics. |
| `src/server` | Server runtime: sessions, transports, media handlers, providers. |
| `src/client/browser` | Browser WebSocket and audio session client. |
| `starters/voip-rtc` | Reusable Bun + React/Vite starter for RTC voice projects. |
| `examples/packs/wine-investment` | Example domain pack outside core SDK. |
| `scripts` | Audits, harnesses, and runtime tool call checks. |

## Mental Model

```mermaid
flowchart LR
  Define[Define SDK contract] --> Compile[Compile SDK runtime]
  Compile --> Adapt[Bind app adapters]
  Adapt --> Start[Start voice session]
  Start --> Stream[Stream audio]
  Stream --> Tools[Run tools and knowledge]
```

The SDK defines contracts. Your app binds real adapters: auth, secrets,
provider keys, persistence, database, observability, and product routing.

## Builder Flow

```mermaid
sequenceDiagram
  participant User
  participant UI as Builder UI
  participant API as Builder Routes
  participant Planner as Planner Ports
  participant Store as Draft State
  participant Runtime as Voice Runtime

  User->>UI: Identity, intent, rules, documents
  UI->>API: POST /builder/prompt-plan
  API->>Planner: createPromptPlan(draft)
  Planner-->>API: PromptBuildPlan
  API->>Store: save draft
  UI->>API: compile knowledge / compile agent
  API->>Planner: composeFinalPrompt()
  API->>Store: save compiled artifact
  Runtime->>Store: load compiled prompt by agent id
```

The user-facing "goal" is represented as `identity.intent`. There is no
separate `/set goal` command in core.

## Builder LLM Harness

Builder prompts are no longer tied to one model vendor. The starter turns
planner, research, and teacher/verifier work into typed `LlmTask` requests, then
routes them through an adaptive resolver and provider adapters.

```mermaid
flowchart TD
  Routes[Builder routes] --> Task[LlmTask]
  Task --> Resolver[AdaptiveLlmModelResolver]
  Resolver --> Catalog[Role-aware model catalog]
  Catalog --> Runner[BuilderLlmTaskRunner]
  Runner --> OpenAICompat[OpenAI-compatible providers]
  Runner --> Gemini[Gemini generateContent]
  OpenAICompat --> DeepSeek[DeepSeek]
  OpenAICompat --> Qwen[Qwen]
  OpenAICompat --> Kimi[Kimi]
```

Current builder roles:

| Role | Used for | Supported starter providers |
| --- | --- | --- |
| `builder.planner` | prompt plans, knowledge plans, DB plans, final prompt composition | DeepSeek, Qwen, Kimi, Gemini |
| `builder.researcher` | budget-aware autonomous research briefs | DeepSeek, Qwen, Kimi |
| `builder.verifier` | teacher pass, coverage review, follow-up queries | DeepSeek, Qwen, Kimi, Gemini |

Provider-specific params stay behind the adapter layer: thinking toggles,
OpenAI-compatible JSON response formats, Gemini `generationConfig`, token caps,
usage normalization, retries, and tool-call normalization. Legacy direct
DeepSeek/Kimi builder adapters have been removed.

## Agent Infra Plan

The builder now emits a typed `AgentInfraPlan` next to the knowledge and
database plans. This is the bridge toward infra-as-code without putting cloud,
Kubernetes, or auth opinions inside the SDK definition.

```mermaid
flowchart TD
  Intent[Agent intent + documents] --> Knowledge[KnowledgeBuildPlan]
  Knowledge --> Database[DatabaseBuildPlan]
  Database --> Infra[IntentInfraPlanner]
  Infra --> Draft[AgentBuildDraft.infraPlan]
  Infra --> PG[Postgres + pgvector source of truth]
  Infra -. vector-heavy intent .-> Milvus[Milvus vector index]
  Infra -. graph intent .-> Graph[Graph index]
  Infra -. cache/session intent .-> Redis[Redis cache]
  Draft --> IaC[Onboarding IaC apply]
```

Current behavior is deliberately conservative:

- Postgres/pgvector remains the source of truth for documents, chunks, and the
  default retrieval path.
- Milvus, graph, and Redis are planned as optional backend slots when env or
  intent asks for them.
- Generated SQL stays planning material; executable migrations stay
  server-owned templates.
- Database provisioning validation rejects non-vector extensions, extension
  options, `CREATE TABLE AS SELECT`, arbitrary function calls, and expression
  indexes before those templates can apply.
- Server-owned Postgres templates bound provisioning with `statement_timeout`,
  create a per-agent no-login runtime role, and grant only schema `USAGE` plus
  table `SELECT`.
- The plan carries compute target, isolation mode, provisioning mode, resource
  refs, migration policy, and security notes so a future IaC runner can consume
  it without changing agent code.
- The starter also attaches an `InfraIacBundle` with actionable artifacts:
  portable JSON, OpenTofu variable files, VM cloud-init, and K3s/Kubernetes
  namespace/config/network manifests.
- `pnpm run infra:apply` is the onboarding apply path: it creates or reuses a
  local K3s cluster through Docker, applies the generated manifests with
  `kubectl`, then verifies the namespace, ConfigMap, and NetworkPolicy.
- The starter opens on a guided Onboarding Config UI first. It checks
  Docker/kubectl, writes allowlisted values to ignored `.env.local`, and runs
  safe plan/apply/status actions through the same infra script. Destructive
  cleanup stays behind an advanced confirmation. It also warns when the form is
  missing a Gemini/OpenAI voice key, a DeepSeek/Qwen builder key, or the
  database plus embedding keys needed for RAG.

Infra env cheat sheet:

| Env var | Purpose |
| --- | --- |
| `BUILDER_INFRA_COMPUTE_TARGET` | `local`, `vm`, `k3s`, `kubernetes`, or `managed`. |
| `BUILDER_INFRA_ISOLATION` | `namespace`, `dedicated_database`, `dedicated_vm`, etc. |
| `BUILDER_INFRA_PROVISIONING_MODE` | `server_template`, `iac_plan`, `manual`, or `external`. |
| `BUILDER_VECTOR_BACKEND` | Set `milvus` to force Milvus as the vector backend. |
| `MILVUS_URL` / `MILVUS_ADDRESS` | Marks the Milvus backend as configured. |
| `NEO4J_URI` / `GRAPH_DATABASE_URL` | Marks the graph backend as configured. |
| `REDIS_URL` | Marks cache and learning temporal-memory backends as configured. |
| `AGENT_LEARNING_ENABLED` | Enables post-session learning store planning, default `true` in the starter. |
| `AGENT_LEARNING_MEMORY_TTL_SECONDS` | Redis TTL for learned temporal memory, default `2592000`. |
| `TEMPORAL_ADDRESS` | Temporal workflow endpoint for post-session learning jobs. |
| `TEMPORAL_NAMESPACE` | Temporal namespace used by the learning worker, default `default`. |
| `TEMPORAL_TASK_QUEUE` | Temporal task queue consumed by the learning worker, default `agent-learning`. |
| `BUILDER_INFRA_APPLY_DRIVER` | `dev-local` by default, `k3s-docker` for local K3s, or `kubectl` for an existing context. |
| `BUILDER_INFRA_K3S_IMAGE` | K3s Docker image used by `infra:apply`. |
| `BUILDER_INFRA_K3S_PORT` | Local K3s API port, default `16443`. |

Generated IaC artifacts never include secret values. They reference secret/env
names such as `DATABASE_URL`, `MILVUS_URL`, `NEO4J_URI`, and `REDIS_URL`.

Onboarding commands:

```bash
pnpm run infra:plan
pnpm run infra:apply
pnpm run infra:status
pnpm run infra:destroy
```

The starter UI opens directly on `Onboarding` before Builder, Agent Bank, or
RTC Lab.

## Agent Self-Improving Stores

When learning is enabled, RTC shutdown and learning are deliberately separated:
the user gets session end immediately, then the starter queues a learning job
that can update memory and agent versions in the background.

```mermaid
sequenceDiagram
  participant RTC as RTC Session
  participant Queue as Temporal Workflow Port
  participant Memory as Redis Temporal Memory
  participant Graph as Graph Memory
  participant Agent as Agent Version

  RTC->>Queue: enqueue transcript, summary, tool calls
  Queue-->>RTC: queued status
  Queue->>Memory: write TTL facts, preferences, failed intents
  Queue->>Graph: upsert entities and relations
  Queue->>Agent: append validated prompt/tool/infra version
```

Learning stores are two-tier: global agent memory plus user-scoped
personalization. The infra plan exposes required Redis, Temporal, graph, and
audit/source resources, but actual creation is delayed until the learning
workflow runs at session end.

Guardrails stay active even though evolution is automatic:

- Agent versions are append-only.
- Rollback points to the previous compiled artifact.
- Every apply/rollback writes audit metadata.
- Learned memory redacts secret-looking values.
- Infra evolution creates pending/applicable plans; destructive migration is
  forbidden.

Runtime surfaces:

- RTC Lab displays queued/running/applied/failed learning status after stop.
- Agent Bank shows current version, last learning run, and rollback action.
- The builder database/infra panel shows Learning Stores inside the infra plan.
- Onboarding checks Redis and Temporal as required learning runtime inputs, with
  graph backend visible as optional local/default Postgres graph memory.

Learning test commands:

```bash
pnpm test:learning
pnpm test:learning:bdd
pnpm test:solid-seams
pnpm test:rtc-e2e
```

## Runtime Voice Flow

```mermaid
sequenceDiagram
  participant Browser
  participant Service as BrowserVoiceService
  participant Session as RealtimeVoiceSession
  participant Provider as Realtime Provider
  participant Tool as Runtime Tool

  Browser->>Service: session.start + binary PCM16 audio
  Service->>Session: create session + callbacks
  Session->>Provider: connect + sendAudio
  Provider-->>Session: transcript/audio/function_call
  Session->>Tool: execute(args, context)
  Tool-->>Session: result
  Session->>Provider: submitFunctionResult
  Session-->>Browser: audio + state + transcript + tool result
```

## Quick Start

```bash
pnpm install
cp starters/voip-rtc/.env.example starters/voip-rtc/.env
pnpm dev:voip-rtc
```

Open `http://127.0.0.1:5177` or `http://localhost:5177`.

The starter server runs on `http://127.0.0.1:8787` by default.

## Public Export Cheat Sheet

| Import | Use it for |
| --- | --- |
| `@voiceagentsdk/core` | Main SDK export. |
| `@voiceagentsdk/core/sdk` | Builders, SDK types, runtime compiler, stores, ports. |
| `@voiceagentsdk/core/server` | Sessions, transports, handlers, provider/runtime types. |
| `@voiceagentsdk/core/server/browser` | `BrowserVoiceService` WebSocket bridge. |
| `@voiceagentsdk/core/server/providers` | Realtime provider transport facade. |
| `@voiceagentsdk/core/server/media` | Media handlers and audio utilities. |
| `@voiceagentsdk/core/server/adapters/fastify` | Placeholder adapter contract. |
| `@voiceagentsdk/core/client/browser` | Browser voice session client. |

## SDK Builder Example

```ts
import {
  compileVoiceAgentSdk,
  createAgentBuilder,
  createToolBuilder,
} from "@voiceagentsdk/core/sdk";

const lookupOrder = createToolBuilder("lookup_order")
  .describe("Look up an order by id after the user provides it.")
  .parameters({
    type: "object",
    properties: { orderId: { type: "string" } },
    required: ["orderId"],
  })
  .handler(async (input, context) => {
    return context.database?.query("orders", input) ?? null;
  })
  .build();

const definition = createAgentBuilder()
  .tenant({
    id: "local",
    displayName: "Local Lab",
    defaultProviderId: "gemini",
    defaultMediaBridgeId: "browser",
  })
  .provider({
    id: "gemini",
    kind: "gemini-live",
    apiKey: { name: "GEMINI_API_KEY" },
    model: "gemini-3.1-flash-live-preview",
    voice: "Puck",
  })
  .mediaBridge({
    id: "browser",
    kind: "browser-websocket",
    providerId: "gemini",
    inputEncoding: "pcm16",
    outputEncoding: "pcm16",
    sampleRate: 24000,
  })
  .prompt({
    id: "voice-system",
    channels: ["voice"],
    priority: 1,
    body: "You are concise, grounded, and confirm before external actions.",
  })
  .tool(lookupOrder)
  .build();

const runtime = compileVoiceAgentSdk(definition);
const prompt = runtime.promptFor({ channel: "voice" });
```

## Builder Tool Contracts

The builder keeps tool planning separate from the final voice prompt.

- `tool-plan.system.md` and `tool-plan.user.md` describe builder-side tool
  planning.
- `final-prompt.system.md` and `final-prompt.user.md` compose only the voice
  agent system prompt.
- `ToolBuildPlan` stores serializable tool contracts: selected tools, schemas,
  permissions, side effects, confirmation policy, and runtime binding.
- `compile-agent` validates selected tools before composing the voice prompt.
- The final prompt receives voice-safe tool policy only; runtime internals such
  as `handlerRef` stay out of model-facing instructions.
- Runtime action handlers currently cover summary creation, human handoff,
  follow-up scheduling, structured notes, and knowledge search.

Use `pnpm audit:tool-contracts` to catch compiled agents that select tools
without validated runtime contracts.

## Safe Store Cheat Sheet

```ts
import {
  createSafeRepository,
  createStoreBuilder,
} from "@voiceagentsdk/core/sdk";

const store = createStoreBuilder("crm")
  .entity("contacts", (entity) => {
    entity
      .field("name", "string")
      .field("email", "string")
      .tenantScoped("tenantId")
      .operations(["get", "list", "create", "update"])
      .filterable(["tenantId", "email"])
      .sortable(["email"])
      .maxPageSize(50);
  })
  .build();

const contacts = createSafeRepository(store.entities[0], adapter);
```

The safe repository injects scope and rejects undeclared operations, filters,
sorts, writes, and oversized page requests before your database adapter runs.

## Command Cheat Sheet

| Command | Purpose |
| --- | --- |
| `pnpm build` | Compile the SDK to `dist`. |
| `pnpm typecheck:sdk` | Typecheck core SDK and runtime. |
| `pnpm typecheck:examples` | Typecheck example domain packs. |
| `pnpm typecheck:starters` | Build SDK and typecheck the VOIP RTC starter. |
| `pnpm dev:voip-rtc` | Run the reusable RTC voice starter. |
| `pnpm harness:route-wines` | Run the route-wines builder harness. |
| `pnpm test:knowledge-tool` | Check runtime knowledge tool wiring. |
| `pnpm test:llm-harness` | Check provider-agnostic builder LLM planner, research, verifier, and resolver behavior. |
| `pnpm test:builder-draft-ownership:bdd` | Check privileged builder workflows reload server-owned drafts by authenticated owner. |
| `pnpm test:database-provisioning` | Run the real starter database provisioner validation against the pgvector template and hostile SQL cases. |
| `pnpm test:solid-seams` | Run focused BDD seam tests for HTTP guards, voice factory/learning, builder summaries, and infra validation. |
| `pnpm test:runtime-tool-call` | Check runtime tool call flow. |
| `pnpm test:rtc-e2e` | Run the RTC WebSocket e2e script. |
| `pnpm audit:solid` | Run the full SOLID gate: architecture, responsibility, LOC, boundaries, typechecks, seam/LLM/ownership/DB provisioning tests, and RTC E2E. |
| `pnpm audit:architecture` | Enforce Dependency Cruiser SOA/SOLID import boundaries. |
| `pnpm audit:responsibility` | Enforce SRP/LSP clean-code responsibility rules. |
| `pnpm audit:sdk-boundary` | Verify core SDK boundary rules. |
| `pnpm audit:imports` | Audit core import boundaries. |
| `pnpm audit:tool-contracts` | Verify compiled builder tools have runtime contracts. |
| `pnpm audit:loc` | Enforce the handwritten file LOC ceiling. |
| `pnpm pack:dry-run` | Inspect package contents. |

## Starter Routes

| Route | Purpose |
| --- | --- |
| `GET /health` | Server status and active session count. |
| `GET /config` | Public runtime provider/audio config. |
| `GET /voice/ws` | Browser voice WebSocket upgrade. |
| `GET /builder/config` | Builder providers, tools, availability, budgets. |
| `GET /builder/onboarding` | Local dependency checks plus redacted env-store state. |
| `GET /builder/session` | Active compiled builder session. |
| `GET /builder/agents` | Draft/compiled agent bank. |
| `GET /builder/drafts/:draftId` | One persisted draft. |
| `POST /builder/prompt-plan` | Create prompt plan from identity and intent. |
| `POST /builder/prompt-clarifications` | Merge builder answers into prompt part 1. |
| `POST /builder/ingest-document` | Parse a document into knowledge input. |
| `POST /builder/run-research` | Run budget-aware autonomous research. |
| `POST /builder/autonomous-knowledge` | Research, plan, provision, and compile knowledge. |
| `POST /builder/knowledge-plan` | Plan RAG/KG strategy. |
| `POST /builder/database-plan` | Plan Postgres/pgvector schema. |
| `POST /builder/apply-database` | Apply validated DB plan. |
| `POST /builder/compile-knowledge` | Chunk, embed, and store knowledge. |
| `POST /builder/compile-agent` | Compose final prompt and activate artifact. |
| `POST /builder/onboarding/env` | Persist allowlisted onboarding keys to `.env.local`. |
| `POST /builder/onboarding/infra/:action` | Run `plan`, `apply`, `status`, or `destroy`. |
| `POST /builder/session` | Activate an existing compiled draft. |

## Control Plane Auth

The SDK exposes an `AuthTicketPort` for application-owned identity checks. The
VOIP starter wires a dev-token adapter from `VOICE_DEV_AUTH_TOKEN`; downstream
apps can provide a verifier backed by their own session, JWT, or one-time
WebSocket ticket system.

Protected starter routes are `/builder/*` and `/voice/ws`. The WebSocket route
passes the verified `tenantId`, `userId`, and `planId` into the voice runtime;
query params are only requested identity hints for the dev adapter, not the
runtime source of truth.

Builder drafts created through `/builder/prompt-plan` are tagged with the
verified owner. Privileged database/knowledge workflows reload the server-side
draft by `draftId`, require the authenticated owner to match, and ignore any
request-supplied draft payload.

## Environment Cheat Sheet

Realtime providers:

```bash
DEFAULT_REALTIME_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_REALTIME_MODEL=gemini-3.1-flash-live-preview
GEMINI_REALTIME_VOICE=Puck
OPENAI_API_KEY=
OPENAI_REALTIME_MODEL=gpt-realtime-1.5
OPENAI_REALTIME_VOICE=marin
```

Builder LLMs, research, embeddings, and knowledge store:

```bash
VOICE_SERVER_HOST=127.0.0.1
VOICE_ALLOWED_ORIGINS=http://localhost:5177,http://127.0.0.1:5177
VOICE_DEV_AUTH_TOKEN=
VITE_VOICE_DEV_AUTH_TOKEN=

BUILDER_PROMPT_PROVIDER=deepseek
BUILDER_RESEARCH_PROVIDER=deepseek
BUILDER_RESEARCH_MODEL=
BUILDER_RESEARCH_ESTIMATED_COST_PER_1K_TOKENS=0.00014
BUILDER_KNOWLEDGE_VERIFICATION_PROVIDER=kimi
BUILDER_KNOWLEDGE_VERIFICATION_MODEL=
BUILDER_KNOWLEDGE_VERIFICATION_MAX_TOKENS=65536
BUILDER_KNOWLEDGE_VERIFICATION_PASSES=3

DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-pro
DEEPSEEK_BASE_URL=https://api.deepseek.com
QWEN_API_KEY=
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
KIMI_API_KEY=
KIMI_MODEL=kimi-k2.6
GEMINI_API_KEY=
GEMINI_TEXT_MODEL=gemini-3.5-flash

VOYAGE_API_KEY=
VOYAGE_EMBEDDING_MODEL=voyage-4-large
VOYAGE_EMBEDDING_DIMENSIONS=1024
DATABASE_URL=postgres://...
```

## Boundary Rules

`src` is reusable SDK/runtime code. Product logic does not belong there.

Keep product-specific prompts, schemas, tools, repositories, routes, auth,
observability, and workflows in:

- a starter;
- a domain pack;
- a downstream app.

Internal generated documentation is intentionally ignored from Git through
`docs/`.

## SOLID Quality Gates

This repo treats architecture rules as executable constraints:

- `pnpm audit:architecture` runs Dependency Cruiser and fails on cycles,
  unresolved imports, undeclared packages, production code importing dev-only
  packages, `dist` imports, SDK-to-server/client coupling, server-to-client
  coupling, starter UI/server coupling, feature-to-feature imports, builder
  domain impurity, runtime importing builder internals, app/http/voice adapter
  boundary drift, and tests leaking into production modules.
- `pnpm audit:responsibility` enforces one visible responsibility per file:
  max 5 runtime exports per implementation file, one exported component per
  TSX file, explicit file names, pure UI domain modules, UI primitive leaves,
  SDK foundation purity, builder domain purity, barrel-only files for names
  like `index.ts`, `utils.ts`, `state.ts`, `request.ts`, `routing.ts`, and
  `protocol.ts`, and Liskov-safe substitution by rejecting concrete inheritance
  except platform base classes.
- Barrels may preserve public imports, but logic belongs in named modules with
  one reason to change. The VOIP starter currently keeps only
  `server/index.ts` and `server/builder/index.ts` as public server indexes.
- New cross-layer behavior must go through typed contracts or ports. Do not
  reach across service boundaries to reuse an implementation detail.
- In the VOIP starter server, `server/index.ts` is the only allowed root file.
  Composition belongs in `server/app`, HTTP policy in `server/http`, voice
  orchestration in `server/voice`, and technical bindings in `server/adapters`.

## VOIP RTC Starter

The starter in `starters/voip-rtc` is the fastest way to test the runtime:

```bash
cp starters/voip-rtc/.env.example starters/voip-rtc/.env
pnpm dev:voip-rtc
```

It launches:

- Bun WebSocket voice server;
- React/Vite RTC lab;
- builder workflow UI;
- runtime config endpoint;
- Gemini/OpenAI provider wiring;
- browser PCM16 capture/playback;
- Postgres/pgvector knowledge adapters.

## Project Status

This is an early clean-core SDK and starter. The Fastify adapter is a placeholder
until the next adapter pass wires tenant resolution, secrets, provider factories,
media bridge factories, tools, prompts, and database adapters behind public
ports. The starter builder already uses the provider-agnostic LLM harness for
planning, research, and verification.
