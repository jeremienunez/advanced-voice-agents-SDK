# Server Map

The server side owns runtime orchestration and concrete integrations. It can depend on the SDK, but the SDK must not depend on this folder.

- `index.ts` is the stable `@voiceagentsdk/core/server` facade for runtime/server exports only.
- `agent/` contains voice session orchestration, transports, handlers, state machines, and audio utilities.
- `adapters/` contains concrete HTTP/server framework adapters such as Fastify.
- `browser/` contains the browser voice service entrypoint and its internal service modules.
- `mailbox/` contains agent mailbox implementations and workers.
- `media/`, `memory/`, `observability/`, and `providers/` expose runtime ports and defaults.
- `protocols/` contains server-side A2A and MCP adapters.

Keep concrete provider and transport details here. Shared, provider-neutral contracts and MCP/A2A helpers belong in `src/sdk/`.
