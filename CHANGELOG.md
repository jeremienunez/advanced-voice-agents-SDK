# Changelog

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
