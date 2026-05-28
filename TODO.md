# TODO - Agnostic Voice Agent SDK

Current goal: AGENTRX diagnostics contracts complete; no active implementation
TODO remains in the architecture backlog.

Target commit title candidate: `test: add agentrx diagnostics contracts`

## Completed This Pass

- [x] Audited existing AGENTRX report generation and artifact paths.
- [x] Added `pnpm test:agentrx-diagnostics:bdd`.
- [x] Proved SDK typecheck, starter typecheck, and route-wines harness signals.
- [x] Proved AGENTRX failure localization keeps an auditable validation log.
- [x] Proved route-wines AGENTRX artifacts are present and non-empty.
- [x] Integrated the AGENTRX BDD in `pnpm audit:solid`.
- [x] Updated README and CHANGELOG before commit.

## Final Gates

- [x] `pnpm test:agentrx-diagnostics:bdd`
- [x] `pnpm audit:solid`
- [x] `git diff --check`

## Maintenance Backlog

### External Secret Rotation

- [ ] Revoke/regenerate `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `VOYAGE_API_KEY`,
  and `MOONSHOT_API_KEY` in provider dashboards if the scrubbed ignored `.env`
  values were live. Local `pnpm audit:local-secrets` is clean as of 2026-05-28.
