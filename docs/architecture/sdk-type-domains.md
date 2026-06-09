# SDK Type Domains

`src/sdk/types.ts` remains the stable SDK type facade. The detailed contracts
live under `src/sdk/types/` and the broad domains use short root facades plus
nested files:

- `core/`: ids, foundation definitions, data contracts, tools, and packs.
- `infra/`: base infra primitives, ownership, backends, learning stores,
  policies, and final plans.
- `learning/`: session input, workflow status, temporal memory, graph memory,
  and evolution contracts.
- `learning-loop/`: promotion decisions, artifacts, run records, receipts,
  extracted signals, and orchestration ports.
- `runtime-ports/`: runtime adapter contracts for secrets, providers, memory,
  tenant resolution, prompts, events, pending actions, assignment, and media.
- `ports/`: builder-time planner, LLM, knowledge, backend, tool registry, and
  knowledge store ports.

The root files such as `core.ts`, `infra.ts`, and `ports.ts` intentionally stay
as compatibility facades for existing imports like `./types/core.js`.

`pnpm audit:sdk-type-domains` keeps the broad root domains as short facades and
prevents individual contract files from growing back into mixed catch-all files.
