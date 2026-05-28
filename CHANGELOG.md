# Changelog

## fix: typecheck boundary bdd scripts

Status: implemented locally
Date: 2026-05-28

### Intent

Corriger les erreurs TypeScript cachees dans les BDD root et supprimer les
references de packaging/typecheck au pack Wine Investment abandonne.

### Journal

- Les scripts `test:fastify-voice-adapter:bdd` et
  `test:public-boundaries:bdd` lancent maintenant un `tsc --strict` avant Bun.
- Correction des types stricts dans les BDD Fastify et public-boundaries.
- `typecheck:examples` devient un no-op explicite tant qu'aucun exemple
  standalone n'est maintenu.
- Suppression du pack `examples/packs/wine-investment` des fichiers publies.
- README aligne la carte repo et la commande `typecheck:examples`.

### Validation

- `pnpm test:fastify-voice-adapter:bdd` OK
- `pnpm test:public-boundaries:bdd` OK
- `pnpm typecheck:examples` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add public boundary contracts

Status: implemented locally
Date: 2026-05-28

### Intent

Ajouter des contrats BDD sur les exports publics SDK/runtime pour detecter les
regressions de compilation SDK, protocole browser et package entrypoints.

### Journal

- Ajout de `pnpm test:public-boundaries:bdd` et integration dans
  `audit:solid`.
- Le test compile une definition minimale via `@voiceagentsdk/core` et
  `@voiceagentsdk/core/sdk`.
- Le test verifie la resolution des entrypoints declares `sdk`, `server`,
  `server/browser`, `server/adapters/fastify`, `server/media`,
  `server/providers` et `client/browser`.
- Ajout de l'export public `parseBrowserVoiceClientMessage` sur
  `@voiceagentsdk/core/server/browser`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:public-boundaries:bdd` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: wire fastify voice adapter

Status: implemented locally
Date: 2026-05-28

### Intent

Remplacer le placeholder Fastify par un adapter core qui expose le runtime voice
via une boundary HTTP/WebSocket et reste decouple du starter.

### Journal

- `createFastifyVoiceAdapter` enregistre maintenant `/voice/health` et
  `/voice/ws` avec prefix normalise.
- Ajout du contrat `FastifyLike.get`, des types route/request et du port-like
  `FastifyVoiceService`.
- Le WebSocket Fastify est adapte vers `BrowserVoiceSocket`, puis delegue a
  `BrowserVoiceService.handleBrowserStream`.
- L'adapter accepte soit un `voiceService` explicite, soit une config
  `BrowserVoiceServiceConfig` pour creer le service dans le core.
- Le contexte user tenant/user/plan vient de la query par defaut ou d'un
  resolver injecte.
- Ajout de `pnpm test:fastify-voice-adapter:bdd` et integration dans
  `audit:solid`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:fastify-voice-adapter:bdd` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add memory store port

Status: implemented locally
Date: 2026-05-28

### Intent

Faire passer la memoire runtime par un port injectable avec un adapter
in-memory deterministe par defaut et un adapter Redis selectionne par env cote
starter.

### Journal

- Ajout de `MemoryStorePort`, `MemoryScope`, `MemoryRecord` et des inputs
  write/list/delete dans les ports runtime SDK.
- `RuntimePromptCompileInput` peut recevoir des memories scoppes avant la
  compilation des instructions.
- Ajout de `createInMemoryMemoryStore` dans `@voiceagentsdk/core/server`.
- Ajout du factory starter `createRuntimeMemoryStoreFromEnv` avec
  `AGENT_RUNTIME_MEMORY_DRIVER`, namespace, TTL et `REDIS_URL`.
- Ajout de `RedisRuntimeMemoryStore` comme adapter Redis optionnel.
- `createVoiceSessionFactory` lit les memories tenant/user/agent avant le
  prompt compiler et ecrit un record `session.started` via `MemoryStorePort`.
- Ajout de `pnpm test:memory-store-port:bdd` et integration dans
  `audit:solid`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:memory-store-port:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add event sink logger port

Status: implemented locally
Date: 2026-05-28

### Intent

Faire passer les events runtime browser voice et les logs d'orchestration par
des ports injectables au lieu de les coupler a des callbacks ou loggers
concrets.

### Journal

- Ajout de `EventSinkPort`, `LoggerPort`, `RuntimeEventRecord` et
  `RuntimeLogContext` dans les ports runtime SDK.
- Ajout des adapters serveur `noopEventSink`, `createConsoleEventSink`,
  `noopLogger` et `createConsoleLoggerPort`.
- `BrowserVoiceService` accepte maintenant `eventSink` et `logger` injectes.
- Les messages session/state/tool/error/learning passent par un
  `BrowserControlEmitter` avant d'etre envoyes au WebSocket.
- Extraction de la creation de request browser voice pour garder le service sous
  la limite LOC.
- Ajout de `pnpm test:event-sink-logger-port:bdd` et integration dans
  `audit:solid`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:event-sink-logger-port:bdd` OK
- `pnpm test:media-bridge-factory:bdd` OK
- `pnpm test:solid-seams` OK
- `pnpm typecheck:sdk` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add prompt compiler port

Status: implemented locally
Date: 2026-05-28

### Intent

Faire passer la compilation des instructions runtime par un port injectable au
lieu de laisser l'orchestration voice lire les artifacts compiles et rendre les
prompts SDK directement.

### Journal

- Ajout de `PromptCompilerPort` et `RuntimePromptCompileInput` dans les ports
  runtime SDK.
- Ajout de `createStarterPromptCompiler`, adapter starter qui encapsule artifact
  compile, fallback `sdk.promptFor`, variables tenant et policy knowledge.
- `createVoiceSessionFactory` injecte maintenant le compiler et lui transmet
  channel, provider, agent id, tenant et noms des tools runtime.
- Suppression de l'ancien helper `voice/instructions.ts`; la session voice ne
  compile plus ses instructions directement.
- Ajout de `pnpm test:prompt-compiler-port:bdd` et integration dans
  `audit:solid`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:prompt-compiler-port:bdd` OK
- `pnpm test:tenant-resolver:bdd` OK
- `pnpm test:provider-factory:bdd` OK
- `pnpm typecheck:sdk` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add store adapter contracts

Status: implemented locally
Date: 2026-05-28

### Intent

Definir des contrats SQL/document/vector derriere `DbAdapterRegistry`, sans
mettre de mapping physique, soft delete ou migrations dans les definitions SDK
serialisables.

### Journal

- Ajout de `StoreAdapterContract` et des factories
  `createSqlStoreAdapterContract`, `createDocumentStoreAdapterContract` et
  `createVectorStoreAdapterContract`.
- Ajout de `createStoreAdapterBinding` et resolution de bindings store enrichis
  dans `DbAdapterRegistry`.
- Validation des mappings de champs/index et du soft delete contre
  `StoreDefinition` au moment de resoudre le binding.
- Les migrations restent des plans explicites sur le contrat adapter; une
  fonction `apply` dans le contrat est refusee.
- Ajout de `pnpm test:store-adapter-contracts:bdd` et integration dans
  `audit:solid`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:store-adapter-contracts:bdd` OK
- `pnpm test:db-adapter-registry:bdd` OK
- `pnpm typecheck:sdk` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add db adapter registry

Status: implemented locally
Date: 2026-05-28

### Intent

Faire passer la resolution des adapters database/store runtime par un registry
injectable, avec des definitions SDK qui portent uniquement des refs
serialisables.

### Journal

- Ajout de `adapterRef` sur `DatabaseDefinition` et `StoreDefinition`.
- Ajout de `DatabaseBuilder.adapterRef()` et `StoreBuilder.adapterRef()`.
- Suppression du stockage d'instance adapter dans `DatabaseBuilder`.
- Ajout de `DbAdapterRegistry`, `createDbAdapterRegistry`,
  `resolveDatabaseAdapterFromRegistry`, `resolveStoreAdapterFromRegistry` et
  `createSafeRepositoryFromRegistry`.
- `createSafeRepositoryFromRegistry` echoue ferme si le store, l'entite ou
  l'adapter ref manque.
- Ajout de `pnpm test:db-adapter-registry:bdd` et integration dans
  `audit:solid`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:db-adapter-registry:bdd` OK
- `pnpm typecheck:sdk` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm test:tool-contracts:bdd` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add media bridge factory port

Status: implemented locally
Date: 2026-05-28

### Intent

Faire passer la creation et le controle du media bridge browser par un port
injectable au lieu de laisser `BrowserVoiceService` instancier et piloter
directement `BrowserMediaHandler`.

### Journal

- Ajout de `MediaBridgeFactoryPort`, `MediaBridgeFactoryInput` et
  `MediaBridgePort` cote SDK.
- Ajout de l'adapter core `createDefaultBrowserMediaBridgeFactory`, qui enveloppe
  `BrowserMediaHandler` derriere le port.
- `BrowserVoiceService` utilise maintenant le port pour `start`, `stop`,
  `ingestAudio`, `sendAudio`, `clearOutput` et `onAudioToLlm`.
- Les interruptions appellent `clearOutput` avant de publier l'etat interrupted.
- Le starter transmet la definition SDK `browser-websocket` et accepte une
  `mediaBridgeFactory` injectable.
- Ajout de `pnpm test:media-bridge-factory:bdd` et integration dans
  `audit:solid`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:media-bridge-factory:bdd` OK
- `pnpm typecheck:sdk` OK
- `pnpm typecheck:starters` OK
- `pnpm test:tenant-resolver:bdd` OK
- `pnpm test:solid-seams` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add provider factory port

Status: implemented locally
Date: 2026-05-28

### Intent

Faire passer la creation des transports realtime par un port injectable au lieu
de laisser la session voix instancier directement les providers concrets.

### Journal

- Ajout de `ProviderFactoryPort` et `ProviderFactoryInput` cote SDK.
- Extraction des ports runtime (`SecretResolver`, `TenantResolver`,
  `ProviderFactory`) dans `runtime-ports.ts` pour garder `ports.ts` focalise.
- Deplacement de la factory provider starter et du fake E2E dans
  `server/providers`.
- `session-factory` compile les instructions et delegue la creation provider au
  port injecte.
- La factory starter couvre OpenAI Realtime, Gemini Live, Grok Realtime et
  cascaded providers, avec resolution de secret via `SecretResolverPort`.
- Ajout de `pnpm test:provider-factory:bdd` et integration dans `audit:solid`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:provider-factory:bdd` OK
- `pnpm test:secret-resolver:bdd` OK
- `pnpm test:solid-seams` OK
- `pnpm typecheck:sdk` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add secret resolver port

Status: implemented locally
Date: 2026-05-28

### Intent

Faire passer les cles API runtime/builder par un port injectable au lieu de
lectures directes d'env dans les factories provider, profils LLM builder et
embeddings runtime.

### Journal

- Ajout de `SecretResolverPort` et `SecretResolveInput` cote SDK.
- Ajout de l'adapter dev `createEnvSecretResolver`.
- `createProvider` resout les cles realtime via `SecretResolverPort`.
- Le catalogue LLM builder et les embeddings Voyage runtime consomment le meme
  port.
- Ajout de `pnpm test:secret-resolver:bdd` et integration dans `audit:solid`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:secret-resolver:bdd` OK
- `pnpm typecheck:sdk` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:architecture` OK
- `pnpm test:solid-seams` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add tenant resolver port

Status: implemented locally
Date: 2026-05-28

### Intent

Faire passer la resolution runtime tenant/provider/media bridge/user/plan par
un port injectable au lieu de fallbacks locaux dans la session voix.

### Journal

- Ajout de `TenantResolverPort`, `TenantResolutionInput` et
  `TenantResolutionResult` cote SDK.
- Ajout de l'adapter dev `createDevTenantResolver`.
- `session-factory`, `media-config` et le prompt fallback voix consomment la
  resolution tenant.
- Ajout de `pnpm test:tenant-resolver:bdd` et integration dans `audit:solid`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:tenant-resolver:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:architecture` OK
- `pnpm test:solid-seams` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: decide builder tool-plan prompt path

Status: implemented locally
Date: 2026-05-28

### Intent

Clarifier le chemin `tool-plan`: le builder reste deterministe pour les tools,
donc les templates prompt inutilises doivent disparaitre.

### Journal

- Suppression de `tool-plan.system.md` et `tool-plan.user.md`.
- `BuilderPromptLibrary` ne charge plus de paire `toolPlan` morte.
- `audit:tool-contracts` bloque le retour de templates `tool-plan` inutilises
  tant que le planning tools reste deterministe.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm audit:tool-contracts` OK
- `pnpm typecheck:starters` OK
- `pnpm test:llm-harness` OK
- `pnpm audit:solid` OK

## test: audit runtime tool binding invariants

Status: implemented locally
Date: 2026-05-28

### Intent

Rendre les echecs de binding runtime visibles par audit source, avant le
demarrage RTC ou la compilation d'un agent.

### Journal

- `audit:tool-contracts` verifie maintenant aussi les sources critiques:
  compilation en `ToolManifest`, absence de `execute` dans les manifests,
  binding runtime via `ToolRegistryAdapterPort`, et stockage SDK en
  `ToolManifest[]`.
- Le fallback builder ne genere plus de handler `unknown.*`; un outil inconnu
  devient non bindable et bloque s'il est selectionne.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm audit:tool-contracts` OK
- `pnpm test:tool-registry-adapter:bdd` OK
- `pnpm test:prompt-policy:bdd` OK

## test: promote runtime tool registry adapter

Status: implemented locally
Date: 2026-05-28

### Intent

Sortir le binding executable des tools runtime d'une map locale hardcodee et le
faire passer par un port SDK injectable.

### Journal

- Ajout de `ToolRegistryAdapterPort` et de `ToolRegistryExecutionInput` cote
  SDK.
- Ajout de l'adapter starter `actionToolRegistryAdapter`.
- `runtimeActionTools` accepte maintenant un registry injectable et masque les
  selected tools sans binding executable.
- La validation builder consomme les handler refs disponibles depuis le
  registry adapter au lieu d'un set local.
- `runtimeToolHandlerRefs()` centralise les refs runtime disponibles, dont
  `knowledge.search` et les actions.
- Ajout de `pnpm test:tool-registry-adapter:bdd` et integration dans
  `audit:solid`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:tool-registry-adapter:bdd` OK
- `pnpm test:prompt-policy:bdd` OK
- `pnpm test:runtime-tool-authorization:bdd` OK
- `pnpm typecheck:sdk` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:architecture` OK
- `pnpm audit:responsibility` OK
- `pnpm audit:loc` OK

## test: split executable and serializable tool contracts

Status: implemented locally
Date: 2026-05-28

### Intent

Separer clairement les manifests tools serialisables des tools executables pour
eviter les definitions a moitie runtime dans les artefacts SDK.

### Journal

- Ajout de `ToolManifest` pour les definitions serialisables SDK/artifact.
- `ToolDefinition` garde le contrat executable et rend `execute` obligatoire.
- `VoiceAgentSdkDefinition.tools`, le runtime compiler et les artifacts starter
  consomment maintenant des manifests.
- `createAgentBuilder().tool(...)` copie un manifest et retire les handlers
  executables.
- Ajout de `pnpm test:tool-contracts:bdd` et integration dans `audit:solid`.
- README, TODO et changelog sont a jour.

### Validation

- `pnpm test:tool-contracts:bdd` OK
- `pnpm typecheck:sdk` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK

## test: add infra evolution approval workflow

Status: implemented locally
Date: 2026-05-28

### Intent

Empecher le learning automatique d'appliquer directement des evolutions infra
cloud, externes, IaC ou marquees approval-required.

### Journal

- Ajout de `pnpm test:infra-evolution-approval:bdd`.
- Les recommandations infra risquees deviennent `pendingInfraEvolution` dans
  les metadata d'evolution et ne remplacent pas `draft.infraPlan`.
- Les plans locaux non destructifs restent applicables automatiquement.
- Ajout de `approveInfraEvolution` cote learning service et de la route
  `/builder/agents/approve-infra-evolution`.
- Les actions `pending_infra` et `approve_infra` sont auditees et l'approbation
  ajoute une version append-only.
- Agent Bank expose maintenant le resume de pending infra evolution.
- README, README starter, TODO et `audit:solid` sont a jour.

### Validation

- `pnpm test:infra-evolution-approval:bdd` OK
- `pnpm test:learning:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK

## test: add graph memory adapter boundaries

Status: implemented locally
Date: 2026-05-28

### Intent

Ajouter les adapters Neo4j/Memgraph derriere `GraphMemoryStorePort` sans casser
les defaults locaux: local in-memory sans DB et Postgres quand `DATABASE_URL`
existe.

### Journal

- Ajout de `pnpm test:graph-memory-adapters:bdd`.
- Ajout du driver `AGENT_LEARNING_GRAPH_DRIVER=local|postgres|neo4j|memgraph`.
- Ajout de `Neo4jGraphMemoryStore` et `MemgraphGraphMemoryStore` via un port
  `CypherGraphClientPort` injectable.
- Les writes graph utilisent des requetes Cypher `MERGE` parametrees pour les
  nodes et edges.
- `neo4j-driver` est installe dans le starter pour les connexions Bolt
  Neo4j/Memgraph.
- Separation SOLID du graph store en barrel public, factory, local-store,
  postgres-store, cypher-client, cypher-store et types.
- README, README starter, `.env.example`, onboarding env, TODO et
  `audit:solid` sont a jour.

### Validation

- `pnpm test:graph-memory-adapters:bdd` OK
- `pnpm test:learning:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK

## test: add ephemeral redis memory adapter tests

Status: implemented locally
Date: 2026-05-28

### Intent

Valider un vrai adapter Redis pour la memoire temporelle de learning, avec un
test BDD contre Redis ephemere et un chemin dev local conserve par env.

### Journal

- Ajout de `pnpm test:redis-memory:bdd`.
- Ajout du driver `AGENT_LEARNING_MEMORY_DRIVER=local|redis`.
- Ajout de `RedisTemporalMemoryStore` avec TTL Redis reel, namespace, scope
  tenant/agent/user et persistance entre instances d'adapter.
- Separation SOLID du memory store en barrel public, factory, local-store,
  redis-store, scope et types.
- Le service learning choisit maintenant son memory store via
  `createTemporalMemoryStoreFromEnv`.
- README, README starter, `.env.example`, onboarding env, TODO et
  `audit:solid` sont a jour.

### Validation

- `pnpm test:redis-memory:bdd` OK
- `pnpm test:learning:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK

## test: add temporal worker adapter boundary

Status: implemented locally
Date: 2026-05-28

### Intent

Permettre au learning post-session de dispatch vers un vrai worker Temporal par
env, sans casser le mode dev local in-process.

### Journal

- Ajout de `pnpm test:temporal-worker:bdd`.
- Ajout de `TemporalWorkerClientPort` et du driver
  `AGENT_LEARNING_WORKFLOW_DRIVER=local|temporal`.
- Le driver `temporal` retourne `queued` immediatement puis publie
  `running` ou `failed` de maniere asynchrone.
- `DynamicTemporalWorkerClient` demarre le workflow via `@temporalio/client`
  quand le driver temporal est configure.
- `@temporalio/client` est installe dans le starter pour rendre le driver
  temporal executable sans dependance manuelle.
- L'adapter Temporal est separe en factory, client dynamique, port de dispatch
  et types pour garder une responsabilite visible par fichier.
- Le service learning passe par la factory de workflow et reste local par
  defaut en dev.
- README, README starter, `.env.example`, onboarding env et TODO sont a jour.

### Validation

- `pnpm test:temporal-worker:bdd` OK
- `pnpm test:learning:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK

## test: lock vector graph adapter boundaries

Status: implemented locally
Date: 2026-05-28

### Intent

Rendre explicite la propriete des integrations Milvus et graph: elles restent
des adapters starter planifies tant qu'un package SDK reutilisable n'a pas ses
contrats.

### Journal

- Ajout de `pnpm test:adapter-boundaries:bdd`.
- Ajout de `AdapterOwnershipBoundary` cote SDK infra.
- Milvus et graph portent `owner=starter`, `binding=planned_only`, et
  `promotion=candidate_sdk_package`.
- La validation infra refuse maintenant un backend Milvus/graph sans boundary.
- Les variables OpenTofu exportent `adapter_boundary` pour les backends de
  knowledge.
- README, README starter et TODO sont a jour.

### Validation

- `pnpm test:adapter-boundaries:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add per-agent runtime db credential refs

Status: implemented locally
Date: 2026-05-28

### Intent

Faire passer l'acces Postgres runtime par une reference de credential propre a
l'agent, sans reutiliser silencieusement le `DATABASE_URL` de provisioning.

### Journal

- Ajout de `pnpm test:runtime-db-credentials:bdd`.
- `AgentInfraPlan.database.runtimeCredentialRef` decrit le provider, le schema,
  le role runtime et l'env dev `AGENT_DB_RUNTIME_URL_<SCHEMA>`.
- Le plan de securite declare cette env par-agent dans `secretRefs`.
- Le scope runtime compile transporte la ref jusqu'a `search_knowledge`.
- `PostgresKnowledgeSearch` resout la ref via un resolver de credentials et ne
  retombe pas sur le `DATABASE_URL` partage quand une ref agent existe.
- Les bundles IaC transportent la ref, pas l'URL de provisioning.
- README, README starter, `.env.example` et TODO sont a jour.

### Validation

- `pnpm test:runtime-db-credentials:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: harden infra runner boundaries

Status: implemented locally
Date: 2026-05-28

### Intent

Brancher le runner externe OpenTofu/cloud-init sans fuite d'env provider et sans
fallback destructeur ou implicite vers le mode dev-local.

### Journal

- Ajout de `pnpm test:infra-runner:bdd`.
- Le runner externe execute `tofu init/plan/apply` avec `TF_IN_AUTOMATION=1` et
  une env allowlistee.
- Les applies VM valident `cloud-init schema` avant `tofu apply -auto-approve`.
- `destroy` est refuse pour le driver externe.
- `external + local` est refuse par une policy CLI testable au lieu de retomber
  en `dev-local`.
- L'onboarding expose le driver `external`, la cible `managed`, et
  `BUILDER_INFRA_TOFU_MODULE_DIR`.
- README, README starter, `.env.example` et TODO sont a jour.

### Validation

- `pnpm test:infra-runner:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## chore: scrub ignored local env credentials

Status: implemented locally
Date: 2026-05-28

### Intent

Retirer les valeurs live-like du `.env` local ignore sans jamais les imprimer
dans les logs ou dans Git.

### Journal

- Vidage local de `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `VOYAGE_API_KEY` et
  `MOONSHOT_API_KEY` dans le `.env` ignore.
- `pnpm audit:local-secrets` est maintenant clean.
- `pnpm test:rtc-e2e` ne depend plus de cles realtime locales: le script active
  un faux provider E2E via `RTC_E2E_FAKE_PROVIDER=1`.
- Le TODO conserve l'action externe: revoke/regenerate les cles cote provider
  si les valeurs supprimees etaient actives.
- La prochaine tranche code passe sur l'infra runner hardening.

### Validation

- `pnpm audit:local-secrets` OK
- `pnpm audit:secrets` OK
- `pnpm test:rtc-e2e` OK sans provider live
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add secret hygiene audit

Status: implemented locally
Date: 2026-05-28

### Intent

Rendre la verification des secrets falsifiable sans jamais imprimer les valeurs
detectees.

### Journal

- Ajout de `pnpm audit:secrets` pour scanner les fichiers commitables.
- Ajout de `pnpm audit:local-secrets` pour scanner explicitement les `.env`
  ignores.
- Ajout de `pnpm test:secret-hygiene:bdd`.
- Les findings contiennent fichier, ligne, cle eventuelle, type, et
  `[redacted-secret]`, jamais la valeur brute.
- Les fixtures de tests qui simulent des cles sont construites par fragments
  pour eviter de stocker des patterns secrets bruts dans le repo.
- `pnpm audit:solid` execute maintenant `audit:secrets` et le BDD secret
  hygiene.
- `pnpm audit:local-secrets` signale encore `GEMINI_API_KEY`,
  `DEEPSEEK_API_KEY`, `VOYAGE_API_KEY` et `MOONSHOT_API_KEY` dans le `.env`
  ignore; rotation externe requise.

### Validation

- `pnpm test:secret-hygiene:bdd` OK
- `pnpm audit:secrets` OK
- `pnpm audit:local-secrets` redacted findings only: `GEMINI_API_KEY`,
  `DEEPSEEK_API_KEY`, `VOYAGE_API_KEY`, `MOONSHOT_API_KEY`
- `pnpm test:log-redaction:bdd` OK
- `pnpm test:learning:bdd` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: gate debug audio dumps

Status: implemented locally
Date: 2026-05-28

### Intent

Limiter les dumps audio OpenAI au debug local explicite, avec permissions
restrictives et nettoyage disponible.

### Journal

- Ajout de `pnpm test:debug-audio:bdd`.
- Le BDD prouve que `VOICE_DEBUG_AUDIO=true` ne suffit plus: le mode doit etre
  exactement `local`.
- `VOICE_DEBUG_AUDIO_DIR` permet de choisir le repertoire local, mais seulement
  sous le cwd ou le repertoire temporaire systeme.
- Les repertoires de dump sont forces en `0700`; les fichiers PCM/WAV en `0600`.
- Le dump expose les chemins utiles, finalise les WAV, et fournit `cleanup()`.
- `.env.example`, README racine, README starter, TODO et `audit:solid` sont a
  jour.

### Validation

- `pnpm test:debug-audio:bdd` OK
- `pnpm typecheck:sdk` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: redact prompt previews from logs

Status: implemented locally
Date: 2026-05-28

### Intent

Empecher les logs runtime normaux d'exposer prompts, messages, contenus ou
secrets imbriques, y compris via les bindings d'un logger enfant.

### Journal

- Ajout de `pnpm test:log-redaction:bdd`.
- Le BDD capture le logger console en dev et un adapter Pino factice.
- La redaction couvre recursivement `prompt`, `message`, `content`, `text`,
  transcript/input/output et les previews associees.
- Les champs secrets imbriques comme `authorization`, `token`, `apiKey`,
  `cookie`, `credential` et `password` sont masques.
- Extraction de `log-redaction.ts` pour separer la responsabilite de redaction
  du logger.
- `pnpm audit:solid` execute maintenant le BDD de redaction.
- Le TODO passe a la prochaine tranche: dumps audio debug locaux.

### Validation

- `pnpm test:log-redaction:bdd` OK
- `pnpm typecheck:sdk` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: enforce runtime tool authorization

Status: implemented locally
Date: 2026-05-28

### Intent

Garantir que le runtime n'expose jamais un outil executable qui n'est pas dans
la liste serveur des outils selectionnes, meme si l'artifact compile contient
des definitions supplementaires.

### Journal

- Ajout de `pnpm test:runtime-tool-authorization:bdd`.
- Le BDD construit un agent dont l'artifact contient un outil selectionne et un
  outil non selectionne avec handler valide.
- `runtimeActionTools` filtre maintenant par `agent.selectedTools` avant de
  publier les handlers executables.
- `pnpm audit:solid` execute maintenant ce BDD pour verrouiller le comportement.
- Le TODO passe a la prochaine tranche: logs et artefacts debug.

### Validation

- `pnpm test:runtime-tool-authorization:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: lint compiled prompt invariants

Status: implemented locally
Date: 2026-05-28

### Intent

Refuser les prompts compiles trop maigres ou dangereux avant qu'ils deviennent
des artifacts RTC actifs.

### Journal

- `pnpm test:prompt-policy:bdd` couvre maintenant un prompt final trop court qui
  doit etre rejete par lint.
- Ajout de `prompt-invariants.ts` pour verifier le corps du prompt avant
  sauvegarde de l'artifact.
- Le lint exige l'identite de l'agent, les politiques conversation/knowledge/tool,
  les criteres de succes, une regle de confirmation et une regle d'incertitude.
- Les outils selectionnes doivent apparaitre dans le corps du prompt compile.
- Le suffixe serveur reste valide separement via `assertServerOwnedPromptPolicy`.

### Validation

- `pnpm test:prompt-policy:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: quote builder inputs in prompts

Status: implemented locally
Date: 2026-05-28

### Intent

Eviter que l'identite builder, les documents uploades/recherches ou les listes
d'outils injectent des instructions dans les prompts LLM du builder.

### Journal

- Le harness `pnpm test:llm-harness` couvre maintenant un document hostile qui
  tente d'ignorer les regles precedentes.
- `renderPromptTemplate` route les valeurs sensibles via un helper
  `prompt-data.ts`.
- Les placeholders JSON/donnees builder sont rendus dans des blocs
  `<builder_data name="...">`.
- Chaque bloc declare explicitement que le contenu est une donnee non fiable,
  pas une instruction.
- La protection s'applique aux drafts, identities, documents, recherches,
  outils selectionnes, handlers runtime, objectifs et intents agent.

### Validation

- `pnpm test:llm-harness` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: enforce server-owned prompt policy

Status: implemented locally
Date: 2026-05-28

### Intent

Garantir que le prompt final compile ne puisse pas affaiblir les politiques
serveur meme si le modele builder genere des instructions hostiles.

### Journal

- Ajout de `pnpm test:prompt-policy:bdd`.
- Le BDD compile un agent avec un prompt final hostile qui tente d'autoriser un
  outil non selectionne.
- `compileAgent` append maintenant une section
  `SERVER-OWNED SAFETY AND TOOL POLICY` en suffixe final du prompt compile.
- La policy serveur declare que le suffixe override les conflits generes,
  limite les appels aux outils selectionnes et traite inputs/documents/tool
  output comme donnees.
- Le lint compile-time refuse un prompt dont la policy serveur manque ou n'est
  pas le suffixe final.
- Le workflow `compileAgent` est extrait dans `workflow-agent-compile.ts` pour
  garder `workflows.ts` sous la limite LOC.
- `pnpm audit:solid` execute maintenant le BDD prompt-policy.

### Validation

- `pnpm test:prompt-policy:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add document ingestion quota seam

Status: implemented locally
Date: 2026-05-28

### Intent

Limiter l'ingestion document par IP avant lecture et parsing du corps, afin
d'eviter qu'un client puisse saturer le builder avec des uploads repetes.

### Journal

- Ajout d'un BDD dedie qui prouve qu'une deuxieme ingestion depuis la meme IP
  est rejetee avant parsing et qu'une autre IP garde son propre quota.
- Ajout du port `DocumentIngestionQuotaPort` et d'un adapter memoire local par
  fenetre glissante.
- Le contexte builder transporte maintenant `clientIp` depuis la couche HTTP.
- `x-forwarded-for`, `x-real-ip`, puis `server.requestIP` alimentent la
  resolution d'IP.
- `BUILDER_DOCUMENT_INGESTION_QUOTA_PER_IP` et
  `BUILDER_DOCUMENT_INGESTION_QUOTA_WINDOW_MS` configurent le dev mode et sont
  exposes dans l'onboarding.

### Validation

- `pnpm test:document-ingestion:bdd` OK
- `pnpm typecheck:sdk` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: add document parser timeout seam

Status: implemented locally
Date: 2026-05-28

### Intent

Eviter qu'un parser document bloque le workflow builder: l'ingestion doit
echouer proprement et rester configuree par env en mode dev.

### Journal

- Le scenario `pnpm test:document-ingestion:bdd` couvre maintenant un parseur
  bloque qui doit se terminer en document `failed`.
- Le port `DocumentIngestionPort` accepte un `AbortSignal` optionnel pour les
  adapters capables d'annuler leur parsing.
- `parseDocumentWithTimeout` encapsule le port ingestion et retourne une erreur
  explicite `Document parsing timed out after ...ms`.
- `BUILDER_DOCUMENT_PARSE_TIMEOUT_MS` pilote le timeout depuis l'env et apparait
  dans l'onboarding dev.
- Le parseur texte/xlsx verifie le signal avant le parsing et pendant les
  boucles workbook.

### Validation

- `pnpm test:document-ingestion:bdd` OK
- `pnpm typecheck:sdk` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: cover workbook parser caps

Status: implemented locally
Date: 2026-05-28

### Intent

Rendre les limites du parseur xlsx falsifiables: une feuille de calcul ne doit
pas pouvoir depasser silencieusement les bornes de feuilles, lignes, cellules ou
texte injectees dans la knowledge.

### Journal

- Le scenario `pnpm test:document-ingestion:bdd` genere de vrais workbooks
  SheetJS pour les limites de feuilles, lignes, cellules et texte de cellule.
- Le parseur xlsx lit une ligne sentinelle pour detecter un depassement de
  `MAX_ROWS_PER_SHEET` sans alimenter la knowledge avec la ligne excedentaire.
- Les cellules au-dela de `MAX_CELLS_PER_ROW` et le texte au-dela de
  `MAX_CELL_CHARS` sont coupes avant generation du texte knowledge.
- `metadata.truncated` devient observable pour chaque coupe: feuilles, lignes,
  cellules, et texte de cellule.

### Validation

- `pnpm test:document-ingestion:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: harden document ingestion limits

Status: implemented locally
Date: 2026-05-28

### Intent

Rendre l'ingestion document falsifiable avant qu'un upload puisse alimenter les
prompts builder, le planning knowledge ou la compilation RAG.

### Journal

- Ajout de `pnpm test:document-ingestion:bdd`.
- Le scenario BDD rejette les uploads sans `content-length`.
- Le scenario BDD rejette les corps declares au-dessus de la limite.
- Le scenario BDD rejette les types document non allowlistes, dont `.exe` et
  `.xls`.
- Le chemin nominal accepte un Markdown borne et le parse via le vrai
  `PlainTextDocumentIngestion`.
- La politique d'ingestion est isolee dans `request/document-policy.ts`.
- `pnpm audit:solid` execute maintenant ce scenario BDD.

### Validation

- `pnpm test:document-ingestion:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: enforce postgres least privilege provisioning

Status: implemented locally
Date: 2026-05-28

### Intent

Fermer la derniere tranche DB immediate: le provisioner Postgres reel doit
borner ses DDL avec `statement_timeout` et creer une surface runtime
least-privilege en lecture seule.

### Journal

- `pnpm test:database-provisioning` couvre maintenant un scenario BDD
  `server-template-least-privilege`.
- Le template server-owned Postgres emet `set local statement_timeout`.
- Le template cree un role runtime par agent avec `NOLOGIN`.
- Le role runtime recoit son propre `statement_timeout`.
- Les grants runtime sont limites a `USAGE` sur le schema et `SELECT` sur les
  tables du schema.
- Le resultat du provisioner annonce les timeouts et le role runtime assure.
- Le plan infra marque maintenant `security.leastPrivilegeRole` comme actif.

### Validation

- `pnpm test:database-provisioning` OK
- `pnpm test:infra-plan` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: enforce builder draft ownership

Status: implemented locally
Date: 2026-05-28

### Intent

Fermer la prochaine tranche BDD du hardening DB: les workflows privilegies ne
doivent pas faire confiance a un draft envoye par la requete, mais recharger le
draft serveur et verifier son owner authentifie.

### Journal

- Ajout de `pnpm test:builder-draft-ownership:bdd`.
- Le scenario BDD prouve qu'un utilisateur croise ne peut pas appliquer la DB
  d'un draft owned par quelqu'un d'autre.
- Le scenario BDD prouve aussi qu'un draft hostile envoye dans le body est
  ignore au profit du draft serveur.
- Les drafts crees par `/builder/prompt-plan` portent maintenant
  `metadata.builderOwner`.
- Les workflows `autonomous-knowledge`, `database-plan`, `apply-database` et
  `compile-knowledge` rechargent le draft serveur et verifient son owner.
- Le contexte d'identite verifiee est propage du guard HTTP vers le builder
  router/workflows.
- `pnpm audit:solid` execute maintenant ce scenario BDD.

### Validation

- `pnpm test:builder-draft-ownership:bdd` OK
- `pnpm typecheck:starters` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## test: harden database provisioning validation

Status: implemented locally
Date: 2026-05-28

### Intent

Rendre falsifiable le hardening DB: le starter doit prouver que le provisioner
reel accepte le plan Postgres/pgvector serveur et rejette les DDL dangereux
avant toute application.

### Journal

- Ajout de `pnpm test:database-provisioning`.
- Le test appelle le vrai `PostgresAgentDatabaseProvisioner.validate` avec le
  vrai `fallbackDatabasePlan`.
- Le validateur SQL rejette maintenant:
  - les extensions autres que `vector`;
  - les options arbitraires sur `create extension`;
  - `CREATE TABLE AS SELECT`;
  - les appels de fonctions arbitraires;
  - les index d'expression.
- `pnpm audit:solid` execute maintenant ce test avant le RTC E2E.

### Validation

- `pnpm test:database-provisioning` OK
- `pnpm audit:solid` OK
- `git diff --check` OK

## feat: add auth ticket port

Status: implemented locally
Date: 2026-05-28

### Intent

Proteger le control plane du starter avec un port d'identite explicite, sans
casser le mode dev pilote par env.

### Journal

- Ajout des types SDK `AuthTicketPort`, `AuthTicketInput` et
  `AuthTicketIdentity`.
- Ajout d'un adapter starter dev-token base sur `VOICE_DEV_AUTH_TOKEN`.
- `/builder/*` et `/voice/ws` passent maintenant par le verifier du contexte
  route.
- L'upgrade `/voice/ws` transmet l'identite verifiee au runtime voix au lieu de
  relire directement `tenantId` / `userId` depuis la query.
- `pnpm test:solid-seams` verifie que l'identite WebSocket vient du verifier.
- Le workflow learning continue si le graph memory Postgres optionnel est
  indisponible; la memoire temporelle et l'evolution restent appliquees.
- `pnpm test:learning` couvre ce fallback graph-memory.

### Validation

- `pnpm test:solid-seams` OK
- `pnpm test:learning` OK
- `pnpm typecheck:starters` OK
- `pnpm typecheck:sdk` OK
- `pnpm audit:solid` OK

## test: cover builder llm harness

Status: implemented locally
Date: 2026-05-27

### Intent

Verrouiller le harness LLM provider-agnostique avec des tests rapides et
deterministes avant les prochaines passes de hardening.

### Journal

- Ajout de `pnpm test:llm-harness`.
- Ajout d'un faux `LlmTaskRunnerPort` enregistrant les taches emises.
- Couverture des comportements suivants:
  - fallback JSON du prompt planner;
  - creation document/checkpoints de recherche autonome;
  - normalisation des verdicts verifier;
  - selection resolver avec provider demande puis fallback.
- `pnpm audit:solid` execute maintenant aussi `pnpm test:llm-harness`.

### Validation

- `pnpm test:llm-harness` OK
- `pnpm typecheck:starters` OK

## chore/refactor: enforce SOLID architecture gates

Status: implemented locally
Date: 2026-05-27

### Intent

Transformer les principes SOLID en contraintes executables: une responsabilite
visible par fichier, frontieres SOA strictes, pas de cycles, pas de couplage
SDK/runtime/client inverse, pas d'heritage concret fragile hors bases plateforme.

### Journal

- Installation de `dependency-cruiser` et ajout de `pnpm audit:architecture`.
- Ajout de `.dependency-cruiser.cjs` avec regles strictes:
  - pas de cycles;
  - imports resolus et dependances declarees;
  - prod sans dependances dev-only;
  - pas d'import de `dist`;
  - SDK fondation sans dependance server/client;
  - separation client/server et UI/server;
  - domaines UI et builder purs;
  - pas d'import feature -> autre feature;
  - runtime sans internals builder;
  - tests/BDD/scripts exclus des modules prod.
- Ajout de `pnpm audit:responsibility`:
  - maximum 5 exports runtime par fichier d'implementation;
  - un composant exporte par fichier TSX;
  - noms de fichiers explicites;
  - primitives UI en feuilles;
  - fichiers `index/utils/state/request/routing/protocol` limites a des
    barrels;
  - interdiction d'heritage concret hors `Error` et `AudioWorkletProcessor`.
- Ajout de `pnpm audit:solid` pour enchainer architecture, responsabilite,
  LOC, boundaries, typechecks, tests de coutures et E2E RTC.
- Ajout de `pnpm test:solid-seams`, un test BDD falsifiable pour les coutures
  HTTP origin/auth, voice provider factory, hook learning, serializers builder
  et validation infra.
- Ajout de frontieres Dependency Cruiser dediees a `server/app`, `server/http`,
  `server/voice` et `server/adapters`.
- Suppression des barrels de compatibilite internes `server/builder/state.ts`,
  `server/builder/request.ts` et `server/builder/utils.ts`; les imports internes
  pointent maintenant vers les modules responsables.
- Decoupage SRP de modules trop larges:
  - racine `starters/voip-rtc/server` reduite a `index.ts`;
  - composition starter rangee dans `server/app`;
  - CORS/auth/routes HTTP ranges dans `server/http`;
  - orchestration voix rangee dans `server/voice`;
  - adapters techniques Bun/Postgres ranges dans `server/adapters`;
  - panels RTC;
  - utilitaires audio;
  - factories SDK;
  - metadata de state machine;
  - setup Gemini;
  - protocole browser voice;
  - helpers research;
  - backends et normalizers infra;
  - parsing des requetes builder;
  - store/session/payloads builder;
  - catalogue provider;
  - helpers SQL Postgres.

### Validation

- `pnpm audit:responsibility` OK
- `pnpm audit:architecture` OK
- `pnpm typecheck:sdk` OK
- `pnpm --filter @voiceagentsdk/starter-voip-rtc typecheck` OK
- `pnpm test:solid-seams` OK
- `pnpm audit:loc` OK
- `pnpm audit:solid` OK

## feat/refactor: add post-session learning stores and nest modules

Status: implemented locally
Date: 2026-05-27

### Intent

Permettre aux agents RTC d'apprendre apres une session sans ralentir la
fermeture voix: la session se termine, un job learning asynchrone classe les
faits/preferences/echecs/outils manquants, puis met a jour la memoire
temporelle, le graphe et une nouvelle version rollbackable de l'agent.

La passe actuelle garde aussi le code maintenable: les fichiers manuscrits
restent sous 300 LOC avec des modules dedies pour types SDK, infra learning,
evolution, scenarios BDD et types UI.

### Journal

- Ajout des ports SDK learning:
  - `TemporalWorkflowPort`
  - `TemporalMemoryStorePort`
  - `GraphMemoryStorePort`
  - `AgentEvolutionPort`
- Ajout d'un `AgentStorePlan` dans `AgentInfraPlan` quand
  `AGENT_LEARNING_ENABLED` est actif.
- Le plan infra decrit Redis, Temporal, graph memory, audit/source store et
  vector memory optionnelle, mais les stores sont crees a la fin de session,
  pas au moment du planning builder.
- Dev mode pilote par env:
  - `AGENT_LEARNING_ENABLED`
  - `AGENT_LEARNING_MEMORY_TTL_SECONDS`
  - `REDIS_URL`
  - `TEMPORAL_ADDRESS`
  - `TEMPORAL_NAMESPACE`
  - `TEMPORAL_TASK_QUEUE`
  - `NEO4J_URI` / `GRAPH_DATABASE_URL`
- Ajout du hook RTC `onEnded`:
  - collecte summary, transcript, tool calls, tenant/user et draft/agent ids;
  - queue le job learning;
  - renvoie la fin de session immediatement et publie `learning.status`.
- Ajout du workflow local `learnFromSession`:
  - memoire Redis TTL par tenant/agent/user;
  - graph nodes/edges idempotents;
  - recommandations de retrieval/tool/prompt;
  - application automatique d'une nouvelle version d'agent.
- Ajout des garde-fous:
  - versions append-only;
  - pointeur rollback;
  - audit metadata apply/rollback;
  - redaction des secrets appris;
  - pas de migration infra destructive.
- UI starter:
  - panneau Learning Stores dans la zone database/infra;
  - statut learning dans RTC Lab apres stop;
  - version courante, dernier run learning et rollback dans Agent Bank;
  - checks onboarding pour Redis, Temporal, graph et TTL.
- Ajout du test BDD popperien `pnpm test:learning:bdd`.
- Decoupage LOC:
  - `src/sdk/types/learning.ts`;
  - `src/sdk/types/provisioning.ts`;
  - `src/sdk/types/database.ts`;
  - `server/builder/domain/infra-backends.ts`;
  - `server/builder/domain/infra-learning.ts`;
  - `server/learning/evolution-*`;
  - `scripts/learning-bdd/*`;
  - types UI builder/app-mode dedies.

### Validation

- `pnpm audit:loc` OK
- `pnpm typecheck:sdk` OK
- `pnpm --filter @voiceagentsdk/starter-voip-rtc typecheck` OK
- `pnpm test:learning:bdd` OK
- `pnpm test:learning` OK
- `pnpm test:infra-plan` OK
- `pnpm test:knowledge-tool` OK
- `pnpm audit:sdk-boundary` OK
- `pnpm audit:imports` OK
- `pnpm test:rtc-e2e` OK
- `pnpm pack:dry-run` OK

## feat: validate builder tool contracts before RTC compile

Status: implemented locally
Date: 2026-05-27

### Intent

Faire de l'onboarding tools une vraie etape contractuelle, separee du prompt
final de l'agent vocal. Le builder planifie et valide les tools; le runtime les
execute; le prompt vocal ne recoit que les regles d'usage utiles a la
conversation.

### Journal

- Ajout des types SDK:
  - `ToolBuildPlan`
  - `ToolBuildContract`
  - `ToolValidationReport`
  - `ToolPlannerPort`
- Ajout des templates builder separes:
  - `tool-plan.system.md`
  - `tool-plan.user.md`
- Preservation volontaire de `final-prompt.*` pour le prompt systeme final de
  l'agent vocal.
- Ajout du domaine starter `builder/domain/tooling`:
  - contrats deterministes depuis le registry;
  - validation des handlers, schemas, secrets, knowledge store, KG et
    confirmations;
  - compilation des definitions tools serialisables.
- `compile-agent` refuse maintenant les selected tools invalides avant de
  composer le prompt vocal.
- Ajout des handlers runtime pour tools d'action:
  - `summary.create`
  - `handoff.create`
  - `task.schedule`
  - `event.emit`
- Ajout de `audit:tool-contracts`.
- UI builder enrichie avec statut de contrat tool sans melanger logique runtime
  et composants visuels.
- Kimi teacher/verifier accepte une sortie riche, temperature compatible, max
  tokens par defaut eleve, et fallback sans thinking si le raisonnement consomme
  tout le budget.

### Validation

- `pnpm typecheck:sdk` OK
- `pnpm typecheck:starters` OK
- `pnpm typecheck:examples` OK
- `pnpm audit:loc` OK
- `pnpm audit:imports` OK
- `pnpm audit:sdk-boundary` OK
- `pnpm audit:tool-contracts` OK
- `pnpm test:db` OK
- `pnpm test:knowledge-tool` OK
- `pnpm test:runtime-tool-call` OK
- `RTC_E2E_AUDIO_DURATION_MS=1200 pnpm test:rtc-e2e` OK
- `pnpm build` OK
- `pnpm pack:dry-run` OK

## refactor: carve agnostic voice agent sdk from copied runtime

Status: implemented locally
Date: 2026-05-25

### Intent

Construire une base SDK voix agnostique depuis la logique runtime existante:
multi-provider, sessions voix, media pipeline, interruptions/barge-in, audio
browser, Twilio voice/SMS et providers realtime.

Le metier applicatif ne reste pas dans le core. Il vit dans un pack exemple ou
dans un repo consommateur pilote par onboarding UI, tool creator et db creator.

### Journal

- `src` est maintenant la source canonique.
- Suppression du doublon physique `server/src/**`.
- Suppression des anciens dossiers applicatifs top-level: `server`, `client`,
  `shared`, `db-schema`.
- Nettoyage agressif de `src` pour ne garder que:
  - `src/sdk/**`
  - `src/server/**`
  - `src/client/browser/**`
  - `src/index.ts`
- Extraction serveur conservee sous `src/server`:
  - transports OpenAI, Gemini, Grok, cascaded, Twilio voice/SMS
  - sessions voice/audio/interruption/state
  - handlers browser media et barge-in
  - types provider/session/event/error
  - utils audio, RNNoise, AEC, AGC, ids, logger, SMS
- Extraction client browser sous `src/client/browser`:
  - `VoiceWebSocketClient`
  - `BrowserVoiceSessionClient`
  - worklets audio capture/playback
  - protocole browser voice sans UI produit
- Ajout d'une couche serveur browser voice reutilisable:
  - `createBrowserVoiceService`
  - bridge WebSocket browser -> media handler -> realtime session
- Ajout du starter reutilisable:
  - `starters/voip-rtc`
  - serveur Bun WebSocket
  - client React/Vite
  - wiring OpenAI Realtime via exports publics du package
- Pack metier exemple conserve hors core:
  - `examples/packs/wine-investment`
- `package.json` pointe vers `dist`, pas vers l'ancienne copie agent.
- Exports publics remplaces par:
  - `.`
  - `./sdk`
  - `./server`
  - `./server/adapters/fastify`
  - `./server/providers`
  - `./server/media`
  - `./client/browser`
- Dependances publiques reduites a `ws` et `@shiguredo/rnnoise-wasm`.
- Ajout d'un `StoreBuilder` et d'un `SafeRepository`:
  - descriptions d'entites store
  - policies tenant/user/global
  - operations autorisees
  - champs filtrables, triables, creables, modifiables
  - injection de scope avant appel adapter
- Ajout d'une allowlist `files` pour le package.
- Passage ESM en `NodeNext` avec imports internes `.js`, afin que les exports
  publies resolvent dans Node sans bundler.
- Ajout de `scripts/audit-core-imports.mjs` pour bloquer les imports/termes
  produit dans `src`.

### Validation

- `pnpm typecheck:sdk` OK
- `pnpm typecheck:examples` OK
- `pnpm audit:sdk-boundary` OK
- `pnpm audit:imports` OK
- `pnpm build` OK
- Import Node OK pour tous les exports publics.
- `pnpm pack --dry-run --json` exclut l'ancienne copie applicative.

### Remaining Scope

- Port VOIP complet au sprint suivant:
  - tenant resolver
  - secret resolver
  - provider factory
  - media bridge factory
  - tool registry adapter
  - prompt compiler
  - db adapter
- Brancher les adapters Fastify reels autour du runtime SDK nettoye.
- Transformer le pack exemple en demo executable.
