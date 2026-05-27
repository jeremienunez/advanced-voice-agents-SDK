# TODO - Agnostic Voice Agent SDK

Future commit title: `refactor: carve agnostic voice agent sdk from copied runtime`

## Current Verification - 2026-05-27

- [x] `pnpm run typecheck`
- [x] `pnpm --filter @voiceagentsdk/starter-voip-rtc typecheck`
- [x] `pnpm run audit:sdk-boundary`
- [x] `pnpm run audit:imports`
- [x] `pnpm run audit:tool-contracts`
  - result: `tool-contracts: OK (1 compiled drafts checked, 11 legacy skipped)`
- [x] `pnpm run audit:loc`
- [x] `pnpm run pack:dry-run`
- [x] `pnpm audit --json`
  - result: 0 info, 0 low, 0 moderate, 0 high, 0 critical
- [x] `pnpm audit --dev --json`
  - result: 0 info, 0 low, 0 moderate, 0 high, 0 critical
- [x] `curl http://127.0.0.1:8787/config`
  - runtime config endpoint is reachable.
- [x] `curl http://127.0.0.1:8787/builder/config`
  - builder config endpoint is reachable.
- [x] Reconcile historical TODO checkboxes against source files.
- [ ] Run `pnpm install` before the next runtime demo if local
  `node_modules` predates the current lockfile.

## Immediate Risk Backlog - 2026-05-27

- [ ] Protect the starter control plane:
  - require an application-provided session/ticket verifier on `/builder/*`;
  - require an application-provided session/ticket verifier on `/voice/ws`;
  - derive tenant/user from verified identity instead of query params;
  - enforce HTTP and WebSocket origin allowlists;
  - bind dev surfaces to localhost by default unless explicitly configured.
- [ ] Harden database provisioning:
  - stop trusting request-supplied drafts for privileged workflows;
  - load drafts server-side by authenticated owner;
  - replace broad SQL allowlists with typed migration/templates;
  - ban `AS SELECT`, arbitrary function calls, arbitrary extensions and
    expression indexes from generated/user-influenced SQL;
  - enforce least-privileged Postgres roles and `statement_timeout`.
- [ ] Harden document ingestion:
  - request and file size limits;
  - content-length enforcement;
  - MIME/extension allowlist;
  - spreadsheet sheet/row/cell/text caps;
  - parser timeouts and per-IP quotas.
- [ ] Harden prompt/tool orchestration:
  - append immutable server-owned safety and tool policy after generated
    prompts;
  - quote builder input and document content as data;
  - lint compiled prompts for required invariants;
  - enforce tool authorization server-side, independent of model text.
- [ ] Harden logs and debug artifacts:
  - remove prompt/message previews from normal logs;
  - add recursive redaction for nested secrets/content;
  - gate audio dumps to local-only debug with restrictive permissions and
    cleanup.
- [ ] Rotate local API keys if the ignored `.env` contains live production
  credentials.

## Architecture Backlog - Tool Contracts

- [x] Add starter tool contracts:
  - `ToolBuildPlan`;
  - `ToolBuildContract`;
  - validation report;
  - compiled tool contract status in the builder UI.
- [x] Add deterministic starter flow:
  - registry to tool contracts;
  - contract validation;
  - selected tool instructions;
  - runtime action handlers.
- [x] Add `audit:tool-contracts`.
- [ ] Split the public tool API cleanly:
  - keep executable runtime tools with a required `execute` handler;
  - keep serializable build/manifests separate from executable
    `ToolDefinition`;
  - avoid making downstream consumers handle half-executable tools.
- [ ] Promote starter handler maps into `ToolRegistryAdapterPort` instead of
  hardcoded local `handlerRef` sets.
- [ ] Decide the `tool-plan` prompt path:
  - wire a real planner method that uses the templates; or
  - delete the templates until the flow is no longer deterministic.
- [ ] Add source audits for:
  - no `unknown.*` handler fallback in selected runtime tools;
  - no selected tool without an executable runtime binding;
  - no compiled runtime artifact that claims executable tools but only has
    serializable manifests.
- [ ] Align README starter URL docs with current defaults:
  - `.env.example` and client defaults use `127.0.0.1:8787`;
  - Vite defaults to localhost dev client unless configured;
  - README still references `http://localhost:5177`.

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
  - premiere version starter en place: registry -> contracts -> validation ->
    runtime action tools.
  - reste a promouvoir en vrai port SDK agnostique.
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
  - verifier des tickets/session browser voice.
  - retourner `tenantId`, `userId`, `planId`, scopes et metadata.
  - ne pas embarquer login, users, RBAC ou fournisseur JWT dans le SDK.
- [ ] `EventSink` / `LoggerPort`
  - console/noop/custom sinks.
- [ ] `MemoryStore`
  - in-memory par defaut, Redis optionnel.

## Sprint 3 - Adapters And Demo

- [ ] Brancher `src/server/adapters/fastify` sur le runtime nettoye.
- [x] Ajouter un starter VOIP RTC Bun + React/Vite reutilisable.
- [ ] Ajouter un `AuthTicketPort` reusable pour remplacer le query auth local du starter.
  - doit couvrir `/builder/*` et `/voice/ws`.
  - doit remplacer `tenantId` / `userId` query params par une identite verifiee.
  - l'implementation concrete reste fournie par l'application.
- [ ] Transformer `examples/packs/wine-investment` en pack executable.
- [ ] Ajouter tests contractuels pour:
  - compilation SDK
  - provider factory
  - media bridge
  - browser protocol
  - package exports

## Sprint 4 - AGENTRX Diagnostics

Future commit title: `feat: add agentrx trajectory diagnostics to builder harness`

- [x] Ajouter une couche SDK `src/sdk/diagnostics/**`:
  - taxonomy AGENTRX cross-domain
  - trajectory IR
  - contraintes globales et dynamiques
  - validation log auditable
  - selection du premier echec critique
- [x] Instrumenter le builder starter:
  - identity
  - prompt plan
  - clarifications
  - autonomous research
  - knowledge plan
  - database provision
  - knowledge compile
  - agent compile
- [x] Forcer la separation provider par role:
  - builder/research/diagnostics passent par un resolver de modeles.
  - Gemini peut etre autorise comme planner pour raisons business.
  - Gemini reste le provider privilegie pour runtime vocal RTC.
  - aucun workflow ne doit hardcoder un provider unique.
- [x] Permettre la recherche autonome sans fichier upload:
  - plan de mise en oeuvre formel
  - checkpoints
  - budget
  - documents `web_research`
- [x] Ajouter un panneau UI diagnostic:
  - trajectory
  - constraints
  - violations
  - critical failure step
- [x] Ajouter les artifacts harness:
  - `trajectory-ir.json`
  - `validation-log.json`
  - `agentrx-report.json`
  - `agentrx-report.md`
- [ ] Ajouter tests/audits:
  - typecheck SDK/starter
  - harness route-wines
  - AGENTRX report present et non vide
  - typecheck is verified; a dedicated non-empty AGENTRX artifact assertion is
    still missing.
