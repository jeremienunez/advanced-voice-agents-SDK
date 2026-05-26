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

## Flow

```mermaid
flowchart LR
  React[React RTC Lab] --> Client[BrowserVoiceSessionClient]
  Client --> WS[/voice/ws]
  WS --> Service[BrowserVoiceService]
  Service --> Session[RealtimeVoiceSession]
  Session --> Provider[Gemini Live or OpenAI Realtime]
```

## Builder Flow

```mermaid
flowchart TD
  Identity[Identity + Intent] --> PromptPlan[/builder/prompt-plan]
  PromptPlan --> Draft[AgentBuildDraft]
  Draft --> Knowledge[Knowledge + Research]
  Knowledge --> Database[Postgres/pgvector plan]
  Database --> Compile[CompiledAgentArtifact]
  Compile --> RTC[RTC Lab session agent id]
```

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

## Route Cheat Sheet

| Route | Purpose |
| --- | --- |
| `GET /health` | Server status and active session count. |
| `GET /config` | Runtime providers, models, voices, and audio contracts. |
| `GET /voice/ws` | Browser voice WebSocket endpoint. |
| `GET /builder/config` | Builder provider/tool availability. |
| `GET /builder/session` | Active compiled builder session. |
| `GET /builder/agents` | Agent bank. |
| `POST /builder/prompt-plan` | Create a draft from identity and intent. |
| `POST /builder/autonomous-knowledge` | Research, plan, provision, compile knowledge. |
| `POST /builder/compile-agent` | Compose final prompt and activate the agent. |

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

Builder and knowledge env vars:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `BUILDER_RESEARCH_PROVIDER`
- `BUILDER_RESEARCH_MODEL`
- `VOYAGE_API_KEY`
- `VOYAGE_EMBEDDING_MODEL`
- `VOYAGE_EMBEDDING_DIMENSIONS`
- `DATABASE_URL`

## Commands

```bash
pnpm --filter @voiceagentsdk/starter-voip-rtc dev
pnpm --filter @voiceagentsdk/starter-voip-rtc typecheck
pnpm --filter @voiceagentsdk/starter-voip-rtc harness:route-wines
pnpm --filter @voiceagentsdk/starter-voip-rtc test:knowledge-tool
pnpm --filter @voiceagentsdk/starter-voip-rtc test:rtc-e2e
```

## Production Notes

This starter uses no-op query auth for local demos. For production projects,
replace it with a real `AuthTicketPort` / single-use WebSocket ticket flow.
