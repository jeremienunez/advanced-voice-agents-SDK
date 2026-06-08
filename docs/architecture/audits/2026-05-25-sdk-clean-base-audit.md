# SDK Clean Base Audit

Date: 2026-05-25
Future commit title: `refactor: carve agnostic voice agent sdk from copied runtime`

## Goal

Identifier ce qui doit etre nettoye, porte ou conserve pour transformer la copie
brute en SDK agent vocal agnostique.

## Working Rule

- Core SDK: moteur generique VOIP/RTC/provider/media/session/tool runtime.
- Domain pack: prompts/tools/DB/services metier.
- Adapter: Fastify/Twilio/browser/Redis integrations optionnelles.
- Demo/example: UI et pack metier de reference, jamais requis par le core.

## Audit Tracks

### Server Runtime

Question: quels fichiers serveur sont core, lesquels doivent sortir?

Initial classification:

- KEEP core:
  - `server/src/agent/transports/**`
  - `server/src/agent/handlers/**`
  - `server/src/agent/sessions/audio-pipeline.ts`
  - `server/src/agent/sessions/interrupt-controller.ts`
  - `server/src/agent/sessions/session-manager.ts`
  - `server/src/agent/sessions/state-machine.ts`
  - `server/src/agent/sessions/voice-session.ts`
  - `server/src/agent/sessions/openai-event-router.ts`
- KEEP as adapters:
  - `server/src/services/voip*.ts`
  - `server/src/controllers/voip.controller.ts`
  - `server/src/routes/voip.routes.ts`
  - `server/src/services/browser-voice.service.ts`
  - `server/src/routes/browser-voice.routes.ts`
- MOVE_TO_PACK:
  - `server/src/agent/tools/definitions/search-wines.ts`
  - `server/src/agent/tools/definitions/search-cave.ts`
  - `server/src/agent/tools/definitions/get-pairing.ts`
  - `server/src/agent/tools/definitions/investment-*.ts`
  - `server/src/agent/prompts/*` with wine/investment/sommelier content
  - `server/src/agent/db-client/**`
  - `server/src/agent/cortices/**`
- DELETE_AFTER_PORT:
  - app-only controllers/routes/services once their ports exist
  - repositories/entities/jobs/emails/stripe/admin product logic
- NEEDS_PORT:
  - auth ticket/session lookup
  - tenant config
  - provider secrets
  - DB access
  - logging/events
  - memory store

### SDK Runtime

Question: que manque-t-il entre `src/sdk` et le runtime serveur?

Initial gaps:

- `createVoiceAgentRuntime(definition, adapters)`
- `SecretResolver`
- `TenantResolver`
- `ProviderFactory`
- `MediaBridgeFactory`
- `PromptCompiler`
- `ToolRegistryAdapter`
- `DomainDataAdapter`
- `AuthTicketPort`
- `MemoryStore`
- `EventSink`

### Package / Build

Question: que faut-il nettoyer pour une base SDK saine?

Initial gaps:

- `package.json#main/types` pointent encore sur `src/agent/index.ts`.
- Dependencies publiques contiennent encore `@gaspard/*`.
- Exports melangent surface cible et copie brute.
- `typecheck` global compile une copie produit, pas le SDK cible.
- Besoin de scripts separes:
  - `typecheck:sdk`
  - `typecheck:server-runtime`
  - `audit:boundary`
  - `audit:imports`

### Client Browser Voice

Question: que garde-t-on cote client?

Initial classification:

- KEEP as client SDK:
  - `client/modules/voice/hooks/useVoiceSession.ts`
  - `client/modules/voice/services/voice-ws.ts`
  - `client/modules/voice/services/audio-worklet.ts`
  - `client/modules/voice/domain/types.ts`
- MOVE_TO_DEMO:
  - `client/modules/voice/ui/VoiceButton.tsx`
  - `client/modules/voice/ui/VoicePanel.tsx`
  - `client/modules/voice/ui/VoiceWaveform.tsx`
- NEEDS_PORT:
  - auth ticket provider
  - endpoint resolver
  - provider selection config
  - transcript/event callbacks

## Agent Findings

### Server Copy Audit

Findings from parallel audit:

- `server/src` and `src` currently share 545 byte-identical files.
- There is no `server/src` file without a `src` equivalent.
- The only additions under `src` are:
  - `src/sdk/**`
  - `src/agent/cortices/storage/**`
- Conclusion: `server/src` is useful as a readable view today, but it should
  not remain a second physical source of truth.

Recommended canonical structure:

- Keep `src/sdk/**` as the agnostic public SDK surface.
- Keep one runtime source tree only.
- Replace physical duplication with exports/docs/adapters once the runtime is
  reduced.

KEEP core:

- `agent/transports/{gemini-realtime,grok-realtime,openai-audio,openai-chat,openai-realtime,twilio-sms,twilio-voice,index,cascaded/**}`
- `agent/handlers/{barge-in.handler,browser-media.handler,index}`
- `agent/sessions/{audio-pipeline,interrupt-controller,openai-event-router,state-machine,voice-wait-tool}`
- `agent/types/{chat,error,event,gemini,grok,openai,transport}.types.ts`
- `agent/utils/{aec,agc,audio,id,logger,message-content,rnnoise,sms,voice-benchmark,index}.ts`
- `types/{sms-webhook,user-lookup-port,voice-ticket-store,voip-media,voip-webhook}.types.ts`
- `transformers/{sms.dto,voip.dto}.ts`
- `utils/{phone-number,ssrf-guard,twiml,voip-secret-crypto,ws-ticket,llm-json-parser}.ts`
- `agent/orchestrators/adversarial-guard.ts`

NEEDS_PORT:

- `agent/index.ts`
- `agent/types/{brand,index,memory,orchestration,service,session,tool,twilio}.types.ts`
- `agent/transports/llm-chat.ts`
- `agent/handlers/media-stream.handler.ts`
- `agent/sessions/{chat-session,context,session-manager,sms-chat-loop,sms-parser,sms-session,tool-orchestrator,voice-session,voice-welcome,web-chat-loop}.ts`
- `agent/memory/**`
- `agent/services/{context-compressor,dialogue-state,emotion-detector,french-speech,index,intent-detector,intonation-engine,preference-learner}.ts`
- `agent/tools/{executor,index,registry,tier-filter}.ts`
- `agent/orchestrators/{chat,sms,tool-call-guard,voice}.orchestrator.ts`
- `services/{audio-monitor,browser-voice,call-tracker,sms,voip-log,voip-media-stream.guard,voip-tenant-config,voip}.ts`
- `controllers/{browser-voice,sms,voip,admin-voip}.controller.ts`
- `routes/{browser-voice,sms,voip,voice-debug-path,admin-voip,schemas,zod-route}.ts`
- `config/{voip,voip-realtime,voip-runtime,container.voip,redis-url-policy}.ts`
- `middleware/voip.middleware.ts`
- `plugins/websocket.ts`
- `types/{agent-tool-services,voip-tenant-config}.types.ts`
- `repositories/voip-tenant-config.repository.ts`

MOVE_TO_PACK:

- `agent/prompts/**`
- `agent/tools/definitions/**`
- `agent/db-client/**`
- `agent/cortices/**`
- `agent/sessions/{investment-session,manager-session}.ts`
- `agent/services/wine-assistant.ts`
- `agent/orchestrators/{appellation-scan,executor,investment,manager,observer,router*,synthesizer,wine-enrichment}.ts`
- domain services/repositories/entities/types/transformers/utils for wine, cave,
  investment, pairing, watchlist, price, rss, thalamus, grape, dashboard,
  export, viz, editorial copilot.

DELETE_AFTER_PORT:

- `server/src/**` as physical duplicate once a canonical runtime tree is chosen.
- app bootstrap/config/routes/controllers/middleware/jobs/scripts/emails/adapters
  not required by VOIP/browser adapters.
- admin/auth/user/stripe/sso/article/email/messaging/ops product services.

### Browser Voice Audit

Findings from parallel audit:

- Browser voice has real SDK value:
  - `client/modules/voice/services/audio-worklet.ts`
  - `client/modules/voice/services/voice-ws.ts`
  - `client/modules/voice/hooks/useVoiceSession.ts`
  - `shared/types/voice-ws.types.ts`
- UI components are demo/app:
  - `VoiceButton.tsx`
  - `VoicePanel.tsx`
  - `VoiceWaveform.tsx`
- Product integration is not browser SDK:
  - `client/modules/investment/hooks/useInvestmentVoice.ts`

Important risks:

- Browser sends PCM16 24 kHz but `VoiceSession` configures provider input as
  `g711_ulaw`.
- Browser WS reconnect reuses a URL whose ticket is single-use via server
  `getdel`.
- Client waits for `state.change`, `transcript`, `tool.call`, `tool.result`,
  but `BrowserVoiceService` does not yet emit the full contract.
- `BrowserVoiceService` is gated by `isVoipEnabled()`, tying browser voice to
  Twilio/VOIP availability even when LLM-only browser voice should work.

### SDK Runtime Ports Audit

Findings from parallel audit:

- `src/sdk/**` is clean and compiles alone.
- It is currently declarative only; it does not yet drive the VOIP runtime.
- Runtime wiring is still manual/app-specific:
  - tenant DB/env in `src/services/voip.service.ts`
  - provider factory private in `src/agent/sessions/voice-session.ts`
  - Twilio media bridge inline in `src/services/voip.service.ts`
  - Gaspard tools fixed in `src/agent/tools/index.ts`
  - wine DB fixed in `src/agent/db-client/index.ts`
  - Gaspard prompt fixed in `src/agent/prompts/voice.prompt.ts`

Required ports:

- `TenantResolverPort`
  - resolves inbound `{ channel, provider, from, to, callId, accountId }`
  - outputs tenant/provider/media/plan/user/limits/prompt variables
  - target adapter: `src/adapters/sdk-voip-tenant-resolver.adapter.ts`
- `SecretResolverPort`
  - resolves `SecretRef`
  - target adapter: `src/adapters/sdk-secret-resolver.adapter.ts`
  - must replace global Twilio auth token validation too
- `ProviderFactoryPort`
  - maps `ProviderDefinition` to `IRealtimeProvider`
  - target: `src/agent/transports/realtime-provider.factory.ts`
  - replaces private factory in `voice-session.ts`
- `MediaBridgeFactoryPort`
  - abstracts Twilio/browser/SIP/custom media bridge
  - target: `src/services/voip-media-bridge.factory.ts`
  - replaces Twilio inline handling in `voip.service.ts`
- `ToolRegistryAdapterPort`
  - maps SDK `ToolDefinition[]` to current `ToolRegistry`
  - target: `src/agent/tools/sdk-tool-registry.adapter.ts`
  - must pass tenant/plan/services/database into tool execution context
- `DbAdapterRegistry`
  - `DomainDataAdapter` exists, but adapters are not preserved in runtime
  - possible API: `compileVoiceAgentSdk(definition, { databases })`
- `PromptCompilerPort`
  - compiles tenant/channel/plan/tool/prompt sections into model instructions
  - target: `src/agent/prompts/sdk-prompt-compiler.adapter.ts`
  - replaces `VoiceSession.buildInstructions()`

Composition root needed:

- `src/sdk/voip-runtime.ts` or `src/config/sdk-voip-runtime.ts`
- Input: `CompiledVoiceAgentSdk + ports`
- Output: runtime objects injected into `VoiceOrchestrator` and `VoipService`

### Package / Build Audit

Findings from parallel audit:

- `package.json#main` and `types` point to `src/agent/index.ts`, not the SDK
  surface.
- Public exports still expose raw agent/services/routes and product services.
- `tsconfig.json` includes `src`, `client`, `shared`, `db-schema`, but not
  `server/src`, while `server/src` is exported.
- `pnpm-workspace.yaml` keeps `shared` and `db-schema` as workspace packages,
  so core remains attached to `@gaspard/*`.
- `pnpm pack --dry-run --json` currently includes 1318 files:
  - `src`: 565
  - `server`: 546
  - `db-schema`: 89
  - `shared`: 89
  - `client`: 17
- `/home/jerem/voiceagentsdk` is not currently a Git repository.

Checks observed:

- Passing:
  - `pnpm -s audit:sdk-boundary`
  - `pnpm -s typecheck:sdk`
  - `pnpm --filter @gaspard/shared typecheck`
  - `pnpm --filter @gaspard/db-schema exec tsc --noEmit`
  - isolated example pack typecheck
  - isolated exports typecheck for `src/agent`, `src/transports`,
    `src/sessions`, `src/tools`, `src/types`
- Failing:
  - global `pnpm -s typecheck`
  - targeted server exports typecheck due Fastify websocket typings

Package cleanup required:

- Point `.` to agnostic SDK.
- Emit `dist` and declaration files.
- Add `files` allowlist before packing.
- Remove `@gaspard/*` from public dependencies.
- Add `pack:dry-run`.
- Align lockfile/dependencies before treating global typecheck as quality gate.
