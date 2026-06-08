# Server Runtime Manifest

La logique serveur VOIP/RTC canonique vit maintenant sous `src/server`.
L'ancien doublon `server/src/**` a ete supprime.

## Kept In Core

- `src/server/agent/transports`
  - OpenAI realtime/audio/chat
  - Gemini realtime
  - Grok realtime
  - cascaded STT/LLM/TTS/VAD
  - Twilio voice/SMS transports
- `src/server/agent/handlers`
  - barge-in
  - browser media
- `src/server/agent/sessions`
  - voice session
  - audio pipeline
  - interrupt controller
  - state machine
  - context helpers
- `src/server/agent/types`
  - transport/session/event/error/provider types
- `src/server/agent/utils`
  - audio, RNNoise, AEC, AGC, ids, logger, SMS helpers
- `src/server/providers`
  - public provider export facade
- `src/server/media`
  - public media export facade
- `src/server/adapters/fastify`
  - placeholder adapter contract for the next sprint

## Not Kept In Core

Product routes, controllers, repositories, jobs, emails, schemas, prompts,
tools and domain services are intentionally outside `src`. The next sprint
will add ports/adapters for tenant resolution, secrets, provider factories,
media bridge factories, tools, prompts and database adapters.
