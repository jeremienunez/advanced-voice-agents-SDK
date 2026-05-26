# VOIP RTC Starter

Reusable Bun + React/Vite starter for validating browser RTC voice flows around
`@voiceagentsdk/core`.

It is intentionally not a product example. It is a starter kit for future VOIP
projects:

- Bun WebSocket voice server.
- React/Vite browser RTC lab.
- Runtime provider configuration exposed through `GET /config`.
- Gemini Live and OpenAI Realtime provider wiring.
- Browser PCM16 24 kHz capture/playback through SDK worklets.
- Server-side sample-rate adaptation for provider contracts
  (Gemini 16 kHz input, browser/OpenAI 24 kHz).
- Reusable SDK bridge through `BrowserVoiceService`.

## Run

```bash
cp .env.example .env
pnpm --filter @voiceagentsdk/starter-voip-rtc dev
```

Open `http://localhost:5177`.

The server listens on `http://localhost:8787` by default and exposes:

- `GET /health`
- `GET /config`
- `GET /voice/ws`

## Runtime Configuration

Provider setup is env-driven and UI-discoverable. Set `GEMINI_API_KEY` or
`OPENAI_API_KEY`, then the browser lab pulls available providers, models, voices,
and audio contracts from `/config`.

Useful env vars:

- `DEFAULT_REALTIME_PROVIDER=gemini`
- `GEMINI_API_KEY`
- `GEMINI_REALTIME_MODEL` defaults to `gemini-3.1-flash-live-preview`
- `GEMINI_REALTIME_VOICE`
- `OPENAI_API_KEY`
- `OPENAI_REALTIME_MODEL`
- `OPENAI_REALTIME_VOICE`

## Production Notes

This starter uses no-op query auth for local demos. For production projects,
replace it with a real `AuthTicketPort` / single-use WebSocket ticket flow.
