# Starter Server Map

This server is the concrete VoIP RTC starter implementation. It can depend on `@voiceagentsdk/core`, but core SDK code must not depend on this folder.

- `index.ts` starts the local starter server.
- `app/` wires configuration, bootstrap, environment, and SDK runtime helpers.
- `auth/`, `secrets/`, and `voice/` contain starter-specific request/session boundaries.
- `builder/` contains the guided agent builder service and workflow orchestration.
- `http/` contains HTTP route composition and protocol route handlers.
- `infra/` contains concrete starter infrastructure helpers such as Postgres SQL.
- `learning/` contains starter learning stores, Temporal integration, and evolution workflow support.
- `runtime/` contains compiled agent runtime policies, memory, prompt compiler, and tools.
- `providers/` contains starter provider catalog and lookup logic.

Keep reusable contracts in the SDK. Keep environment-specific wiring in this starter.
