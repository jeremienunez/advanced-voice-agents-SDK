# SDK Map

The SDK side is provider-agnostic. It should not depend on starter code or concrete server adapters.

- `index.ts` is the stable `@voiceagentsdk/core/sdk` facade.
- `builders.ts` is the stable builder facade; implementation lives in `builders/`.
- `types.ts` is the stable type facade; granular types live in `types/`.
- `runtime.ts` exposes runtime construction helpers.
- `store.ts` is the stable store facade; implementation lives in `store/`.
- `diagnostics/` contains AgentRx diagnostics and reporting helpers.
- `learning/` contains the adaptive learning loop, receipts, policies, and in-memory test repository.
- `protocols/` contains SDK-level protocol descriptions for A2A and MCP compatibility.

When adding functionality, prefer a focused nested file plus a small facade export instead of adding more logic to the top-level facade files.
