# Source Map

This package keeps public npm entrypoints stable while allowing internals to stay nested by responsibility.

- `sdk/` contains the provider-agnostic authoring surface, types, diagnostics, learning loop, protocols, and store abstractions.
- `server/` contains server-side runtime adapters, session orchestration, browser voice service support, mailbox/protocol bridges, memory, media, observability, and providers.
- `client/browser/` contains browser-only voice session code and websocket protocol types.
- `index.ts` is the compact package root facade for common SDK builders and compilation. Full SDK helpers live under `sdk/index.ts`.

Do not move public facades such as `sdk/index.ts`, `server/index.ts`, `server/browser/index.ts`, or browser entrypoints without also checking package metadata and public-boundary tests. Keep server runtime exports separate from SDK protocol-neutral helpers.
