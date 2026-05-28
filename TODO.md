# TODO - Agnostic Voice Agent SDK

Current goal: add MemoryStore runtime port.

Target commit title candidate: `test: add memory store port`

## Active Focus

### MemoryStore

Outcome:
Runtime memory should go through an injectable port with an in-memory default
and an optional Redis adapter, without coupling orchestration to concrete
storage clients.

BDD target:

- Add `pnpm test:memory-store-port:bdd`.
- Prove runtime memory reads and writes go through `MemoryStorePort`.
- Prove in-memory default is scoped by tenant/user/session.
- Prove Redis adapter is optional and env-selected without breaking local dev.

Implementation target:

- [ ] Add SDK `MemoryStorePort` and record/scope types.
- [ ] Add in-memory adapter with deterministic tests.
- [ ] Add starter Redis adapter or factory reusing existing learning Redis
  boundaries where it fits.
- [ ] Inject the memory port at runtime boundaries that need session/user memory.

Definition of done:

- [ ] `pnpm test:memory-store-port:bdd` is red before implementation, then green.
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
