# Repository Structure

This repository is organized around the package boundary first, then the local
starter and development tooling.

```text
.
├── src/
│   ├── sdk/              Public SDK contracts, builders, stores, learning loop
│   │   └── types/        SDK contracts with broad domains nested as folders
│   ├── server/           Runtime orchestration, providers, media, adapters
│   └── client/browser/   Browser voice client
├── starters/
│   └── voip-rtc/         Local/demo React + Bun starter integration
├── examples/
│   └── packs/            Optional example packs kept outside the core package
├── scripts/
│   ├── audits/           Static architecture, boundary, LOC, and secret audits
│   ├── public-api/       Manifest for npm entrypoints and public facades
│   ├── tests/
│   │   ├── bdd/          Root SDK BDD scenarios
│   │   ├── smoke/        Focused runtime smoke checks
│   │   └── type-contracts/
│   │       └── *.ts      Compile-only public contract tests
│   ├── quality/          Grouped quality matrix and solid gate runner
│   ├── secret-hygiene/   Shared secret-scanning implementation
│   └── agentrx-diagnostics/
│       └── manifest.ts   Shared AGENTRX diagnostic metadata
├── assets/screenshots/   README screenshots
└── docs/
    └── architecture/     Curated architecture notes and audit records
```

## Published Package Boundary

The npm package is intentionally SDK-only. `package.json` publishes:

- `dist`
- `README.md`
- `CHANGELOG.md`
- `TODO.md`
- `LICENSE`
- `RELEASE_ALPHA.md`
- `APP_OWNED_INTEGRATION.md`
- `REPO_STRUCTURE.md`

The package does not publish `starters/`, `examples/`, `scripts/`, `assets/`,
or internal `docs/`. Runtime imports are constrained by `package.json` `exports`.
Architecture notes under `docs/architecture/` are repository documentation only.

## Ownership Rules

- `src/sdk` defines app-facing contracts and does not import runtime, client,
  starter, example, or tooling modules.
- `src/sdk/protocols` defines protocol-neutral A2A/MCP mappings. It must not
  import protocol runtime SDK packages or server adapters.
- `src/server` owns runtime orchestration and depends on SDK contracts, not the
  browser client.
- `src/server/mailbox` owns reusable runtime mailbox adapters and workers for
  claim/ack coordination across concurrent agents.
- `src/server/protocols` owns optional runtime adapters for external protocols,
  including MCP JSON-RPC over Streamable HTTP. Executable tool calls must still
  pass through server policy.
- `src/client/browser` owns browser-side audio and websocket ergonomics and does
  not import server internals.
- `starters/voip-rtc` is a reference integration. It can consume the SDK, but
  core SDK modules cannot depend on the starter.
- Root `scripts/` are development tooling only. Production source cannot import
  BDD, smoke, audit, or script modules.
- `docs/architecture` contains curated, versioned design notes. Generated
  planning/spec documents may exist locally under ignored `docs/superpowers/`,
  but they are not tracked or part of the primary navigation surface.

These boundaries are enforced by `pnpm audit:architecture`,
`pnpm audit:public-api`, `pnpm audit:sdk-type-domains`,
`pnpm audit:responsibility`, `pnpm audit:loc`, and the package metadata BDD.

## Starter Map

`starters/voip-rtc` is organized by runtime responsibility first, then by
feature or adapter family:

```text
starters/voip-rtc/
├── server/
│   ├── app/              Bootstrap and environment composition
│   ├── builder/
│   │   ├── domain/       Pure builder rules grouped by infra, database,
│   │   │                 knowledge, prompt, research, drafts, tooling, shared
│   │   ├── adapters/     LLM, Postgres, infra, documents, embeddings, sources
│   │   ├── request/      HTTP input normalization
│   │   ├── state/        Local draft/session state
│   │   └── workflow-*    Builder orchestration entrypoints
│   ├── http/             Route composition and guards
│   ├── learning/         Post-session learning workflow and stores
│   ├── runtime/          Compiled agent, prompt compiler, runtime tools
│   └── voice/            Voice service composition and tenant/tool policies
├── src/
│   ├── features/         UI feature slices; each feature owns local styles/
│   ├── components/       Shared UI/layout primitives and component styles/
│   ├── domain/           UI-only app, builder, runtime, onboarding, shared
│   │                    models and derived state
│   ├── api/              Browser API clients
│   └── styles/           Global CSS only
└── scripts/
    ├── dev/              Local dev server/database launchers
    ├── infra/            Infra planning/apply helpers
    ├── harnesses/        Scenario harnesses such as route-wines
    └── tests/            BDD, integration, E2E, shared helpers, fixtures
```
