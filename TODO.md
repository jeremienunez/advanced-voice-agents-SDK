# TODO - Agnostic Voice Agent SDK

Current goal: add EventSink / LoggerPort.

Target commit title candidate: `test: add event sink logger port`

## Active Focus

### EventSink / LoggerPort

Outcome:
Runtime logs and events should go through injectable ports instead of concrete
console calls or ad hoc callback shapes inside orchestration code.

BDD target:

- Add `pnpm test:event-sink-logger-port:bdd`.
- Prove voice/session runtime emits state, error, learning, and tool events
  through `EventSink`.
- Prove logger calls go through `LoggerPort` with redaction preserved.
- Prove noop, console, and custom sinks are substitutable.

Implementation target:

- [ ] Add `EventSink` and `LoggerPort` SDK runtime port types.
- [ ] Add noop and console adapters with existing redaction behavior.
- [ ] Inject ports into voice/session runtime boundaries.
- [ ] Replace direct console/runtime event writes where the orchestration owns
  behavior.

Definition of done:

- [ ] `pnpm test:event-sink-logger-port:bdd` is red before implementation, then
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
