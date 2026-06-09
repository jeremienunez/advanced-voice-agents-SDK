# Public API Boundary

The package exposes exactly eight npm entrypoints. Keep this list synchronized
with `scripts/public-api/manifest.ts` and `package.json`:

- `@voiceagentsdk/core`
- `@voiceagentsdk/core/sdk`
- `@voiceagentsdk/core/server`
- `@voiceagentsdk/core/server/adapters/fastify`
- `@voiceagentsdk/core/server/providers`
- `@voiceagentsdk/core/server/media`
- `@voiceagentsdk/core/server/browser`
- `@voiceagentsdk/core/client/browser`

## Ownership

- Root `@voiceagentsdk/core` is a compact SDK facade for common builders and
  compilation.
- `@voiceagentsdk/core/sdk` owns provider-neutral authoring contracts,
  builders, stores, learning, diagnostics, and MCP/A2A compatibility helpers.
- `@voiceagentsdk/core/server` owns runtime sessions, mailbox workers,
  protocol adapters, providers, media, memory, and observability.
- Browser entrypoints split client ergonomics from server-side browser voice
  service code.

## Guardrails

`pnpm audit:public-api` parses the public source facades and compares them with
`scripts/public-api/manifest.ts`. It fails when:

- `package.json` adds, removes, or retargets a public export.
- A public facade uses `export *`.
- A public facade exports a value or type not declared in the manifest.
- The server facade leaks SDK protocol-neutral helper values such as
  `toMcpToolDescriptor` or `createA2AAgentCard`.

When changing the public API, update the manifest first, then update the facade
and public-boundary tests in the same commit.
