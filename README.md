# Voice Agent SDK

Base SDK agnostique pour agents conversationnels voix. Le coeur publie une
surface declarative, un runtime serveur voix/media/provides, et un client
browser voice sans UI produit.

## Structure

- `src/sdk`: builders, types et compilation declarative du SDK.
- `src/server`: runtime serveur agnostique VOIP/RTC/provider/media conserve
  depuis la logique mature.
- `src/client/browser`: client WebSocket/audio browser voice.
- `starters/voip-rtc`: starter reutilisable Bun + React/Vite pour projets
  VOIP RTC.
- `examples/packs/wine-investment`: exemple de pack metier hors core.

## Store Builder

`createStoreBuilder()` decrit des entites de donnees et leurs policies:
scope tenant/user, operations autorisees, champs filtrables, triables,
creables et modifiables. `createSafeRepository()` transforme ensuite une
entite en repository borne par contrat: il injecte le scope, limite les pages,
et refuse les champs ou operations non declares avant d'appeler l'adapter DB.

## Public Exports

- `@voiceagentsdk/core`
- `@voiceagentsdk/core/sdk`
- `@voiceagentsdk/core/server`
- `@voiceagentsdk/core/server/adapters/fastify`
- `@voiceagentsdk/core/server/providers`
- `@voiceagentsdk/core/server/media`
- `@voiceagentsdk/core/server/browser`
- `@voiceagentsdk/core/client/browser`

## Commands

```bash
pnpm typecheck:sdk
pnpm typecheck:examples
pnpm typecheck:starters
pnpm audit:sdk-boundary
pnpm audit:imports
pnpm build
pnpm pack --dry-run --json
```

## VOIP RTC Starter

Le starter `starters/voip-rtc` est le premier kit reutilisable pour projets
voix:

```bash
cp starters/voip-rtc/.env.example starters/voip-rtc/.env
pnpm dev:voip-rtc
```

Il lance un serveur Bun WebSocket et un client React/Vite autour des exports
publics du package.

## Boundary

Le dossier `src` ne doit pas contenir de logique produit. Les noms, prompts,
tools, schemas et repositories metier restent dans des packs, des exemples ou
des repos consommateurs. Le core garde uniquement les primitives SDK,
transports, sessions, handlers media, types provider/session/event, et utils
audio.
