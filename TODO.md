# TODO - Agnostic Voice Agent SDK

Current goal: add PromptCompilerPort.

Target commit title candidate: `test: add prompt compiler port`

## Active Focus

### PromptCompilerPort

Outcome:
Runtime prompt compilation should go through an injectable port instead of voice
orchestration calling compiled artifact and SDK prompt helpers directly.

BDD target:

- Add `pnpm test:prompt-compiler-port:bdd`.
- Prove voice session setup asks a prompt compiler for tenant/channel/plan/tools
  instructions.
- Prove compiled artifacts and fallback SDK prompts stay behind the compiler.
- Prove runtime knowledge policy is applied by the compiler, not session
  orchestration.

Implementation target:

- [ ] Add `PromptCompilerPort` and runtime input types.
- [ ] Add starter prompt compiler adapter around current compiled-artifact and
  fallback prompt behavior.
- [ ] Inject the compiler into voice session creation.
- [ ] Remove direct prompt compilation responsibility from voice orchestration.

Definition of done:

- [ ] `pnpm test:prompt-compiler-port:bdd` is red before implementation, then
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
