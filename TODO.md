# TODO refondu - objectif package Node/npm

Objectif courant: publier `@voiceagentsdk/core` comme package Node/npm open-source alpha.

Position produit:

- Le SDK core fournit des primitives, des types, des ports et un runtime voice.
- Le starter VOIP RTC reste une demo locale et une reference d'integration.
- L'auth, les comptes utilisateurs, les tenants, le billing, la compliance, les secrets et le stockage production sont app-owned.
- Les integrations production branchent leurs propres adapters via les ports du SDK.

## Non-objectifs SDK core

Ne pas transformer le SDK en produit SaaS complet:

- pas de provider OAuth/JWT impose;
- pas de gestion utilisateurs;
- pas de base tenants imposee;
- pas de stockage production impose;
- pas de secret manager impose;
- pas de billing/compliance;
- pas d'ownership multi-tenant impose dans le runtime core.

## P0 - Bloquant avant publication npm alpha

### P0-001 - Finaliser les metadonnees npm

Statut: ferme pour alpha `0.1.0-alpha.1`.

Action:

- `"private": true` retire.
- `license`, `repository`, `bugs`, `homepage` et `publishConfig.access` ajoutes.
- `files` limite au package core attendu: `dist`, README, changelog, TODO, license.
- `test:package-metadata:bdd` verrouille ces invariants.

Validation:

- `pnpm build`
- `pnpm pack:dry-run`
- inspecter le tarball dry-run.

### P0-002 - Verrouiller les exports publics

Statut: ferme pour alpha.

Action:

- Garder les entrypoints publics stables:
  - `.`
  - `./sdk`
  - `./server`
  - `./server/browser`
  - `./server/providers`
  - `./server/media`
  - `./server/adapters/fastify`
  - `./client/browser`
- S'assurer que les types publics necessaires sont exportes.
- Eviter toute dependance starter dans le package core.

Validation:

- `pnpm test:public-boundaries:bdd`
- `pnpm typecheck:sdk`
- consumer fixture TypeScript minimal si besoin.

### P0-003 - Garder les invariants de securite deja fermes

Statut: ferme et couvert par `audit:solid`.

Ces points restent P0 car ils ne dependent pas d'une auth proprietaire:

- server-owned prompt policy reste suffix final apres learning;
- modele ne peut pas confirmer lui-meme une action tool;
- `ToolExecutionPolicyEngine` applique schema basique, timeout, quotas, confirmation, side effects, audit et redaction;
- starter production mode refuse les fallbacks dev silencieux.

Validation:

- `pnpm test:learning-preserves-server-policy:bdd`
- `pnpm test:model-cannot-self-confirm-tool:bdd`
- `pnpm test:pending-action-approval:bdd`
- `pnpm test:pending-action-expiry-quota:bdd`
- `pnpm test:tool-execution-policy-engine:bdd`
- `pnpm test:starter-production-mode:bdd`

### P0-004 - CI visible pour package alpha

Statut: ferme.

Action:

- Garder `.github/workflows/ci.yml`.
- Executer au minimum:
  - install;
  - build;
  - `audit:solid`;
  - `pack:dry-run`.

Validation:

- CI verte sur `main` et PR.

### P0-005 - README alpha clair

Statut: ferme pour alpha.

Action:

- Section installation npm ajoutee:
  - `pnpm add @voiceagentsdk/core`;
  - exemple minimal import SDK;
  - exemple minimal server/browser.
- Clarifier que la readiness production depend des adapters downstream.
- Garder la section "What this SDK intentionally does not own".
- Clarifier que le starter local/demo n'est pas une application multi-tenant production telle quelle.

Validation:

- README relu contre les claims reels.
- Aucun claim "starter production-ready out of the box".

## P1 - Publication alpha propre

### P1-000 - Adaptive Agent Learning Loop

Statut:

- Public SDK contracts: profiles, run records, repository, workflow, extractor, policy, status.
- Embedded implementation: in-memory run repository and local orchestrator.
- Starter integration: default `auto_apply_prompt_safe` demo profile.
- Distributed readiness: worker terminal status updates through shared run repository.
- UI proof: RTC learning timeline and Agent Bank version/audit visibility.

### P1-001 - Release workflow

Statut: ferme pour alpha.

Action:

- Strategie choisie: `0.1.0-alpha.x`.
- Procedure release ajoutee dans `RELEASE_ALPHA.md`.
- Optionnel: npm provenance / trusted publishing GitHub Actions.

### P1-002 - Exemples d'integration app-owned

Statut: ferme pour alpha docs.

Action:

- Ajouter des exemples docs ou `examples/`:
  - no-auth local;
  - `AuthTicketPort` avec JWT;
  - one-time WebSocket ticket;
  - custom enterprise session;
  - Fastify adapter minimal;
  - pending action approval flow;
  - custom secret resolver.

But:

- Montrer comment une app branche ses politiques sans que le SDK impose son auth.

### P1-003 - Documentation ports/adapters

Statut: ferme pour alpha docs.

Action:

- Documenter les ports publics principaux:
  - `AuthTicketPort`;
  - `TenantResolverPort`;
  - `SecretResolverPort`;
  - `PromptCompilerPort`;
  - `ProviderFactoryPort`;
  - `MemoryStorePort`;
  - `PendingActionPort`;
  - `ActiveAgentAssignmentPort`;
  - repository/store adapter contracts.

### P1-004 - Matrice Local / Starter / Production integration

Statut: ferme.

Action:

- Garder une matrice explicite:

| Capability | Local demo | Starter integration | Production app |
|---|---|---|---|
| Auth | dev/no-auth | custom `AuthTicketPort` | app-owned |
| Draft state | local file | repository port | durable DB |
| Active agent | global fallback | scoped port | explicit/scoped |
| Tool confirmation | pending action | pending action | app-owned approval UX |
| Learning | local async | Temporal optional | durable workflow |
| Memory | in-memory/local | Redis optional | app-owned Redis/DB |
| Graph | local/Postgres optional | optional graph | app-owned graph |
| Infra apply | plan/dev-local | opt-in | approval workflow |

### P1-005 - Starter production-mode usage guide

Statut: ferme pour alpha docs.

Action:

- Documenter les adapters obligatoires en `VOICE_STARTER_MODE=production`.
- Montrer une factory d'app downstream qui injecte:
  - auth verifier;
  - builder service;
  - learning service;
  - tenant resolver;
  - runtime memory store.

## P2 - Hardening apres alpha

### P2-001 - Agent explicite runtime et ownership

Statut:

- Pas un blocage SDK core.
- Le runtime core ne doit pas imposer l'ownership.
- En production mode, le starter exige deja un `builderService` app-owned: l'autorisation de `request.agent` doit etre appliquee par ce service.

Action optionnelle:

- Documenter: "explicit runtime agent IDs must be authorized by the application-owned builder service".
- Si le starter devient une demo multi-user deployable, ajouter alors:
  - `getCompiledDraftForContext(agentId, context)`;
  - ou `AgentAccessPolicyPort.canUseAgent({ agentId, identity })`.

Priorite:

- P2 documentation/hardening.
- P1 seulement si le starter est presente comme demo multi-tenant deployable.

### P2-002 - Validation JSON Schema plus complete

Statut:

- Le moteur runtime valide aujourd'hui un sous-ensemble utile.
- Suffisant pour alpha si documente.

Action optionnelle:

- Ajouter un validator JSON Schema injectable.
- Ou supporter plus de mots-cles:
  - `additionalProperties`;
  - `minLength`;
  - `maxLength`;
  - `pattern`;
  - `items`;
  - schemas imbriques.

### P2-003 - Pending actions durables

Action:

- Ajouter un adapter durable pour `PendingActionPort`.
- Garder l'in-memory pour local/demo.
- Ajouter cleanup/TTL cote storage durable.

### P2-004 - Playwright smoke en CI

Action:

- Ajouter un smoke browser optionnel sur le starter:
  - Command Center;
  - Builder;
  - Agents;
  - RTC fake provider avec E2E silence;
  - Environment.

Note:

- Pas bloquant pour package core si `audit:solid` et `rtc-e2e` restent verts.

### P2-005 - Release quality polish

Action:

- Ajouter badges README.
- Ajouter API report ou typedoc si utile.
- Ajouter changelog structure.
- Ajouter security policy.
- Ajouter contribution guide.

## Tests gates recommandees

Avant chaque release alpha:

```bash
pnpm audit:solid
pnpm pack:dry-run
```

Avant publication npm:

```bash
pnpm build
pnpm test:public-boundaries:bdd
pnpm pack:dry-run
```

Smoke starter manuel si changement UI/runtime:

```bash
RTC_E2E_FAKE_PROVIDER=1 pnpm dev:voip-rtc
```

Puis verifier dans le navigateur:

- Command Center charge;
- Builder charge;
- Agents charge;
- RTC demarre en `E2E silence`;
- `session.started`, `session.ended`, `learning.status applied`;
- Environment charge;
- pas d'erreurs console.
