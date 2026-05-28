# TODO - Agnostic Voice Agent SDK

Current goal: turn the wine investment pack into an executable pack.

Target commit title candidate: `test: make wine investment pack executable`

## Active Focus

### Wine Investment Pack

Outcome:
The wine investment example should be runnable as a concrete pack instead of
only typechecked sample code, while keeping pack code isolated from starter
runtime internals.

BDD target:

- Add `pnpm test:wine-investment-pack:bdd`.
- Prove the pack compiles through the public SDK.
- Prove the pack exposes runnable metadata/entrypoint for a host app.
- Prove the pack does not import starter server/client internals.

Implementation target:

- [ ] Audit `examples/packs/wine-investment` responsibilities and exports.
- [ ] Add an executable pack contract or runner using public SDK APIs only.
- [ ] Add a BDD script for compile + runtime entrypoint behavior.
- [ ] Keep pack files under 300 LOC and preserve package export boundaries.

Definition of done:

- [ ] `pnpm test:wine-investment-pack:bdd` is red before implementation, then
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

## Architecture Backlog - Adapters And Demo

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
