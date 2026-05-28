# TODO - Agnostic Voice Agent SDK

Current goal: wire the Fastify voice adapter to the cleaned runtime.

Target commit title candidate: `test: wire fastify voice adapter`

## Active Focus

### Fastify Voice Adapter

Outcome:
The Fastify adapter should expose the cleaned voice runtime through a narrow
HTTP/WebSocket boundary, without depending on starter internals or placeholder
errors.

BDD target:

- Add `pnpm test:fastify-voice-adapter:bdd`.
- Prove the adapter registers voice routes against a Fastify-like app.
- Prove route prefixing is deterministic and does not leak starter paths.
- Prove the adapter consumes explicit runtime ports/config instead of importing
  app/bootstrap, HTTP routes, or starter voice composition.

Implementation target:

- [ ] Replace the placeholder `createFastifyVoiceAdapter` error path.
- [ ] Define the minimal Fastify-like route registration contract.
- [ ] Bridge WebSocket/session startup to the existing browser voice service
  boundary without coupling to the starter server.
- [ ] Keep adapter files under 300 LOC and preserve Dependency Cruiser
  boundaries.

Definition of done:

- [ ] `pnpm test:fastify-voice-adapter:bdd` is red before implementation, then
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
