# Changelog

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
