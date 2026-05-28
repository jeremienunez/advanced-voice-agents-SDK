# TODO - Agnostic Voice Agent SDK

Current goal: add SQL/document/vector store adapters.

Target commit title candidate: `test: add store adapter contracts`

## Active Focus

### Store Adapter Contracts

Outcome:
Concrete SQL, document, and vector store adapters should sit behind
`DbAdapterRegistry` without leaking implementation details into SDK
definitions.

BDD target:

- Add focused BDD for SQL/document/vector adapter contracts.
- Prove field and index mapping is adapter-owned.
- Prove pagination/cursor bounds stay behind the safe repository contract.
- Prove soft delete is adapter-owned and policy-driven.
- Prove optional migrations are explicit and never run from serializable SDK
  definitions.

Implementation target:

- [ ] Add SQL/document/vector adapter contract tests.
- [ ] Add adapter interfaces or fixtures only where they remove real ambiguity.
- [ ] Keep migrations opt-in and explicit.
- [ ] Keep `KnowledgeStorePort` separate unless a store adapter contract needs
  to consume it.

Definition of done:

- [ ] New BDD is red before implementation, then green.
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
