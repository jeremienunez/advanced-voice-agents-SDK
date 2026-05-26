# TODO - Agnostic Voice Agent SDK

Future commit title: `refactor: carve agnostic voice agent sdk from copied runtime`

## Sprint 1 - Clean Core Base

- [x] Choisir `src` comme source canonique.
- [x] Supprimer le doublon physique `server/src/**`.
- [x] Supprimer les dossiers applicatifs copies: `server`, `client`, `shared`,
  `db-schema`.
- [x] Nettoyer `src` pour garder uniquement `sdk`, `server`, `client/browser`
  et l'entree package.
- [x] Garder le runtime serveur utile:
  - transports OpenAI/Gemini/Grok/cascaded/Twilio
  - sessions voice/audio/interruption/state
  - handlers media/browser/barge-in
  - types provider/session/event/error
  - utils audio/RNNoise/AEC/AGC/logger
- [x] Separer le client browser voice sans UI produit.
- [x] Mettre le metier en exemple hors core:
  - `examples/packs/wine-investment`
- [x] Refaire `package.json`:
  - `main` et `types` vers `dist`
  - exports publics SDK/server/client
  - allowlist `files`
  - suppression des deps publiques applicatives
- [x] Ajouter `tsconfig.build.json`.
- [x] Passer en ESM NodeNext avec imports `.js` resolvables.
- [x] Ajouter l'audit de frontiere `scripts/audit-core-imports.mjs`.
- [x] Ajouter un `StoreBuilder` pour generer des repositories safe:
  - scope tenant/user
  - operations autorisees
  - champs filtrables/triables/ecrivable
  - injection de scope avant adapter DB
- [x] Valider:
  - `pnpm typecheck:sdk`
  - `pnpm typecheck:examples`
  - `pnpm typecheck:starters`
  - `pnpm audit:sdk-boundary`
  - `pnpm audit:imports`
  - `pnpm build`
  - `pnpm pack --dry-run --json`
  - imports Node des exports publics

## Sprint 2 - Runtime Ports

- [ ] `TenantResolverPort`
  - input: `{ channel, provider, from, to, callId, accountId }`
  - output: `{ tenantId, providerId, mediaBridgeId, planId, userId?, limits,
    promptVariables, metadata }`
- [ ] `SecretResolverPort`
  - resoudre `SecretRef` sans `process.env` hardcode dans le runtime.
- [ ] `ProviderFactoryPort`
  - mapper OpenAI realtime, Gemini live, Grok realtime et cascaded.
- [ ] `MediaBridgeFactoryPort`
  - abstraire start/stop/sendAudio/clearOutput/onAudioToLlm.
- [ ] `ToolRegistryAdapterPort`
  - convertir les `ToolDefinition` SDK vers le runtime tools.
- [ ] `DbAdapterRegistry`
  - garder les adapters hors definition serialisable.
- [ ] Brancher les `StoreDefinition` sur `DbAdapterRegistry`.
- [ ] Ajouter adapters store SQL/document/vector:
  - mapping fields/indexes
  - pagination/cursor
  - soft delete
  - migrations optionnelles
- [ ] `PromptCompilerPort`
  - compiler tenant/channel/plan/tools/promptSections/variables vers
    instructions runtime.
- [ ] `AuthTicketPort`
  - browser voice ticket et auth VOIP tenant.
- [ ] `EventSink` / `LoggerPort`
  - console/noop/custom sinks.
- [ ] `MemoryStore`
  - in-memory par defaut, Redis optionnel.

## Sprint 3 - Adapters And Demo

- [ ] Brancher `src/server/adapters/fastify` sur le runtime nettoye.
- [x] Ajouter un starter VOIP RTC Bun + React/Vite reutilisable.
- [ ] Ajouter auth ticket reusable pour remplacer le query auth local du starter.
- [ ] Transformer `examples/packs/wine-investment` en pack executable.
- [ ] Ajouter tests contractuels pour:
  - compilation SDK
  - provider factory
  - media bridge
  - browser protocol
  - package exports

## Sprint 4 - AGENTRX Diagnostics

Future commit title: `feat: add agentrx trajectory diagnostics to builder harness`

- [ ] Ajouter une couche SDK `src/sdk/diagnostics/**`:
  - taxonomy AGENTRX cross-domain
  - trajectory IR
  - contraintes globales et dynamiques
  - validation log auditable
  - selection du premier echec critique
- [ ] Instrumenter le builder starter:
  - identity
  - prompt plan
  - clarifications
  - autonomous research
  - knowledge plan
  - database provision
  - knowledge compile
  - agent compile
- [ ] Forcer la separation provider:
  - DeepSeek pour builder/research/diagnostics
  - Gemini seulement pour runtime vocal RTC
- [ ] Permettre la recherche autonome sans fichier upload:
  - plan de mise en oeuvre formel
  - checkpoints
  - budget
  - documents `web_research`
- [ ] Ajouter un panneau UI diagnostic:
  - trajectory
  - constraints
  - violations
  - critical failure step
- [ ] Ajouter les artifacts harness:
  - `trajectory-ir.json`
  - `validation-log.json`
  - `agentrx-report.json`
  - `agentrx-report.md`
- [ ] Ajouter tests/audits:
  - typecheck SDK/starter
  - harness route-wines
  - AGENTRX report present et non vide
