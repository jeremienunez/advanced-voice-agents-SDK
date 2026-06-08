# Voice Agent SDK - README Developpeur

Ce document explique le SDK avec un vocabulaire volontairement simple, mais en
restant exact par rapport au code. Il sert a comprendre l'architecture,
l'orchestration, les frontieres entre les dossiers, et ou brancher du code
metier.

## Resume En Une Phrase

Le SDK sert a declarer un agent vocal de facon propre: son prompt, ses tools,
ses providers, ses plans, ses stores et ses bases. Ensuite une app consommatrice
branche des adapters concrets pour executer cet agent en voix temps reel.

Le coeur du repo n'est pas un produit SaaS complet. C'est une boite a outils:

- `src/sdk` decrit et compile les agents.
- `src/server` execute les sessions voix et les providers realtime.
- `src/client/browser` capture/joue l'audio dans le navigateur.
- `starters/voip-rtc` montre une integration concrete Bun + React + provider.

## Image Mentale

Pense au projet comme a quatre couches:

```text
Utilisateur / navigateur
  -> client browser SDK
  -> serveur voice runtime
  -> provider realtime
  -> modele vocal

Builder / back-office
  -> formulaires, documents, tools
  -> draft SDK
  -> prompt final compile
  -> artifact utilisable par le runtime voix
```

Le SDK pur ne sait pas ou est ta base, qui est ton utilisateur, ni comment tu
authentifies une websocket. Il definit les contrats. Le starter montre une facon
de brancher ces contrats.

## Le Cycle Complet En 6 Verbes

```text
Declarer
  -> compiler
  -> brancher des adapters
  -> ouvrir une session
  -> streamer l'audio
  -> executer tools/knowledge
```

En code, ca veut dire:

1. declarer l'agent avec `createAgentBuilder()`;
2. compiler la definition avec `compileVoiceAgentSdk()`;
3. brancher providers, secrets, DB, embeddings et tools dans ton app;
4. creer une session voix avec `createRealtimeVoiceSession()`;
5. relier le navigateur avec `createBrowserVoiceSessionClient()`;
6. laisser le provider realtime appeler les tools quand il en a besoin.

## Les Dossiers A Connaitre

| Dossier | Role |
| --- | --- |
| `src/sdk` | Types, builders, compiler, ports, store securise, diagnostics. |
| `src/server` | Runtime serveur voix: sessions, transports, media handlers, providers. |
| `src/client/browser` | Client WebSocket/audio pour navigateur. |
| `starters/voip-rtc` | Exemple reusable Bun + React qui branche le SDK et le runtime. |
| `examples/packs` | Exemples de packs metier hors core. |
| `docs` | Documentation d'architecture et de migration. |
| `dist` | Build genere. La source de verite reste `src` et `starters`. |

## Les Exports Publics

Le package expose plusieurs entrees dans `package.json`:

| Import | Contenu |
| --- | --- |
| `@voiceagentsdk/core` | Re-export du SDK declaratif. |
| `@voiceagentsdk/core/sdk` | Types, builders, runtime compiler, store, diagnostics, ports. |
| `@voiceagentsdk/core/server` | Types runtime, transports, sessions, handlers, browser service, media. |
| `@voiceagentsdk/core/server/browser` | Service WebSocket browser voice cote serveur. |
| `@voiceagentsdk/core/server/providers` | Facade providers/transports realtime. |
| `@voiceagentsdk/core/server/media` | Facade media handlers et utils audio. |
| `@voiceagentsdk/core/server/adapters/fastify` | Adapter Fastify pour healthcheck et WebSocket voice. |
| `@voiceagentsdk/core/client/browser` | Client browser WebSocket/audio. |

Important: `@voiceagentsdk/core` n'exporte pas automatiquement tout le runtime
serveur. Pour le serveur, utiliser `@voiceagentsdk/core/server`.

Guides lies:

- [Integrations app-owned](../../../APP_OWNED_INTEGRATION.md)
- [Procedure release alpha](../../../RELEASE_ALPHA.md)

## Vocabulaire Simple

| Mot | Sens dans ce repo |
| --- | --- |
| SDK definition | Gros objet declaratif qui liste tenants, providers, prompts, tools, DB, stores. |
| Builder | Classe fluide qui fabrique un objet SDK valide. |
| Runtime compile | Transformation d'une definition en objet pratique avec getters et validations. |
| Draft | Brouillon d'agent construit par le builder UI avant compilation finale. |
| Artifact | Resultat compile d'un draft: prompt final, tools, knowledge, SDK definition. |
| Port | Interface abstraite que l'app doit implementer: planner, embeddings, DB, ingestion. |
| Adapter | Implementation concrete d'un port: DeepSeek, Voyage, Postgres, etc. |
| Provider | Moteur vocal/realtime: OpenAI Realtime, Gemini Live, Grok, cascaded. |
| Media bridge | Pont audio: browser websocket, Twilio voice, SIP, custom. |
| Tool | Fonction appelable par le modele avec schema JSON et handler TypeScript. |
| Store | Definition de donnees securisee par policies: scope, champs, operations. |
| Domain pack | Bundle metier de prompts, tools, DB, onboarding, plans. |

## Le Coeur SDK

Le coeur declaratif vit dans `src/sdk`.

Les fichiers principaux:

- `src/sdk/types/core.ts`: contrat principal `VoiceAgentSdkDefinition`.
- `src/sdk/builders/agent.ts`: `AgentBuilder`.
- `src/sdk/runtime.ts`: `compileVoiceAgentSdk()`.
- `src/sdk/builders/tool.ts`: `ToolBuilder`.
- `src/sdk/builders/database.ts`: `DatabaseBuilder`.
- `src/sdk/builders/draft.ts`: `AgentBuildDraftBuilder`.
- `src/sdk/types/ports.ts`: ports que l'app doit brancher.
- `src/sdk/store`: store declaratif et repository securise.
- `src/sdk/diagnostics`: rapports AgentRx.

### `VoiceAgentSdkDefinition`

C'est le grand contrat de base:

```ts
interface VoiceAgentSdkDefinition {
  tenants: TenantDefinition[];
  providers: ProviderDefinition[];
  mediaBridges: MediaBridgeDefinition[];
  plans: PlanDefinition[];
  prompts: PromptSection[];
  tools: ToolDefinition[];
  databases: DatabaseDefinition[];
  stores: StoreDefinition[];
  onboarding: OnboardingStep[];
  packs: DomainPack[];
}
```

Il ne lance rien tout seul. Il decrit ce qui existe.

### `AgentBuilder`

`createAgentBuilder()` fabrique une definition SDK:

```ts
import {
  compileVoiceAgentSdk,
  createAgentBuilder,
} from "@voiceagentsdk/core/sdk";

const sdkDefinition = createAgentBuilder()
  .tenant({
    id: "local",
    displayName: "Local",
    defaultProviderId: "gemini",
    defaultMediaBridgeId: "browser",
  })
  .provider({
    id: "gemini",
    kind: "gemini-live",
    apiKey: { name: "GEMINI_API_KEY" },
    model: "gemini-3.1-flash-live-preview",
    voice: "Puck",
  })
  .mediaBridge({
    id: "browser",
    kind: "browser-websocket",
    providerId: "gemini",
    inputEncoding: "pcm16",
    outputEncoding: "pcm16",
    sampleRate: 24000,
  })
  .prompt({
    id: "system",
    channels: ["voice"],
    priority: 1,
    body: "You are a concise voice agent.",
  })
  .build();

const compiled = compileVoiceAgentSdk(sdkDefinition);
const prompt = compiled.promptFor({ channel: "voice" });
```

Le builder verifie les doublons: tenants, providers, media bridges, plans,
tools, databases, stores et onboarding steps.

### `compileVoiceAgentSdk()`

`compileVoiceAgentSdk(definition)` transforme la definition en runtime
declaratif:

- `getTenant(id)`
- `getProvider(id)`
- `getMediaBridge(id)`
- `getStore(id)`
- `getStoreEntity(storeId, entityId)`
- `providerForTenant(tenantId)`
- `mediaBridgeForTenant(tenantId)`
- `planIncludes(planId, requiredPlanId)`
- `toolsForPlan(planId)`
- `promptFor({ channel, variables })`

Il valide aussi les references:

- un tenant ne doit pas pointer vers un provider absent;
- un media bridge ne doit pas pointer vers un provider absent;
- un plan ne doit pas heriter d'un plan absent;
- un tool ne doit pas pointer vers un plan absent;
- un store doit avoir des entites valides.

Le rendu de prompt est volontairement simple:

- filtre par channel (`voice`, `chat`, `sms`);
- trie par `priority`;
- remplace `{{variable}}` avec les variables fournies;
- joint les sections avec deux sauts de ligne.

## Tools

Un tool SDK est une fonction que le modele peut appeler.

Fichier: `src/sdk/builders/tool.ts`.

```ts
const searchCatalog = createToolBuilder("search_catalog")
  .describe("Search catalog items")
  .category("catalog")
  .parameters({
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number" },
    },
    required: ["query"],
  })
  .executionMode("explicit")
  .handler(async (input, context) => {
    return context.database?.query("catalog_items", input) ?? [];
  })
  .build();
```

Un `ToolDefinition` contient:

- `name`
- `description`
- `parameters` en JSON schema
- `allowedPlans`
- `executionMode`
- `voicePreamble`
- `maxCallsPerSession`
- `execute(input, context)`
- `format(output, channel)`
- `keyFacts(output)`

Le contexte d'execution donne `sessionId`, `tenantId`, `userId`, `channel`,
`planId`, `services`, `database`, et `emit`.

Dans le runtime voix actuel, les tools utilises par `RealtimeVoiceSession` ont
un format runtime plus petit (`VoiceSessionTool`). Le starter convertit les
tools runtime vers le format provider avec `providerTools()` dans
`starters/voip-rtc/server/providers/realtime-provider-factory.ts`.

## Databases

`DatabaseBuilder` decrit des ressources logiques:

- tables;
- collections;
- vector indexes;
- KV namespaces.

Il ne cree pas une base tout seul. Il dit: "cet agent a besoin de ces
ressources". L'app consommatrice decide ensuite comment appliquer ca.

Dans le starter, la partie database est geree par:

- `DatabasePlannerPort`
- `DatabaseProvisionerPort`
- `PostgresAgentDatabaseProvisioner`
- `PostgresPgVectorKnowledgeStore`

## Store Securise

Le store est une couche declarative pour manipuler des donnees sans exposer
tout l'adapter DB au code applicatif.

Fichiers:

- `src/sdk/types/store.ts`
- `src/sdk/store/builders.ts`
- `src/sdk/store/repository.ts`
- `src/sdk/store/validation.ts`

Exemple mental:

```ts
const store = createStoreBuilder("crm")
  .entity("contacts", (entity) => {
    entity
      .field("name", "string")
      .field("email", "string")
      .tenantScoped("tenantId")
      .operations(["get", "list", "create", "update"])
      .filterable(["tenantId", "email"])
      .sortable(["email"])
      .maxPageSize(50);
  })
  .build();
```

Ensuite `createSafeRepository(entity, adapter)` applique les garde-fous:

- injecte automatiquement le scope tenant/user;
- refuse une operation non declaree;
- refuse les filtres non autorises;
- refuse les tris non autorises;
- limite `limit` a `maxPageSize`;
- refuse les champs de creation/update non autorises;
- verifie les champs requis.

Le store ne remplace pas ta DB. Il entoure ton adapter DB avec un contrat plus
strict.

## Ports Et Adapters

Les ports sont des interfaces que le SDK attend, sans choisir le fournisseur.

Fichier: `src/sdk/types/ports.ts`.

| Port | Role |
| --- | --- |
| `PromptPlannerPort` | Cree un plan de prompt, un plan knowledge, puis compose le prompt final. |
| `KnowledgeResearchPort` | Fait grossir la base de connaissance avec de la recherche. |
| `DatabasePlannerPort` | Produit un plan DB a partir du draft et des documents. |
| `EmbeddingPort` | Transforme des textes en vecteurs. |
| `KnowledgeStorePort` | Compile documents, chunks et embeddings dans un store. |
| `KnowledgeSearchPort` | Recherche dans la knowledge base compilee. |
| `DatabaseProvisionerPort` | Valide et applique un plan DB. |
| `DocumentIngestionPort` | Parse un fichier/document en `KnowledgeDocument`. |

Dans `starters/voip-rtc/server/builder/composition.ts`, ces ports sont branches
avec des adapters concrets:

- `DeepSeekPromptPlanner`
- `DeepSeekKnowledgeResearch`
- `VoyageEmbeddingPort`
- `PlainTextDocumentIngestion`
- `PostgresPgVectorKnowledgeStore`
- `PostgresAgentDatabaseProvisioner`

C'est le pattern principal du projet: le SDK definit les ports, le starter ou
l'app produit choisit les adapters.

## Draft Builder

Le builder UI ne cree pas directement une session voix. Il cree d'abord un
draft.

Type: `AgentBuildDraft` dans `src/sdk/types/draft.ts`.

Un draft contient:

- `id`
- `status`
- `identity`
- `promptPlan`
- `knowledgePlan`
- `databasePlan`
- `toolRegistry`
- `selectedTools`
- `promptParts`
- `compiled`
- timestamps
- metadata

Le statut suit ces grandes etapes:

```text
draft
  -> prompt-planned
  -> knowledge-planned
  -> database-planned
  -> database-applied
  -> knowledge-compiled
  -> compiled
```

Le SDK impose au minimum:

- `publicAgentName` obligatoire;
- `intent` obligatoire;
- noms de tools uniques dans le registry.

## Le "Goal" Du Builder

Il n'existe pas de route ou commande `/set goal` dans ce repo.

Le "goal" correspond au champ:

```ts
identity.intent
```

Dans le starter, il est affiche comme `Main intent`. Le flux exact est documente
dans `docs/architecture/builder-intent-flow.md`.

Version courte:

```text
Main intent UI
  -> BuilderIdentity.intent
  -> POST /builder/prompt-plan
  -> normalizeIdentity()
  -> AgentBuildDraft.identity.intent
  -> PromptBuildPlan.promptPart1
  -> CompiledAgentArtifact.prompt
  -> provider realtime instructions
```

## Domain Packs

Un `DomainPack` est un paquet metier reutilisable:

- onboarding;
- prompts;
- tools;
- database;
- stores;
- plans;
- services.

Convention d'exemple: un pack metier peut vivre sous
`examples/packs/<domain>/index.ts` lorsqu'il est ajoute au repo.

Le core ne doit pas contenir de logique metier. Les packs vivent dans
`examples`, dans un starter, ou dans l'app consommatrice.

## Diagnostics AgentRx

La partie diagnostics vit dans `src/sdk/diagnostics`.

Elle sert a decrire une trajectoire agentique:

- steps;
- contraintes;
- violations;
- rapport final;
- statut `healthy`, `watch`, ou `failed`.

Le starter a une visualisation derivee dans `starters/voip-rtc/src/domain/builder/agent-rx.ts`.

## Runtime Serveur Voix

Le runtime serveur vit dans `src/server`.

Il ne connait pas le builder UI. Il execute une session voix avec un provider
realtime.

Les blocs importants:

| Bloc | Fichiers |
| --- | --- |
| Sessions | `src/server/agent/sessions` |
| Transports/providers | `src/server/agent/transports` |
| Types runtime | `src/server/agent/types` |
| Media handlers | `src/server/agent/handlers` |
| Utils audio | `src/server/agent/utils` |
| Browser voice service | `src/server/browser/voice-service` |

### `RealtimeVoiceSession`

Fichier: `src/server/agent/sessions/voice-session.ts`.

Elle orchestre:

```text
start()
  -> provider.connect()
  -> state active
  -> state listening

handleAudio(buffer)
  -> provider.sendAudio(...)

provider.onAudio(...)
  -> callbacks.onAudioOutput(...)

provider.onTranscript(...)
  -> callbacks.onTranscript(...)

provider.onFunctionCall(...)
  -> execute tool
  -> provider.submitFunctionResult(...)

end()
  -> provider.disconnect()
  -> callbacks.onEnded(summary)
```

Elle s'appuie sur `SessionStateMachine`.

Etats principaux:

```text
initializing -> connecting -> active -> listening
listening <-> speaking
processing -> processing_tool -> active
interrupted -> listening/active
ending -> ended
error -> ending/fatal_error
```

### Interface Provider Realtime

`IRealtimeProvider` est le contrat commun pour les providers audio realtime.

Il expose:

- `connect()`
- `disconnect()`
- `sendAudio(chunk)`
- `updateSession(config)`
- `createResponse()`
- `cancelResponse()`
- `submitFunctionResult(...)`
- callbacks audio, transcript, speech, response, function call, error

Les transports existants:

- OpenAI Realtime
- Gemini Realtime/Live
- Grok Realtime
- Cascaded STT/LLM/TTS/VAD
- Twilio Voice/SMS
- OpenAI Chat

## Browser Voice Service

Fichier: `src/server/browser/voice-service/service.ts`.

Ce service transforme une websocket navigateur en session voix serveur.

Flux:

```text
Browser websocket message
  -> BrowserVoiceService.handleBrowserStream()
  -> session.start
  -> createSession(request, callbacks)
  -> createBrowserMediaHandler()
  -> session.start()
  -> mediaHandler.start()
```

Pour l'audio:

```text
Browser binary PCM16
  -> BrowserMediaHandler
  -> AGC/noise gate/RNNoise optionnel
  -> sample-rate adaptation
  -> session.handleAudio()
  -> provider.sendAudio()
```

Pour la sortie:

```text
provider audio
  -> session callback onAudioOutput
  -> BrowserMediaHandler.handleLLMAudio()
  -> websocket binary vers browser
```

Le service envoie aussi des messages JSON au navigateur:

- `session.started`
- `session.ended`
- `session.error`
- `state.change`
- `transcript`
- `tool.call`
- `tool.result`

## Client Browser

Import:

```ts
import { createBrowserVoiceSessionClient } from "@voiceagentsdk/core/client/browser";
```

Le client fait trois choses:

1. ouvre la websocket;
2. capture le micro avec AudioWorklet;
3. joue l'audio retour avec AudioWorklet.

Dans `BrowserVoiceSessionClient.connect()`:

```text
check support
  -> create microphone audio nodes
  -> open websocket
  -> send { type: "session.start", provider, model, voice, agent }
  -> stream audio binary
```

Il maintient un snapshot:

- `state`
- `sessionId`
- `transcript`
- `toolCalls`
- `durationMs`
- `isMuted`
- `outputLevel`
- `error`

## Starter VOIP RTC

Le starter est dans `starters/voip-rtc`.

Il est important parce qu'il montre l'orchestration complete:

```text
server/index.ts
  -> createProviderCatalog()
  -> resolveDefaultProviderId()
  -> createStarterSdk()
  -> createBuilderServiceFromEnv()
  -> createStarterVoiceService()
  -> Bun.serve()
```

Routes exposees:

- `GET /health`
- `GET /config`
- `GET /voice/ws`
- `GET /builder/config`
- `GET /builder/session`
- `GET /builder/agents`
- `GET /builder/drafts/:draftId`
- `POST /builder/prompt-plan`
- `POST /builder/prompt-clarifications`
- `POST /builder/ingest-document`
- `POST /builder/run-research`
- `POST /builder/autonomous-knowledge`
- `POST /builder/knowledge-plan`
- `POST /builder/database-plan`
- `POST /builder/apply-database`
- `POST /builder/compile-knowledge`
- `POST /builder/compile-agent`
- `POST /builder/session`

## Orchestration Builder

Le parcours builder complet:

```text
1. UI Identity + Intent
   -> POST /builder/prompt-plan
   -> normalizeIdentity()
   -> create AgentBuildDraft
   -> planner.createPromptPlan()
   -> save draft

2. Clarifications prompt
   -> POST /builder/prompt-clarifications
   -> promptPlanWithClarifications()
   -> save draft

3. Documents
   -> POST /builder/ingest-document
   -> DocumentIngestionPort.parse()
   -> KnowledgeDocument

4. Research ou knowledge plan
   -> KnowledgeResearchPort.growKnowledge()
   -> PromptPlannerPort.createKnowledgePlan()

5. Database plan
   -> DatabasePlannerPort.createDatabasePlan()
   -> DatabaseProvisionerPort.validate()

6. Apply database
   -> DatabaseProvisionerPort.apply()

7. Compile knowledge
   -> chunkDocuments()
   -> EmbeddingPort.embed()
   -> KnowledgeStorePort.compile()

8. Compile agent
   -> PromptPlannerPort.composeFinalPrompt()
   -> compileArtifact()
   -> save draft compiled
   -> setActiveDraft()
```

Le starter persiste les drafts dans:

```text
.builder-state/drafts.json
.builder-state/session.json
```

Cette persistence est propre au starter. Ce n'est pas une obligation du SDK.

## Orchestration Runtime Voice

Quand l'utilisateur lance une session RTC:

```text
React RtcLab
  -> useRtcLab().startRtc()
  -> BrowserVoiceSessionClient.connect({ provider, model, voice, agent })
  -> websocket /voice/ws
  -> BrowserVoiceService.startSession()
  -> createStarterVoiceService().createSession()
  -> resolveProviderDefinition()
  -> runtimeProvider()
  -> toolsForRequest()
  -> instructionsForRequest()
  -> createProvider()
  -> createRealtimeVoiceSession()
  -> session.start()
```

`instructionsForRequest()` choisit le prompt:

1. si un `agent` compile est fourni, prendre `compiled.prompt`;
2. si l'agent a une knowledge base compilee, ajouter la policy runtime
   `search_knowledge`;
3. sinon utiliser le prompt de base du starter via `sdk.promptFor({ channel:
   "voice" })`.

Donc le runtime voix ne reconstruit pas l'agent. Il consomme le prompt compile.

## Orchestration Tool Call

Quand le modele appelle un tool:

```text
provider function_call
  -> RealtimeVoiceSession.handleFunctionCall()
  -> parse JSON arguments
  -> callbacks.onToolCall(pending)
  -> find tool by name
  -> tool.execute(args, context)
  -> provider.submitFunctionResult(callId, result, true)
  -> callbacks.onToolCall(completed)
```

Si le tool est absent:

```text
Unknown tool
  -> submitFunctionResult({ error }, true)
  -> tool call failed
```

## Orchestration Knowledge

Le chemin knowledge dans le starter:

```text
Documents
  -> DocumentIngestionPort.parse()
  -> KnowledgeDocument[]
  -> createKnowledgePlan()
  -> createDatabasePlan()
  -> applyDatabase()
  -> chunkDocuments()
  -> EmbeddingPort.embed()
  -> KnowledgeStorePort.compile()
  -> compiled artifact knowledge metadata
  -> runtimeKnowledgeTools()
  -> search_knowledge tool
  -> KnowledgeSearchPort.search()
```

Le runtime n'interroge la knowledge base que si:

- un agent compile existe;
- la knowledge search est configuree;
- l'agent a selectionne `search_knowledge` ou son alias legacy;
- la knowledge base est compilee.

## Ajouter Une Feature

### Ajouter Un Provider Realtime

1. Ajouter ou implementer un transport compatible `IRealtimeProvider` dans
   `src/server/agent/transports`.
2. Exporter le transport dans `src/server/agent/transports/index.ts`.
3. Ajouter le provider au catalog du starter si besoin:
   `starters/voip-rtc/server/providers/catalog-factory.ts`.
4. Brancher la creation dans `createProvider()`:
   `starters/voip-rtc/server/providers/realtime-provider-factory.ts`.
5. Verifier sample rates, model, voice, env vars.

### Ajouter Un Tool Metier

Deux chemins existent:

- Tool SDK declaratif: `createToolBuilder()` dans un domain pack.
- Tool runtime voix: `VoiceSessionTool` donne a `createRealtimeVoiceSession()`.

Dans le starter actuel, les tools runtime knowledge sont dans:

- `starters/voip-rtc/server/runtime/knowledge-tools.ts`
- `starters/voip-rtc/server/builder/catalog.ts`

Si le modele doit appeler le tool pendant la voix, il faut que le tool existe
dans la liste envoyee au provider.

### Ajouter Une Route Builder

1. Ajouter une methode dans `createBuilderWorkflows()`.
2. Ajouter le mapping dans `createBuilderRouter()`.
3. Ajouter la fonction client dans `starters/voip-rtc/src/api/builderApi.ts`.
4. Brancher le hook React si necessaire.

### Ajouter Une Vraie Commande `/set goal`

Elle n'existe pas aujourd'hui. Pour l'ajouter proprement:

1. choisir le canal: UI builder, chat, SMS ou voix;
2. ajouter un parser de commande dans le canal choisi;
3. mapper `/set goal ...` vers une mutation de draft ou une nouvelle route;
4. reutiliser `identity.intent` comme champ canonique;
5. recompiler le prompt si l'agent etait deja compile.

Ne pas creer un second champ `goal` sans raison: cela dupliquerait
`identity.intent`.

## Ce Qui Est Dans Le Core Et Ce Qui Ne L'est Pas

Dans le core:

- types SDK;
- builders;
- compiler declaratif;
- ports;
- store securise;
- runtime voix;
- transports/provider interfaces;
- media handlers;
- client browser audio.

Hors core:

- prompts metier;
- schemas metier;
- routes produit;
- auth produit;
- persistence produit;
- choix de provider/env;
- provisioning DB reel;
- UI finale;
- observabilite produit.

Cette frontiere est volontaire. Elle evite de melanger le SDK reusable avec un
produit specifique.

## Commandes Utiles

Depuis la racine:

```bash
pnpm typecheck:sdk
pnpm typecheck:examples
pnpm typecheck:starters
pnpm audit:sdk-boundary
pnpm audit:imports
pnpm build
pnpm pack --dry-run --json
```

Starter VOIP RTC:

```bash
cp starters/voip-rtc/.env.example starters/voip-rtc/.env
pnpm dev:voip-rtc
```

Tests/harness utiles:

```bash
pnpm harness:route-wines
pnpm test:knowledge-tool
pnpm test:runtime-tool-call
pnpm test:rtc-e2e
```

## Env Vars Importantes Du Starter

Realtime:

- `DEFAULT_REALTIME_PROVIDER`
- `GEMINI_API_KEY`
- `GEMINI_REALTIME_MODEL`
- `GEMINI_REALTIME_VOICE`
- `OPENAI_API_KEY`
- `OPENAI_REALTIME_MODEL`
- `OPENAI_REALTIME_VOICE`

Builder:

- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_MAX_RETRIES`
- `BUILDER_RESEARCH_PROVIDER`
- `BUILDER_RESEARCH_MODEL`
- `VOYAGE_API_KEY`
- `VOYAGE_EMBEDDING_MODEL`
- `VOYAGE_EMBEDDING_DIMENSIONS`
- `DATABASE_URL`

## Pieges A Eviter

- Ne pas modifier `dist` a la main. Modifier `src` puis builder.
- Ne pas mettre de logique metier dans `src`. Utiliser packs, starters ou app
  consommatrice.
- Ne pas confondre `ToolDefinition` SDK et `VoiceSessionTool` runtime.
- Ne pas supposer que `DatabaseBuilder` applique une migration. Il decrit, le
  provisioner applique.
- Ne pas supposer que le runtime voix connait le builder. Il recoit seulement
  des instructions, des tools et un provider.
- Ne pas inventer un champ `goal`: le champ canonique est `identity.intent`.
- Ne pas utiliser l'adapter Fastify comme production-ready: il jette
  volontairement une erreur pour l'instant.

## Carte Rapide Des Fichiers

```text
src/sdk/index.ts
  -> exports SDK publics

src/sdk/types/core.ts
  -> definition declarative principale

src/sdk/runtime.ts
  -> compileVoiceAgentSdk()

src/sdk/builders/*
  -> builders Agent, Tool, Database, Draft

src/sdk/store/*
  -> store builder, repository safe, validation

src/sdk/types/ports.ts
  -> interfaces pour planners, embeddings, knowledge, DB, ingestion

src/server/index.ts
  -> exports runtime serveur

src/server/agent/sessions/voice-session.ts
  -> orchestration session realtime

src/server/browser/voice-service/service.ts
  -> websocket browser vers session voix

src/client/browser/session/client.ts
  -> client browser audio/websocket

starters/voip-rtc/server/index.ts
  -> serveur Bun, routes config/builder/voice

starters/voip-rtc/server/providers/realtime-provider-factory.ts
  -> glue starter entre SDK compile, provider catalog et runtime voix

starters/voip-rtc/server/builder/workflows.ts
  -> orchestration builder complete

starters/voip-rtc/server/builder/composition.ts
  -> choix des adapters concrets depuis env
```

## Lecture Recommandee

1. `README.md`
2. `docs/architecture/sdk/README.md` (ce fichier)
3. `docs/architecture/builder-intent-flow.md`
4. `docs/architecture/server-runtime-manifest.md`
5. `docs/architecture/migration-to-builder-sdk.md`
6. `starters/voip-rtc/README.md`
7. `examples/` pour les packs applicatifs optionnels
