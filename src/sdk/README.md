# SDK Map

The SDK side is provider-agnostic. It should not depend on starter code or concrete server adapters.

- `index.ts` is the stable `@voiceagentsdk/core/sdk` facade.
- `builders.ts` is the stable builder facade; implementation lives in `builders/`.
- `types.ts` is the stable type facade; granular types live in `types/`.
  Navigation indexes under `types/domains/` group them by runtime, learning,
  store, infra, knowledge, protocols, and builder concerns.
  Broad domains such as `core`, `infra`, `learning`, `learning-loop`,
  `runtime-ports`, and `ports` use short root facades with detailed contracts
  nested under matching directories.
- `runtime.ts` exposes runtime construction helpers.
- `store.ts` is the stable store facade; implementation lives in `store/`.
- `diagnostics/` contains AgentRx diagnostics and reporting helpers.
- `learning/` contains the adaptive learning loop, receipts, policies, and in-memory test repository.
- `protocols/` contains SDK-level protocol descriptions for A2A and MCP compatibility.

When adding functionality, prefer a focused nested file plus a small facade export instead of adding more logic to the top-level facade files.
`pnpm audit:sdk-type-domains` enforces this for the broad SDK type domains, and
`pnpm audit:sdk-type-imports` keeps SDK implementation files on specific type
domains instead of the broad `types.ts` facade.
