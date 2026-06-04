# Repository Structure

This repository is organized around the package boundary first, then the local
starter and development tooling.

```text
.
├── src/
│   ├── sdk/              Public SDK contracts, builders, stores, learning loop
│   ├── server/           Runtime orchestration, providers, media, adapters
│   └── client/browser/   Browser voice client
├── starters/
│   └── voip-rtc/         Local/demo React + Bun starter integration
├── examples/
│   └── packs/            Optional example packs kept outside the core package
├── scripts/
│   ├── audits/           Static architecture, boundary, LOC, and secret audits
│   ├── bdd/              Root SDK BDD scenarios
│   ├── smoke/            Focused runtime smoke checks
│   ├── type-tests/       Compile-only public contract tests
│   ├── secret-hygiene/   Shared secret-scanning implementation
│   └── agentrx-diagnostics/
│       └── manifest.ts   Shared AGENTRX diagnostic metadata
├── assets/screenshots/   README screenshots
└── docs/                 Internal planning and audit notes, not packaged
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

These boundaries are enforced by `pnpm audit:architecture`,
`pnpm audit:responsibility`, `pnpm audit:loc`, and the package metadata BDD.
