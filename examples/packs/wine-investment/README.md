# Wine Investment Pack Example

Ce pack montre la destination du metier extrait du produit source.

Il ne fait pas partie du core SDK. Il represente ce que l'onboarding UI, le tool
creator et le db creator doivent produire:

- `onboarding`: questions pour parametrer le domaine
- `prompts`: sections de prompt injectees dans l'agent
- `tools`: outils metier avec handlers injectables
- `database`: resources attendues par les tools
- `plans`: niveaux d'acces propres au produit client

La prochaine etape consiste a migrer progressivement:

- `search-wines.ts` -> `search_catalog`
- `search-cave.ts` -> `search_collection`
- `get-pairing.ts` -> tool de recommandation
- `investment-*.ts` -> tools `market`, `portfolio`, `watchlist`
- prompts sommelier/investment -> `PromptSection[]`
- `src/agent/db-client/**` -> adapter `DomainDataAdapter`
