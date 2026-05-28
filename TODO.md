# TODO - Agnostic Voice Agent SDK

Current goal: add DbAdapterRegistry.

Target commit title candidate: `test: add db adapter registry`

## Active Focus

### DbAdapterRegistry

Outcome:
Runtime database/store adapters should resolve through a registry instead of
serializable SDK definitions carrying implementation details.

BDD target:

- Add `pnpm test:db-adapter-registry:bdd`.
- Prove that SDK database/store definitions carry adapter refs only.
- Prove that runtime code resolves concrete adapters through an injected
  registry.
- Prove that a missing adapter ref fails closed before runtime execution.
- Prove that `createSafeRepository` still enforces tenant scope, allowed
  operations, filters, sorting, writable fields, and page bounds once the
  adapter comes from the registry.

Implementation target:

- [ ] Add `DbAdapterRegistry` and keep adapters out of serializable SDK
  definitions.
- [ ] Add a dev/in-memory registry fixture for BDD and local starter tests.
- [ ] Wire `StoreDefinition` repository creation to `DbAdapterRegistry`.
- [ ] Keep knowledge/vector-specific adapters behind existing
  `KnowledgeStorePort` until the registry contract is proven for stores.
- [ ] Document where product apps bind concrete SQL/document/vector adapters.

Definition of done:

- [ ] `pnpm test:db-adapter-registry:bdd` is red before implementation, then
  green.
- [ ] `pnpm audit:solid`
- [ ] `git diff --check`
- [ ] TODO, CHANGELOG, and README are updated before commit.

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

## Architecture Backlog - Runtime Ports

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
  - browser protocol;
  - package exports.

## Architecture Backlog - AGENTRX Diagnostics

- [ ] Add tests/audits for:
  - SDK typecheck;
  - starter typecheck;
  - route-wines harness;
  - AGENTRX report presence and non-empty artifact assertions.
