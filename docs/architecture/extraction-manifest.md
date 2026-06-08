# Extraction Manifest

Target: `/home/jerem/voiceagentsdk`

## Canonical Layout

- `src/sdk/**`: declarative SDK surface.
- `src/server/**`: agnostic server runtime subset.
- `src/client/browser/**`: browser voice client/protocol.
- `examples/packs/wine-investment/**`: example domain pack outside core.

## Removed From Core

- duplicated `server/src/**`
- top-level `server`, `client`, `shared`, `db-schema`
- product routes/controllers/services/jobs/emails/repositories/entities
- product prompts/tools/db clients/cortices
- public `@gaspard/*` workspace dependencies

## Kept Runtime Blocks

- realtime provider transports
- Twilio voice/SMS transports
- audio/session/interruption state
- browser media and barge-in handlers
- audio utils and denoise/gain/echo helpers
- browser WebSocket/audio worklet client

The original source repo remains the reference if omitted product-specific
logic has to be reintroduced later as a pack or adapter.
