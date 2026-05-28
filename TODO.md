# TODO - Agnostic Voice Agent SDK

Current goal: rotate flagged local env credentials.

Target commit title candidate: `chore: rotate local env credentials`

## Active Focus

### Secret Hygiene

Outcome:
Ignored local env files do not contain live production credentials, and any
exposed development keys are rotated outside the repo.

Next work:

- [ ] Rotate `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `VOYAGE_API_KEY`, and
  `MOONSHOT_API_KEY` from the ignored root `.env`; `pnpm audit:local-secrets`
  reported them on 2026-05-28 without printing values.
- [ ] Rerun `pnpm audit:local-secrets` after rotation/removal and keep the
  command output clean.

### Current Gates

Run before commit:

- [ ] `pnpm audit:solid`
- [ ] `git diff --check`

Optional security/network checks:

- [ ] `pnpm audit:local-secrets`
- [ ] `pnpm audit --json`
- [ ] `pnpm audit --dev --json`
- [ ] `curl http://127.0.0.1:8787/config`
- [ ] `curl http://127.0.0.1:8787/builder/config`

## Immediate Risk Backlog

No immediate code hardening items remain in this section.

## Architecture Backlog - Agent Infra / DB Harness

- [ ] Add real OpenTofu/cloud-init external runner integration beyond K3s
  manifest apply.
- [ ] Add per-agent credential refs for runtime DB users.
- [ ] Decide whether Milvus/graph stay starter adapters or graduate into
  reusable SDK adapter packages.

## Architecture Backlog - Agent Self-Improving Stores

- [ ] Add a real Temporal worker adapter beyond the local in-process queue.
- [ ] Add production Redis adapter tests against ephemeral Redis.
- [ ] Add Neo4j/Memgraph graph adapters; keep Postgres graph as local default.
- [ ] Add an approval/pending workflow for infra-plan evolution before applying
  cloud or destructive changes.

## Architecture Backlog - Tool Contracts

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

## Architecture Backlog - Runtime Ports

- [ ] Add `TenantResolverPort`:
  - input: `{ channel, provider, from, to, callId, accountId }`;
  - output: `{ tenantId, providerId, mediaBridgeId, planId, userId?, limits,
    promptVariables, metadata }`.
- [ ] Add `SecretResolverPort` to resolve `SecretRef` without hardcoded
  `process.env` access in runtime code.
- [ ] Add `ProviderFactoryPort` for OpenAI Realtime, Gemini Live, Grok
  Realtime, and cascaded providers.
- [ ] Add `MediaBridgeFactoryPort` for start, stop, `sendAudio`,
  `clearOutput`, and `onAudioToLlm`.
- [ ] Promote `ToolRegistryAdapterPort` into a real SDK-agnostic runtime port.
- [ ] Add `DbAdapterRegistry` and keep adapters out of serializable SDK
  definitions.
- [ ] Wire `StoreDefinition` to `DbAdapterRegistry`.
- [ ] Add SQL/document/vector store adapters:
  - field and index mapping;
  - pagination/cursor;
  - soft delete;
  - optional migrations.
- [ ] Add `PromptCompilerPort` to compile tenant/channel/plan/tools/prompt
  sections/variables into runtime instructions.
- [ ] Add `EventSink` / `LoggerPort` with console, noop, and custom sinks.
- [ ] Add `MemoryStore` with in-memory default and optional Redis adapter.

## Architecture Backlog - Adapters And Demo

- [ ] Wire `src/server/adapters/fastify` to the cleaned runtime.
- [ ] Transform `examples/packs/wine-investment` into an executable pack.
- [ ] Add contractual tests for:
  - SDK compilation;
  - provider factory;
  - media bridge;
  - browser protocol;
  - package exports.

## Architecture Backlog - AGENTRX Diagnostics

- [ ] Add tests/audits for:
  - SDK typecheck;
  - starter typecheck;
  - route-wines harness;
  - AGENTRX report presence and non-empty artifact assertions.
