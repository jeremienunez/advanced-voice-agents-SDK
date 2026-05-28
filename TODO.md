# TODO - Agnostic Voice Agent SDK

Current goal: add AGENTRX diagnostics contract tests.

Target commit title candidate: `test: add agentrx diagnostics contracts`

## Active Focus

### AGENTRX Diagnostics

Outcome:
AGENTRX diagnostics should have focused BDD coverage for the expected local
quality signals and report artifacts, so diagnostic regressions are visible
without reading ad hoc command output.

BDD target:

- Add `pnpm test:agentrx-diagnostics:bdd`.
- Prove diagnostics include SDK typecheck and starter typecheck signals.
- Prove diagnostics include the route-wines harness signal.
- Prove AGENTRX report artifacts are present and non-empty.

Implementation target:

- [ ] Audit existing AGENTRX report generation and artifact paths.
- [ ] Add a BDD script for diagnostics/report assertions.
- [ ] Add or tighten any missing diagnostics runner boundary.
- [ ] Keep diagnostics scripts small and under the existing audit rules.

Definition of done:

- [ ] `pnpm test:agentrx-diagnostics:bdd` is red before implementation, then
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

## Architecture Backlog - AGENTRX Diagnostics

- [ ] Add tests/audits for:
  - SDK typecheck;
  - starter typecheck;
  - route-wines harness;
  - AGENTRX report presence and non-empty artifact assertions.
