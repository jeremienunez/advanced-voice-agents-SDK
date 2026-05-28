# TODO - Agnostic Voice Agent SDK

Current goal: add source audits for runtime tool binding.

Target commit title candidate: `test: audit runtime tool binding invariants`

## Active Focus

### Agent Infra / DB Harness

Outcome:
Source audits should make runtime tool binding failures visible before RTC
startup.

Next work:

- [ ] Add source audits for:
  - no `unknown.*` handler fallback in selected runtime tools;
  - no selected tool without an executable runtime binding;
  - no compiled runtime artifact that claims executable tools but only has
    serializable manifests.

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

### External Secret Rotation

- [ ] Revoke/regenerate `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `VOYAGE_API_KEY`,
  and `MOONSHOT_API_KEY` in provider dashboards if the scrubbed ignored `.env`
  values were live. Local `pnpm audit:local-secrets` is clean as of 2026-05-28.

## Architecture Backlog - Tool Contracts

- [ ] Decide the `tool-plan` prompt path:
  - wire a real planner method that uses the templates; or
  - delete the templates until the flow is no longer deterministic.

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
