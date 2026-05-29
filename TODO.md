# TODO - Agnostic Voice Agent SDK
# TODO exhaustif — Architecture, SOLID, Sécurité et Readiness Prod

Repo audité : `jeremienunez/advanced-voice-agents-SDK`  
Date de génération : 2026-05-28  
Périmètre : SDK core, runtime voice, browser client, starter Bun/React, builder, tools, auth, learning, infra, graph/memory stores, scripts d’audit et flux critiques.

## État de couverture de l’audit

| Type de couverture | Estimation |
|---|---:|
| Chemins critiques architecture/sécurité | ~94 % |
| Audit fichier-par-fichier exhaustif | ~63 % |
| Readiness prod actuelle estimée | 4.9 / 10 |
| Readiness prod cible après P0 + P1 majeurs | 6.5–7.2 / 10 |

Le repo a une bonne architecture de base : clean core, ports/adapters, provider abstraction, tool manifests, server-owned prompt policy, validation SQL stricte, ingestion documentaire avec limites, redaction logs, learning stores, graph stores et infra plan.  
Les freins à la production sont principalement liés à l’enforcement runtime, au multi-tenant, à l’ownership, à la persistence locale et à l’auto-évolution.

---

## Légende de priorité

- **P0 — Bloquant production** : risque sécurité, multi-tenant, intégrité agent, ou exécution non maîtrisée.
- **P1 — À corriger avant prod externe** : robustesse, observabilité, exploitation, scalabilité ou durcissement important.
- **P2 — Qualité architecture / maintenance** : amélioration SOLID, DX, dette technique.
- **P3 — Polish / documentation / ergonomie** : amélioration non bloquante mais utile.

Chaque item contient :
- **Problème**
- **Impact**
- **Fichiers concernés**
- **Actions recommandées**
- **Critères d’acceptation**
- **Tests à ajouter**

---

# P0 — Bloquants production

## P0-001 — Rendre l’ownership obligatoire sur toutes les routes builder

### Problème

Certaines routes et workflows rechargent ou modifient des drafts par `draftId` sans vérifier que le draft appartient à l’identité authentifiée.

Les chemins déjà protégés partiellement existent, par exemple `resolveOwnedDraft`, mais ils ne sont pas utilisés partout.

### Impact

Un utilisateur authentifié qui connaît ou devine un `draftId` peut potentiellement :
- lire un draft qui ne lui appartient pas ;
- compiler un agent d’un autre tenant ;
- activer un agent d’un autre tenant ;
- rollback un agent d’un autre tenant ;
- approuver une évolution infra d’un autre tenant.

### Fichiers concernés

- `starters/voip-rtc/server/builder/state/draft-ownership.ts`
- `starters/voip-rtc/server/builder/workflows.ts`
- `starters/voip-rtc/server/builder/workflow-agent-compile.ts`
- `starters/voip-rtc/server/builder/router.ts`
- `starters/voip-rtc/server/http/routes.ts`
- `starters/voip-rtc/server/learning/service.ts`
- `starters/voip-rtc/server/learning/evolution.ts`
- `starters/voip-rtc/src/api/builder/*.ts`

### Actions recommandées

1. Créer une API unique :
   - `resolveOwnedDraftFromBody(body, context)`
   - `resolveOwnedDraftFromId(draftId, context)`
   - `requireOwnedDraft(draftId, identity)`

2. Interdire l’usage route-facing de :
   - `requireDraft(draftId)`
   - `resolveDraft(body)`
   - `getDraft(draftId)`

   sauf dans des modules explicitement internes ou dans des tests.

3. Modifier tous les workflows :
   - `/builder/drafts/:id`
   - `/builder/session`
   - `/builder/prompt-clarifications`
   - `/builder/run-research`
   - `/builder/knowledge-plan`
   - `/builder/database-plan`
   - `/builder/apply-database`
   - `/builder/compile-knowledge`
   - `/builder/compile-agent`
   - `/builder/agents/rollback`
   - `/builder/agents/approve-infra-evolution`

4. Faire passer `BuilderRequestContext.identity` jusqu’au learning service pour rollback / approve infra.

5. Supprimer du client les payloads `draft` envoyés en double quand le serveur doit recharger l’état canonique par `draftId`.

### Critères d’acceptation

- Aucun endpoint sensible ne peut lire/modifier un draft cross-owner.
- Les erreurs cross-owner renvoient `403` ou `401`, pas `400`.
- Les workflows privilégiés utilisent uniquement le draft serveur.
- Les request-supplied drafts sont ignorés pour tout workflow sensible.
- Un grep de type `requireDraft(` dans les routes/workflows doit être justifié ou bloqué par audit.

### Tests à ajouter

- `test-builder-ownership-all-routes-bdd.ts`
  - cross-owner `GET /builder/drafts/:id` rejeté ;
  - cross-owner `/builder/session` rejeté ;
  - cross-owner `/builder/compile-agent` rejeté ;
  - cross-owner `/builder/prompt-clarifications` rejeté ;
  - cross-owner `/builder/knowledge-plan` rejeté ;
  - cross-owner `/builder/run-research` rejeté ;
  - cross-owner `/builder/agents/rollback` rejeté ;
  - cross-owner `/builder/agents/approve-infra-evolution` rejeté.

---

## P0-002 — Supprimer l’`activeDraftId` global non tenant-scoped

### Problème

Le starter maintient un `activeDraftId` global dans `builderSession`. Il n’est pas scoped par tenant, user ou plan.

### Impact

Dans un environnement multi-tenant, un agent actif défini par un utilisateur peut devenir le fallback runtime d’un autre utilisateur si aucun `agentId` explicite n’est fourni. C’est un risque cross-tenant majeur.

### Fichiers concernés

- `starters/voip-rtc/server/builder/state/session-store.ts`
- `starters/voip-rtc/server/builder/service.ts`
- `starters/voip-rtc/server/voice/toolset.ts`
- `starters/voip-rtc/server/voice/session-factory.ts`
- `starters/voip-rtc/server/learning/evolution.ts`

### Actions recommandées

1. Remplacer `activeDraftId` global par :
   - `activeDraftIdByTenant`
   - ou `activeDraftIdByTenantUser`
   - ou mieux : aucun fallback actif en prod.

2. Exiger un `agentId` explicite pour `/voice/ws` en mode production.

3. Vérifier que l’agent demandé appartient à l’identité authentifiée.

4. Interdire `builderService.getCompiledDraft(undefined)` en prod.

5. Ajouter une option dev-only :
   - `ALLOW_IMPLICIT_ACTIVE_DRAFT=true`
   - uniquement si host loopback.

### Critères d’acceptation

- Une session voice sans `agentId` échoue en prod.
- Une session voice avec un `agentId` cross-owner échoue.
- `activeDraftId` n’existe plus comme état global unique.
- Les tests prouvent que tenant B ne peut pas utiliser le draft actif de tenant A.

### Tests à ajouter

- `test-active-draft-scope-bdd.ts`
- `test-voice-agent-ownership-bdd.ts`

---

## P0-003 — Empêcher le learning d’activer automatiquement un draft global

### Problème

Le learning post-session appelle `setActiveDraft(nextDraft.id)` après évolution, approbation infra et rollback.

### Impact

Une session learning peut modifier puis activer globalement un agent, affectant potentiellement d’autres utilisateurs ou sessions.

### Fichiers concernés

- `starters/voip-rtc/server/learning/evolution.ts`
- `starters/voip-rtc/server/builder/state/session-store.ts`

### Actions recommandées

1. Supprimer `setActiveDraft` de :
   - `validateAndApply`
   - `approveInfraEvolution`
   - `rollback`

2. Remplacer par une action explicite :
   - `activateAgentVersion(draftId, version, identity)`

3. En prod, stocker les évolutions en état :
   - `pending`
   - `approved`
   - `applied`
   - `rolled_back`

4. Ne jamais auto-activer une évolution issue d’une session utilisateur sans validation.

### Critères d’acceptation

- Le learning peut créer une version candidate sans modifier l’agent actif.
- L’activation nécessite une route explicite protégée par ownership.
- Le rollback ne modifie que l’agent du tenant/user autorisé.

### Tests à ajouter

- `test-learning-does-not-activate-global-draft-bdd.ts`
- `test-agent-version-activation-ownership-bdd.ts`

---

## P0-004 — Préserver la server-owned prompt policy après learning

### Problème

La compilation agent ajoute une policy serveur finale au prompt. Mais le learning ajoute ensuite un bloc `## Learned Session Memory` à la fin du prompt, après la policy serveur.

### Impact

Le prompt post-learning ne se termine plus par la policy serveur. L’invariant de sécurité “server policy final suffix” est cassé après évolution.

### Fichiers concernés

- `starters/voip-rtc/server/builder/domain/prompt-policy.ts`
- `starters/voip-rtc/server/builder/domain/prompt-invariants.ts`
- `starters/voip-rtc/server/learning/evolution-prompt.ts`
- `starters/voip-rtc/server/learning/evolution.ts`
- `starters/voip-rtc/scripts/test-prompt-policy-bdd.ts`

### Actions recommandées

1. Modifier `buildPromptVersion` pour insérer le bloc mémoire avant la server policy.

2. Créer une fonction :
   - `insertLearnedMemoryBeforeServerPolicy(prompt, memoryBlock)`

3. Après toute évolution prompt, rappeler :
   - `assertServerOwnedPromptPolicy(prompt)`
   - `assertCompiledPromptInvariants(prompt, draft, selectedTools)`

4. Empêcher `saveDraft` si les invariants prompt échouent.

### Critères d’acceptation

- Après compile, le prompt finit par `END SERVER-OWNED SAFETY AND TOOL POLICY`.
- Après learning, le prompt finit toujours par `END SERVER-OWNED SAFETY AND TOOL POLICY`.
- Après rollback, le prompt finit toujours par la policy serveur.
- Aucun bloc mémoire ne peut être placé après la policy serveur.

### Tests à ajouter

- `test-learning-preserves-server-policy-bdd.ts`
- `test-rollback-preserves-server-policy-bdd.ts`

---

## P0-005 — Remplacer la confirmation tool via `args.confirmed`

### Problème

Les actions sensibles utilisent `args.confirmed === true` comme preuve de confirmation utilisateur. Ces args viennent du modèle.

### Impact

Le modèle peut produire lui-même `{ confirmed: true }`. Une action write/handoff/external peut donc être exécutée sans vraie confirmation utilisateur serveur.

### Fichiers concernés

- `starters/voip-rtc/server/runtime/tools/action-tool-registry.ts`
- `starters/voip-rtc/server/runtime/tools/action-tools.ts`
- `src/server/agent/sessions/voice-session.ts`
- `src/server/agent/types/session.types.ts`
- `src/sdk/types/core.ts`
- `src/sdk/types/tooling.ts`

### Actions recommandées

1. Créer un `PendingActionStore`.
2. Le premier tool call sensible doit créer :
   - `pendingActionId`
   - `toolName`
   - `args`
   - `sessionId`
   - `tenantId`
   - `userId`
   - `expiresAt`
3. Le runtime doit retourner :
   - `status: "confirmation_required"`
   - `pendingActionId`
   - message utilisateur
4. Le client doit afficher ou transmettre la demande de confirmation.
5. Une route ou un message hors LLM doit confirmer :
   - `POST /runtime/actions/:pendingActionId/confirm`
   - ou message WebSocket signé.
6. Le handler ne doit jamais lire `args.confirmed`.

### Critères d’acceptation

- Aucun handler sensible n’exécute une action sur `args.confirmed`.
- Les actions write/handoff/external passent par pending action.
- Les pending actions expirent.
- Les pending actions sont tenant/user scoped.
- Les confirmations sont auditées.

### Tests à ajouter

- `test-runtime-tool-confirmation-server-owned-bdd.ts`
- `test-model-cannot-self-confirm-tool-bdd.ts`

---

## P0-006 — Ajouter un `ToolExecutionPolicyEngine` runtime

### Problème

La validation tools est forte au compile-time, mais le runtime exécute encore les tools sans policy engine central.

### Impact

Un tool call peut contourner :
- JSON schema strict ;
- confirmation ;
- permissions ;
- max calls per session ;
- timeout ;
- tenant/user authorization ;
- audit ;
- idempotency.

### Fichiers concernés

- `src/server/agent/sessions/voice-session.ts`
- `src/server/agent/types/session.types.ts`
- `starters/voip-rtc/server/runtime/tools/action-tools.ts`
- `starters/voip-rtc/server/runtime/tools/action-tool-registry.ts`
- `src/sdk/types/core.ts`
- `src/sdk/types/tooling.ts`

### Actions recommandées

Créer un module :

`src/server/agent/tools/tool-execution-policy.ts`

Responsabilités :
- trouver le tool manifest ;
- valider les args via JSON schema ;
- vérifier `executionMode`;
- vérifier `sideEffect`;
- vérifier permissions/scopes ;
- vérifier `maxCallsPerSession`;
- appliquer timeout ;
- auditer ;
- redacter le résultat ;
- gérer confirmation pending ;
- générer un résultat typé.

### Critères d’acceptation

- Aucun `tool.execute` direct dans `RealtimeVoiceSession`.
- Tous les tools passent par `ToolExecutionPolicyEngine`.
- Les tests prouvent :
  - schema invalide rejeté ;
  - tool non sélectionné rejeté ;
  - max calls dépassé rejeté ;
  - external action sans confirmation rejetée ;
  - timeout produit un résultat contrôlé.

### Tests à ajouter

- `test-tool-execution-policy-bdd.ts`
- `test-tool-timeout-bdd.ts`
- `test-tool-schema-validation-bdd.ts`

---

## P0-007 — Remplacer le dev-token par une vraie auth prod

### Problème

Le starter utilise un dev token qui peut dériver tenant/user depuis query params. Le client peut aussi mettre token, tenantId et userId dans l’URL WebSocket.

### Impact

Un token partagé ou loggé peut permettre de choisir arbitrairement tenant/user. Les query params sont souvent exposés dans logs/proxies/historiques.

### Fichiers concernés

- `starters/voip-rtc/server/auth/dev-ticket-verifier.ts`
- `starters/voip-rtc/server/auth/ticket-input.ts`
- `starters/voip-rtc/server/http/guards.ts`
- `starters/voip-rtc/src/hooks/useRtcLab.ts`
- `starters/voip-rtc/src/api/constants.ts`
- `starters/voip-rtc/.env.example`

### Actions recommandées

1. Interdire `DevAuthTicketVerifier` en production.
2. Créer `JwtAuthTicketVerifier` ou `SessionAuthTicketVerifier`.
3. Les claims doivent porter :
   - `tenantId`
   - `userId`
   - `planId`
   - `scopes`
   - `exp`
   - `aud`
4. WebSocket :
   - utiliser un ticket court one-time ;
   - éviter token long dans query ;
   - TTL très court si query obligatoire.
5. Ignorer `requestedTenantId`, `requestedUserId`, `requestedPlanId` en prod.

### Critères d’acceptation

- En prod, tenant/user ne viennent jamais de query params.
- Le token long n’apparaît jamais dans l’URL.
- Les scopes sont vérifiés route par route.
- Le dev verifier est bloqué si `NODE_ENV=production`.

### Tests à ajouter

- `test-prod-auth-rejects-dev-token-bdd.ts`
- `test-ws-ticket-identity-bdd.ts`

---

## P0-008 — Remplacer la persistence locale par des repositories durables

### Problème

Les drafts, sessions actives, learning runs et états d’évolution sont stockés en `Map` + fichiers JSON locaux.

### Impact

Ce n’est pas multi-instance, pas transactionnel, pas résilient au crash, pas auditable correctement et pas safe pour prod multi-tenant.

### Fichiers concernés

- `starters/voip-rtc/server/builder/state/draft-store.ts`
- `starters/voip-rtc/server/builder/state/session-store.ts`
- `starters/voip-rtc/server/learning/run-state.ts`
- `starters/voip-rtc/server/learning/evolution-state.ts`

### Actions recommandées

Créer des ports :
- `DraftRepositoryPort`
- `ActiveAgentAssignmentRepositoryPort`
- `LearningRunRepositoryPort`
- `AgentEvolutionRepositoryPort`

Implémentations :
- local file pour dev ;
- Postgres pour prod ;
- Redis seulement pour ephemeral state.

### Critères d’acceptation

- Le mode prod refuse le local file repository.
- Les drafts sont versionnés.
- Les updates utilisent optimistic locking.
- Les états learning sont append-only ou event-sourced.
- Tous les records sont tenant scoped.

### Tests à ajouter

- `test-draft-repository-contract-bdd.ts`
- `test-learning-run-repository-contract-bdd.ts`
- `test-active-agent-assignment-scope-bdd.ts`

---

## P0-009 — Ajouter quotas WebSocket/audio/runtime

### Problème

Les sessions WebSocket/audio acceptent encore trop librement les frames audio et control messages.

### Impact

Risque DoS mémoire/CPU/provider cost :
- audio frames trop grosses ;
- trop de frames/sec ;
- sessions trop longues ;
- control JSON trop gros ;
- tool calls trop nombreux.

### Fichiers concernés

- `src/server/browser/voice-service/service.ts`
- `src/server/browser/voice-service/client-message-parser.ts`
- `src/client/browser/voice-ws.ts`
- `src/server/agent/sessions/voice-session.ts`
- `src/server/agent/utils/audio-buffer.ts`

### Actions recommandées

Ajouter :
- `MAX_AUDIO_FRAME_BYTES`
- `MAX_CONTROL_FRAME_BYTES`
- `MAX_AUDIO_BYTES_PER_SESSION`
- `MAX_AUDIO_FRAMES_PER_SECOND`
- `MAX_CONTROL_MESSAGES_PER_MINUTE`
- `MAX_SESSION_DURATION_MS`
- `MAX_TOOL_CALLS_PER_SESSION`

Sur dépassement :
- close WS avec code explicite ;
- log redacted ;
- audit event ;
- status client compréhensible.

### Critères d’acceptation

- Les grosses frames sont rejetées.
- Le flood audio ferme la session.
- Une session dépassement duration se termine en `timeout`.
- Les coûts provider sont bornés par session.

### Tests à ajouter

- `test-voice-ws-quota-bdd.ts`
- `test-audio-frame-limit-bdd.ts`
- `test-session-duration-timeout-bdd.ts`

---

# P1 — Avant production externe

## P1-001 — Corriger les appels API client qui n’ajoutent pas l’auth

### Problème

Certains GET utilisent `fetch` directement au lieu de `fetchWithNetworkError`, donc ils ne reçoivent pas le header Authorization.

### Fichiers concernés

- `starters/voip-rtc/src/api/builder/promptApi.ts`
- `starters/voip-rtc/src/api/builder/agentApi.ts`
- potentiellement tous les `src/api/**/*.ts`

### Actions

- Remplacer tous les `fetch(...)` directs par `fetchWithNetworkError`.
- Ajouter un audit source : aucun `fetch(` hors `api/http.ts` sauf exception justifiée.

### Tests

- `test-client-api-auth-header-bdd.ts`

---

## P1-002 — Retirer les drafts complets des payloads client

### Problème

Le client envoie souvent `draftId` + `draft`. Le serveur doit recharger le draft canonique.

### Fichiers concernés

- `starters/voip-rtc/src/api/builder/knowledgeApi.ts`
- `starters/voip-rtc/src/api/builder/databaseApi.ts`
- `starters/voip-rtc/src/api/builder/compileApi.ts`

### Actions

- Envoyer seulement `draftId`, `documents`, `answers`, `settings`, etc.
- Côté serveur, refuser ou ignorer explicitement `body.draft`.

### Tests

- `test-request-supplied-draft-ignored-all-workflows-bdd.ts`

---

## P1-003 — Rendre `resolveUser` obligatoire dans le Fastify adapter prod

### Problème

Le Fastify adapter fallback sur query params pour tenant/user.

### Fichiers concernés

- `src/server/adapters/fastify/adapter.ts`
- `scripts/test-fastify-voice-adapter-bdd.ts`

### Actions

- En prod, exiger `resolveUser`.
- Garder fallback query uniquement si `allowQueryIdentityForDev === true`.

### Tests

- `test-fastify-requires-resolve-user-in-prod-bdd.ts`

---

## P1-004 — Supprimer les previews de prompt/instructions dans les logs

### Problème

Grok logge `instructionsPreview`.

### Fichiers concernés

- `src/server/agent/transports/grok-realtime/connection.ts`
- `src/server/agent/utils/log-redaction.ts`

### Actions

- Retirer `instructionsPreview`.
- Logger uniquement longueur + hash.
- Étendre redaction à `instructions`, `instructionsPreview`, `systemPrompt`.

### Tests

- `test-provider-logs-do-not-preview-prompts-bdd.ts`

---

## P1-005 — Redacter les erreurs Pino et console plus strictement

### Problème

`PinoAgentLogger.error` transmet `err: error` brut. Le console logger stringifie parfois des objets d’erreur.

### Fichiers concernés

- `src/server/agent/utils/logger.ts`
- `src/server/agent/utils/log-redaction.ts`

### Actions

- Ne jamais logger `Error` brut.
- Sérialiser :
  - name
  - redacted message
  - stack hash
  - code éventuel
- Redacter avant `JSON.stringify`.

### Tests

- `test-error-log-redaction-bdd.ts`

---

## P1-006 — Encoder et paramétrer les providers realtime

### Problèmes

- OpenAI realtime interpole `model` dans l’URL sans `encodeURIComponent`.
- OpenAI session config hardcode `language: "fr"` et transcription model.
- Gemini met API key en query string.
- Gemini `triggerResponse` est accepté mais pas clairement appliqué.

### Fichiers concernés

- `src/server/agent/transports/openai-realtime/connection.ts`
- `src/server/agent/transports/openai-realtime/session-config.ts`
- `src/server/agent/transports/gemini-realtime/connection.ts`
- `src/server/agent/transports/gemini-realtime/transport.ts`

### Actions

- Encoder `model`.
- Rendre language/transcription/max tokens configurables.
- Documenter Gemini query key risk.
- Tester explicitement le comportement post-tool de Gemini.

### Tests

- `test-provider-url-encoding-bdd.ts`
- `test-provider-config-no-hardcoded-fr-bdd.ts`
- `test-gemini-tool-response-trigger-bdd.ts`

---

## P1-007 — Découper `IRealtimeProvider` en capabilities

### Problème

`IRealtimeProvider` est trop large et force des no-op (`cancelResponse`, `truncateResponse`, etc.) sur certains providers.

### Fichiers concernés

- `src/server/agent/types/transport.types.ts`
- `src/server/agent/transports/*`
- `src/server/agent/sessions/voice-session.ts`

### Actions

Créer :
- `RealtimeAudioProvider`
- `ToolCallingProvider`
- `InterruptibleProvider`
- `ConversationMutationProvider`
- `SystemMessageInjectableProvider`

### Critères

- Aucun provider n’implémente une méthode no-op pour satisfaire un contrat trop large.
- Le runtime détecte les capabilities.

---

## P1-008 — Enforcer `maxDurationMs`

### Problème

`maxDurationMs` existe dans la config mais n’est pas clairement appliqué.

### Fichiers concernés

- `src/server/agent/types/session.types.ts`
- `src/server/agent/sessions/voice-session.ts`
- `starters/voip-rtc/server/voice/session-factory.ts`

### Actions

- Timer serveur hard-stop.
- End reason `timeout`.
- Nettoyage provider/media.
- Statut learning/summary.

### Tests

- `test-session-max-duration-bdd.ts`

---

## P1-009 — Ajouter timeout/retry/circuit breaker pour providers et embeddings

### Problème

Certains appels provider/embedding sont single-shot, sans retry ou timeout robuste.

### Fichiers concernés

- `starters/voip-rtc/server/builder/adapters/voyage-embeddings.ts`
- `src/server/agent/transports/cascaded/llm.ts`
- `src/server/agent/transports/cascaded/stt.ts`
- `src/server/agent/transports/cascaded/tts.ts`

### Actions

- `AbortController`
- retry 429/5xx
- exponential backoff + jitter
- circuit breaker par provider
- budget coût/latence
- fallback lexical si embedding échoue

### Tests

- `test-provider-retry-timeout-bdd.ts`
- `test-embedding-fallback-bdd.ts`

---

## P1-010 — Ajouter timeouts tool dans le mode cascaded

### Problème

`waitForToolResult` peut attendre indéfiniment.

### Fichiers concernés

- `src/server/agent/transports/cascaded/pipeline.ts`

### Actions

- Timeout par tool call.
- Résultat contrôlé `{ error: "tool_timeout" }`.
- Audit event.
- Reprise conversationnelle.

### Tests

- `test-cascaded-tool-timeout-bdd.ts`

---

## P1-011 — Durcir Redis memory store

### Problème

Index global, parse JSON fragile, filtrage scope en mémoire.

### Fichiers concernés

- `starters/voip-rtc/server/learning/memory-store/redis-store.ts`

### Actions

- Index par scope.
- Pagination.
- Parse défensif.
- Suppression des records corrompus.
- Métriques stale/expired/corrupt.

### Tests

- `test-redis-memory-corrupt-record-bdd.ts`
- `test-redis-memory-scope-index-bdd.ts`

---

## P1-012 — Durcir graph stores

### Problème

Graph stores sans isolation forte prod.

### Fichiers concernés

- `starters/voip-rtc/server/learning/graph-store/postgres-store.ts`
- `starters/voip-rtc/server/learning/graph-store/cypher-store.ts`
- `starters/voip-rtc/server/learning/graph-store/cypher-client.ts`

### Actions

Postgres :
- indexes tenant/agent/user/session ;
- RLS ;
- foreign keys edge→node ;
- retention.

Neo4j/Memgraph :
- constraints sur `AgentMemoryNode.id` ;
- index tenant/agent/user ;
- transaction + retry.

### Tests

- `test-graph-store-indexes-bdd.ts`
- `test-graph-store-tenant-isolation-bdd.ts`

---

## P1-013 — Revoir l’auto-évolution learning

### Problème

Le learning modifie le prompt compilé automatiquement à partir d’heuristiques.

### Fichiers concernés

- `starters/voip-rtc/server/learning/workflow.ts`
- `starters/voip-rtc/server/learning/evolution.ts`
- `starters/voip-rtc/server/learning/evolution-prompt.ts`

### Actions

- État `candidate`.
- Score de confiance.
- Approbation humaine ou policy stricte.
- Diff prompt visible.
- Rollback garanti.
- Pas d’activation automatique.

### Tests

- `test-learning-produces-pending-evolution-bdd.ts`
- `test-learning-approval-required-in-prod-bdd.ts`

---

## P1-014 — Remplacer l’outbox process-local Temporal

### Problème

Le dispatch Temporal utilise `setTimeout(..., 0)` après publication queued.

### Fichiers concernés

- `starters/voip-rtc/server/learning/temporal-worker/worker-port.ts`
- `starters/voip-rtc/server/learning/temporal-worker/dynamic-client.ts`
- `starters/voip-rtc/server/learning/run-state.ts`

### Actions

- Démarrer Temporal avant publication queued, ou
- utiliser outbox durable avec retry.
- Réutiliser/fermer les connections Temporal proprement.

### Tests

- `test-temporal-dispatch-durable-bdd.ts`

---

## P1-015 — Durcir infra apply externe

### Problème

`tofu apply -auto-approve` est utilisé par le runner externe.

### Fichiers concernés

- `starters/voip-rtc/scripts/infra-external-runner.ts`
- `starters/voip-rtc/scripts/infra-apply.ts`
- `starters/voip-rtc/server/builder/onboarding/routes.ts`

### Actions

- `plan` obligatoire.
- `apply` seulement avec approval token.
- Interdire `auto-approve` sans confirmation serveur.
- Sauver plan artifact + hash.
- Appliquer seulement le plan hash approuvé.

### Tests

- `test-infra-apply-requires-approval-bdd.ts`

---

## P1-016 — Corriger K3s kubeconfig permissions

### Problème

`K3S_KUBECONFIG_MODE=666`.

### Fichiers concernés

- `starters/voip-rtc/scripts/infra-runtime.ts`

### Actions

- Passer à `600` ou `660`.
- Ajouter chmod après génération.
- Documenter le mode dev.

### Tests

- `test-k3s-kubeconfig-permissions-bdd.ts`

---

## P1-017 — Ne faire confiance à `x-forwarded-for` que derrière proxy connu

### Problème

Le quota ingestion utilise `clientIp`, mais `resolveClientIp` fait confiance à `x-forwarded-for`.

### Fichiers concernés

- `starters/voip-rtc/server/http/client-ip.ts`
- `starters/voip-rtc/server/builder/quotas/document-ingestion-quota.ts`

### Actions

- Ajouter `TRUST_PROXY`.
- Si `TRUST_PROXY=false`, ignorer forwarded headers.
- Supporter liste de proxies de confiance.

### Tests

- `test-client-ip-trust-proxy-bdd.ts`

---

## P1-018 — Ajouter validation schema stricte pour toutes les routes HTTP

### Problème

Beaucoup de routes lisent `request.json()` puis normalisent partiellement.

### Actions

- Créer schemas par route.
- Valider avant workflow.
- Retourner erreurs structurées.
- Limiter taille JSON.

### Tests

- `test-builder-route-schema-validation-bdd.ts`

---

# P2 — Architecture, SOLID, maintenabilité

## P2-001 — Splitter les orchestrateurs larges

### Modules concernés

- `src/server/browser/voice-service/service.ts`
- `src/client/browser/session/client.ts`
- `starters/voip-rtc/server/builder/workflows.ts`

### Actions

Extraire :
- `BrowserVoiceSessionRegistry`
- `BrowserVoiceProtocolGuard`
- `BrowserVoiceLifecycle`
- `ClientAudioLifecycle`
- `ClientSnapshotReducer`
- `BuilderWorkflowRouter`

---

## P2-002 — Améliorer qualité audio

### Actions

- Remplacer resampling linéaire par resampler avec anti-aliasing.
- Rendre le buffer worklet capture dynamique.
- Réduire playback prebuffer de 2s vers adaptatif.
- Ajouter métriques underrun/rebuffer/latence.

---

## P2-003 — Remplacer audits string-based par AST/tests runtime

### Fichiers

- `scripts/audit-tool-contracts.mjs`
- `scripts/audit-responsibility.mjs`

### Actions

- Utiliser TypeScript compiler API ou ESLint custom rules.
- Éviter les checks fragiles par substring.
- Conserver tests runtime BDD.

---

## P2-004 — Promouvoir diagnostics AGENTRX en vrai moteur runtime

### Actions

- Brancher diagnostics aux sessions.
- Générer rapport après failure.
- Relier constraints aux tools et aux prompts.
- Exporter markdown + JSON.

---

## P2-005 — Package split

### Proposition

- `@voiceagentsdk/core`
- `@voiceagentsdk/server`
- `@voiceagentsdk/client-browser`
- `@voiceagentsdk/adapters-openai`
- `@voiceagentsdk/adapters-gemini`
- `@voiceagentsdk/starter-voip-rtc`
- `@voiceagentsdk/adapters-postgres`

---

## P2-006 — CI distante obligatoire

### Actions

Ajouter `.github/workflows/ci.yml` :
- install pnpm ;
- typecheck ;
- build ;
- `pnpm audit:solid` ;
- secret hygiene ;
- dependency audit ;
- pack dry-run ;
- test matrix.

### Critère

Aucun merge sans CI verte.

---

# P3 — Documentation, DX, polish

## P3-001 — Documenter clairement les modes dev/prod

Inclure :
- dev token interdit en prod ;
- query identity interdit en prod ;
- stores locaux interdits en prod ;
- active draft fallback dev-only ;
- Temporal/Redis/Postgres nécessaires en prod.

## P3-002 — Ajouter runbooks

- Incident provider outage.
- Rollback agent version.
- Rotation secrets.
- Dépannage audio WebSocket.
- Dépannage K3s.
- Dépannage Temporal/Redis.

## P3-003 — Nettoyer UI/UX

- Retirer tenant/user des URLs visibles.
- Afficher statut auth.
- Clarifier agent actif vs agent sélectionné.
- Ajouter confirmation UI pour actions sensibles.
- Afficher diff prompt avant évolution.

## P3-004 — Ajouter docs d’architecture

- Diagramme Clean Core.
- Diagramme runtime voice.
- Diagramme builder.
- Diagramme learning/evolution.
- Diagramme infra apply.
- Diagramme tool execution policy.

---

# Ordre recommandé d’exécution

## Sprint 0 — Stopper les risques cross-tenant et prompt policy

1. P0-004 — préserver server policy après learning.
2. P0-001 — ownership obligatoire routes/workflows.
3. P0-002 — supprimer active draft global.
4. P0-003 — empêcher learning d’activer globalement.
5. Ajouter tests route-level et learning policy.

## Sprint 1 — Runtime tools et auth

1. P0-005 — confirmation serveur.
2. P0-006 — ToolExecutionPolicyEngine.
3. P0-007 — auth prod / WS tickets.
4. P0-009 — quotas WebSocket/audio.

## Sprint 2 — Persistence prod

1. P0-008 — repositories durables.
2. P1-011 — Redis memory hardening.
3. P1-012 — graph store isolation/indexes.
4. P1-014 — Temporal durable dispatch.

## Sprint 3 — Providers / infra / ops

1. P1-004/P1-005 — logs sensibles.
2. P1-006 — provider configs.
3. P1-009/P1-010 — retries/timeouts.
4. P1-015/P1-016 — infra apply hardening.
5. CI distante obligatoire.

---

# Definition of Done globale

Un item critique est considéré terminé seulement si :

- le code est corrigé ;
- un test BDD falsifiable est ajouté ;
- l’audit source ou architecture est mis à jour si nécessaire ;
- la documentation dev/prod est ajustée ;
- les erreurs renvoyées sont structurées et non sensibles ;
- aucun secret, prompt, transcript ou token long n’est loggé ;
- le comportement est sécurisé par défaut en `NODE_ENV=production`.

---

# Résumé final

Le repo a une base architecture solide, mais il faut corriger les invariants de sécurité runtime avant prod :

1. Ownership partout.
2. Active draft scoped ou supprimé.
3. Learning sans auto-activation globale.
4. Server policy toujours finale.
5. Confirmation serveur hors modèle.
6. Tool execution policy centralisée.
7. Auth prod sans query token/identity.
8. Stores durables et tenant-scoped.
9. Quotas runtime.
10. CI obligatoire.

Une fois ces dix axes traités, le projet pourra passer d’un **starter alpha avancé** à une **base production crédible**.