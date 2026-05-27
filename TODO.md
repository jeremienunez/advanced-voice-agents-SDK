# TODO - Agnostic Voice Agent SDK

Current goal: continue the hardening backlog with focused, falsifiable tests
before taking larger runtime/security slices.

Target commit title candidate: `test: cover builder llm harness`

## Active Focus

### Builder LLM Harness Coverage

Outcome:
Builder planning, research, verification, and model selection can be refactored
without silently breaking provider-agnostic behavior.

Next work:

- [ ] Pick the next hardening slice after the LLM harness test commit.

Done in this focus:

- `pnpm test:llm-harness` covers prompt planner JSON fallback, autonomous
  research document/checkpoint creation, verifier verdict normalization, and
  resolver requested-provider fallback with a fake `LlmTaskRunnerPort`.
- `pnpm audit:solid` now runs architecture, responsibility, LOC, SDK boundary,
  import boundary, core/starter typechecks, focused seam tests, LLM harness
  tests, and RTC E2E.
- Dependency Cruiser enforces SOA/SOLID import boundaries, including
  `server/app`, `server/http`, `server/voice`, and `server/adapters`.
- Responsibility audit enforces max 5 runtime exports, one TSX component per
  file, explicit file names, starter server root entrypoint only,
  barrel-only files for `index/utils/state/request/routing/protocol`, and
  Liskov-safe substitution by blocking concrete inheritance except platform
  base classes.
- `pnpm test:solid-seams` covers HTTP origin/auth guards, voice provider
  catalog validation, voice learning skipped/enqueued paths, builder state
  serializers, and infra provisioning validation.
- Starter builder compatibility barrels were removed:
  `server/builder/state.ts`, `server/builder/request.ts`, and
  `server/builder/utils.ts`. Only explicit public indexes remain:
  `server/index.ts` and `server/builder/index.ts`.

### Current Gates

Run before commit:

- [x] `pnpm audit:solid`
- [x] `git diff --check`

Recently green:

- [x] `pnpm typecheck:starters`
- [x] `pnpm test:llm-harness`
- [x] `pnpm test:solid-seams`
- [x] `pnpm test:infra-plan`
- [x] `pnpm test:learning`
- [x] `pnpm test:learning:bdd`
- [x] `pnpm test:knowledge-tool`
- [x] `pnpm pack:dry-run`

Optional security/network checks:

- [ ] `pnpm audit --json`
- [ ] `pnpm audit --dev --json`
- [ ] `curl http://127.0.0.1:8787/config`
- [ ] `curl http://127.0.0.1:8787/builder/config`

## Architecture Backlog - Builder LLM Harness

- [x] Add SDK-level LLM task abstractions:
  - provider id;
  - task roles;
  - output contracts;
  - model profiles;
  - resolver and runner ports.
- [x] Add starter model catalog for DeepSeek, Qwen, Kimi, and Gemini.
- [x] Route builder planning through `LlmPromptPlanner`.
- [x] Route autonomous research through `LlmKnowledgeResearch`.
- [x] Route teacher verification through `LlmKnowledgeVerifier`.
- [x] Keep provider-specific request params behind adapter shapes:
  - OpenAI-compatible chat completions;
  - Gemini `generateContent`;
  - JSON mode/schema mode;
  - thinking controls;
  - max output token fields;
  - retries, usage, and tool-call normalization.
- [x] Delete legacy direct provider adapters:
  - `deepseek-chat`;
  - `deepseek-planner`;
  - `deepseek-research`;
  - `kimi-knowledge-verifier`.
- [x] Remove frontend/server defaults that forced DeepSeek/Kimi before
  `/builder/config` loaded.
- [x] Make builder prompt templates provider-agnostic.
- [x] Add focused tests with fake `LlmTaskRunnerPort` for:
  - prompt planner JSON fallback;
  - research document/checkpoint creation;
  - verifier verdict normalization;
  - resolver role selection and requested-provider fallback.

## Architecture Backlog - Agent Infra / DB Harness

- [x] Add SDK-level infra contracts:
  - `AgentInfraPlan`;
  - compute target;
  - isolation mode;
  - provisioning mode;
  - database backend plan;
  - knowledge backend plan;
  - migration and security policy metadata.
- [x] Attach `infraPlan` to `AgentBuildDraft` and preserve it through draft
  mutation.
- [x] Add starter `IntentInfraPlanner` that keeps Postgres/pgvector as source
  of truth and routes optional Milvus, graph, and Redis slots by env/intent.
- [x] Generate and save `infraPlan` during database planning and autonomous
  knowledge flows.
- [x] Surface the infra plan in the builder database panel.
- [x] Document infra env vars in the root and starter READMEs.
- [x] Add fake-planner tests for:
  - default Postgres plan;
  - explicit Milvus selection;
  - KG/graph plan;
  - Redis cache plan.
- [x] Add `pnpm run test:infra-plan`.
- [x] Add an `InfraProvisionerPort` implementation that can validate plans
  without applying cloud resources.
- [x] Add plan-only IaC bundle output for local, VM, K3s, Kubernetes, and
  managed targets.
- [x] Add filesystem writer/export command for generated IaC bundles.
- [x] Add actionable onboarding apply command:
  - Docker-backed K3s creation/reuse;
  - kubectl manifest apply;
  - status verification;
  - local cluster destroy command.
- [x] Add solution-owned onboarding UI:
  - checks Docker, kubectl, K3s readiness, Terraform, and OpenTofu;
  - writes allowlisted voice/auth/infra keys to ignored `.env.local`;
  - runs infra `plan`, `apply`, `status`, and `destroy` from the starter.
- [x] Make onboarding the default non-dev entrypoint:
  - app starts on `Onboarding`;
  - restored compiled agents no longer auto-switch the first view to RTC;
  - safe guided actions show preview/apply/status first;
  - destructive cleanup is hidden behind advanced confirmation.
- [x] Add form-level onboarding key warnings:
  - at least one Gemini/OpenAI key for voice runtime;
  - at least one DeepSeek/Qwen key for builder research/planning;
  - `DATABASE_URL` plus `VOYAGE_API_KEY` for RAG compilation.
- [x] Replace long onboarding lists with drawers:
  - env keys grouped by Voice, Builder, Knowledge, Infra, and Auth;
  - local prerequisite checks collapsed when healthy.
- [ ] Add real OpenTofu/cloud-init external runner integration beyond K3s
  manifest apply.
- [ ] Add least-privilege Postgres role creation and per-agent credential refs.
- [ ] Decide whether Milvus/graph stay starter adapters or graduate into
  reusable SDK adapter packages.

## Architecture Backlog - Agent Self-Improving Stores

- [x] Add SDK-level learning contracts:
  - `TemporalWorkflowPort`;
  - `TemporalMemoryStorePort`;
  - `GraphMemoryStorePort`;
  - `AgentEvolutionPort`;
  - typed learning session, transcript, tool call, memory, graph, and version
    records.
- [x] Attach `AgentStorePlan` to `AgentInfraPlan` when learning is enabled.
- [x] Keep store creation delayed until session end:
  - infra plan describes Redis, Temporal, graph, audit/source, and optional
    vector memory;
  - actual `ensure()` happens inside learning runtime paths, not during builder
    planning.
- [x] Keep dev mode fully env-driven:
  - `AGENT_LEARNING_ENABLED`;
  - `AGENT_LEARNING_MEMORY_TTL_SECONDS`;
  - `REDIS_URL`;
  - `TEMPORAL_ADDRESS`;
  - `TEMPORAL_NAMESPACE`;
  - `TEMPORAL_TASK_QUEUE`;
  - `NEO4J_URI` / `GRAPH_DATABASE_URL`.
- [x] Add RTC end-session learning hook:
  - collects transcript, tool calls, summary, tenant/user, draft/agent ids;
  - queues learning asynchronously after shutdown;
  - emits `learning.status` without blocking session close.
- [x] Add local learning workflow:
  - classifies summaries, preferences, failed intents, missing tools, entities,
    and relations;
  - writes TTL temporal memory;
  - upserts graph memory idempotently;
  - appends agent prompt/tool/infra evolution metadata.
- [x] Add auto-evolution guardrails:
  - append-only versions;
  - rollback pointer and rollback action from Agent Bank;
  - audit row metadata for every apply/rollback;
  - learned-memory secret redaction;
  - no destructive infra migration.
- [x] Surface learning in the starter UI:
  - Learning Stores panel in database/infra area;
  - RTC Lab learning status after stop;
  - Agent Bank current version, last learning run, and rollback action;
  - onboarding checks for Redis, Temporal, graph backend, and TTL config.
- [x] Add Popper-style BDD coverage:
  - infra store planning is falsifiable through warnings/env refs;
  - Temporal queued/running/applied and queued/running/failed paths;
  - memory TTL/scope/redaction;
  - graph idempotency;
  - append-only version evolution;
  - skipped orphan sessions produce no side effects.
- [x] Nest learning modules under the 300 LOC handwritten-file limit:
  - SDK learning/provisioning/database type modules;
  - infra backend/store-plan modules;
  - learning evolution state/prompt/type modules;
  - BDD scenario/fixture/assertion modules;
  - UI domain split for app mode, knowledge, database, and evolution types.
- [ ] Add a real Temporal worker adapter beyond the local in-process queue.
- [ ] Add production Redis adapter tests against ephemeral Redis.
- [ ] Add Neo4j/Memgraph graph adapters; keep Postgres graph as local default.
- [ ] Add an approval/pending workflow for infra-plan evolution before applying
  cloud or destructive changes.

## Immediate Risk Backlog - 2026-05-27

- [ ] Protect the starter control plane:
  - require an application-provided session/ticket verifier on `/builder/*`;
  - require an application-provided session/ticket verifier on `/voice/ws`;
  - derive tenant/user from verified identity instead of query params;
  - enforce HTTP and WebSocket origin allowlists;
  - bind dev surfaces to localhost by default unless explicitly configured.
- [ ] Harden database provisioning:
  - stop trusting request-supplied drafts for privileged workflows;
  - load drafts server-side by authenticated owner;
  - replace broad SQL allowlists with typed migration/templates;
  - ban `AS SELECT`, arbitrary function calls, arbitrary extensions and
    expression indexes from generated/user-influenced SQL;
  - enforce least-privileged Postgres roles and `statement_timeout`.
- [ ] Harden document ingestion:
  - request and file size limits;
  - content-length enforcement;
  - MIME/extension allowlist;
  - spreadsheet sheet/row/cell/text caps;
  - parser timeouts and per-IP quotas.
- [ ] Harden prompt/tool orchestration:
  - append immutable server-owned safety and tool policy after generated
    prompts;
  - quote builder input and document content as data;
  - lint compiled prompts for required invariants;
  - enforce tool authorization server-side, independent of model text.
- [ ] Harden logs and debug artifacts:
  - remove prompt/message previews from normal logs;
  - add recursive redaction for nested secrets/content;
  - gate audio dumps to local-only debug with restrictive permissions and
    cleanup.
- [ ] Rotate local API keys if the ignored `.env` contains live production
  credentials.

## Architecture Backlog - Tool Contracts

- [x] Add starter tool contracts:
  - `ToolBuildPlan`;
  - `ToolBuildContract`;
  - validation report;
  - compiled tool contract status in the builder UI.
- [x] Add deterministic starter flow:
  - registry to tool contracts;
  - contract validation;
  - selected tool instructions;
  - runtime action handlers.
- [x] Add `audit:tool-contracts`.
- [ ] Split the public tool API cleanly:
  - keep executable runtime tools with a required `execute` handler;
  - keep serializable build/manifests separate from executable
    `ToolDefinition`;
  - avoid making downstream consumers handle half-executable tools.
- [ ] Promote starter handler maps into `ToolRegistryAdapterPort` instead of
  hardcoded local `handlerRef` sets.
- [ ] Decide the `tool-plan` prompt path:
  - wire a real planner method that uses the templates; or
  - delete the templates until the flow is no longer deterministic.
- [ ] Add source audits for:
  - no `unknown.*` handler fallback in selected runtime tools;
  - no selected tool without an executable runtime binding;
  - no compiled runtime artifact that claims executable tools but only has
    serializable manifests.
- [x] Align README starter URL docs with current defaults:
  - `.env.example` and client defaults use `127.0.0.1:8787`;
  - Vite config defaults to `http://localhost:5177`;
  - `VOICE_ALLOWED_ORIGINS` example now includes port `5177`.

## Sprint 1 - Clean Core Base

- [x] Choisir `src` comme source canonique.
- [x] Supprimer le doublon physique `server/src/**`.
- [x] Supprimer les dossiers applicatifs copies: `server`, `client`, `shared`,
  `db-schema`.
- [x] Nettoyer `src` pour garder uniquement `sdk`, `server`, `client/browser`
  et l'entree package.
- [x] Garder le runtime serveur utile:
  - transports OpenAI/Gemini/Grok/cascaded/Twilio
  - sessions voice/audio/interruption/state
  - handlers media/browser/barge-in
  - types provider/session/event/error
  - utils audio/RNNoise/AEC/AGC/logger
- [x] Separer le client browser voice sans UI produit.
- [x] Mettre le metier en exemple hors core:
  - `examples/packs/wine-investment`
- [x] Refaire `package.json`:
  - `main` et `types` vers `dist`
  - exports publics SDK/server/client
  - allowlist `files`
  - suppression des deps publiques applicatives
- [x] Ajouter `tsconfig.build.json`.
- [x] Passer en ESM NodeNext avec imports `.js` resolvables.
- [x] Ajouter l'audit de frontiere `scripts/audit-core-imports.mjs`.
- [x] Ajouter un `StoreBuilder` pour generer des repositories safe:
  - scope tenant/user
  - operations autorisees
  - champs filtrables/triables/ecrivable
  - injection de scope avant adapter DB
- [x] Valider:
  - `pnpm typecheck:sdk`
  - `pnpm typecheck:examples`
  - `pnpm typecheck:starters`
  - `pnpm audit:sdk-boundary`
  - `pnpm audit:imports`
  - `pnpm build`
  - `pnpm pack --dry-run --json`
  - imports Node des exports publics

## Sprint 2 - Runtime Ports

- [ ] `TenantResolverPort`
  - input: `{ channel, provider, from, to, callId, accountId }`
  - output: `{ tenantId, providerId, mediaBridgeId, planId, userId?, limits,
    promptVariables, metadata }`
- [ ] `SecretResolverPort`
  - resoudre `SecretRef` sans `process.env` hardcode dans le runtime.
- [ ] `ProviderFactoryPort`
  - mapper OpenAI realtime, Gemini live, Grok realtime et cascaded.
- [ ] `MediaBridgeFactoryPort`
  - abstraire start/stop/sendAudio/clearOutput/onAudioToLlm.
- [ ] `ToolRegistryAdapterPort`
  - convertir les `ToolDefinition` SDK vers le runtime tools.
  - premiere version starter en place: registry -> contracts -> validation ->
    runtime action tools.
  - reste a promouvoir en vrai port SDK agnostique.
- [ ] `DbAdapterRegistry`
  - garder les adapters hors definition serialisable.
- [ ] Brancher les `StoreDefinition` sur `DbAdapterRegistry`.
- [ ] Ajouter adapters store SQL/document/vector:
  - mapping fields/indexes
  - pagination/cursor
  - soft delete
  - migrations optionnelles
- [ ] `PromptCompilerPort`
  - compiler tenant/channel/plan/tools/promptSections/variables vers
    instructions runtime.
- [ ] `AuthTicketPort`
  - verifier des tickets/session browser voice.
  - retourner `tenantId`, `userId`, `planId`, scopes et metadata.
  - ne pas embarquer login, users, RBAC ou fournisseur JWT dans le SDK.
- [ ] `EventSink` / `LoggerPort`
  - console/noop/custom sinks.
- [ ] `MemoryStore`
  - in-memory par defaut, Redis optionnel.

## Sprint 3 - Adapters And Demo

- [ ] Brancher `src/server/adapters/fastify` sur le runtime nettoye.
- [x] Ajouter un starter VOIP RTC Bun + React/Vite reutilisable.
- [ ] Ajouter un `AuthTicketPort` reusable pour remplacer le query auth local du starter.
  - doit couvrir `/builder/*` et `/voice/ws`.
  - doit remplacer `tenantId` / `userId` query params par une identite verifiee.
  - l'implementation concrete reste fournie par l'application.
- [ ] Transformer `examples/packs/wine-investment` en pack executable.
- [ ] Ajouter tests contractuels pour:
  - compilation SDK
  - provider factory
  - media bridge
  - browser protocol
  - package exports

## Sprint 4 - AGENTRX Diagnostics

Future commit title: `feat: add agentrx trajectory diagnostics to builder harness`

- [x] Ajouter une couche SDK `src/sdk/diagnostics/**`:
  - taxonomy AGENTRX cross-domain
  - trajectory IR
  - contraintes globales et dynamiques
  - validation log auditable
  - selection du premier echec critique
- [x] Instrumenter le builder starter:
  - identity
  - prompt plan
  - clarifications
  - autonomous research
  - knowledge plan
  - database provision
  - knowledge compile
  - agent compile
- [x] Forcer la separation provider par role:
  - builder/research/diagnostics passent par un resolver de modeles.
  - Gemini peut etre autorise comme planner pour raisons business.
  - Gemini reste le provider privilegie pour runtime vocal RTC.
  - aucun workflow ne doit hardcoder un provider unique.
- [x] Permettre la recherche autonome sans fichier upload:
  - plan de mise en oeuvre formel
  - checkpoints
  - budget
  - documents `web_research`
- [x] Ajouter un panneau UI diagnostic:
  - trajectory
  - constraints
  - violations
  - critical failure step
- [x] Ajouter les artifacts harness:
  - `trajectory-ir.json`
  - `validation-log.json`
  - `agentrx-report.json`
  - `agentrx-report.md`
- [ ] Ajouter tests/audits:
  - typecheck SDK/starter
  - harness route-wines
  - AGENTRX report present et non vide
  - typecheck is verified; a dedicated non-empty AGENTRX artifact assertion is
    still missing.
