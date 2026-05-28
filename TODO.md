# TODO - Agnostic Voice Agent SDK

Current goal: add contractual tests for public SDK/runtime boundaries.

Target commit title candidate: `test: add public boundary contracts`

## Active Focus

### Public Boundary Contracts

Outcome:
Public package boundaries should be covered by focused BDD contracts so SDK
compilation, browser protocol messages, and exported package entrypoints cannot
regress silently.

BDD target:

- Add `pnpm test:public-boundaries:bdd`.
- Prove a minimal SDK definition compiles through the public `@voiceagentsdk/core`
  and `@voiceagentsdk/core/sdk` exports.
- Prove browser protocol message parsing keeps start/end/audio control contracts
  stable.
- Prove package export entrypoints resolve for sdk, server, browser, adapters,
  and client browser surfaces.

Implementation target:

- [ ] Add a root BDD script for public boundary contracts.
- [ ] Cover SDK compilation through public exports.
- [ ] Cover browser protocol parsing/shape without importing private starter
  modules.
- [ ] Cover package export resolution for declared entrypoints.

Definition of done:

- [ ] `pnpm test:public-boundaries:bdd` is red before implementation, then
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
