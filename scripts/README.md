# Root Scripts Map

Root scripts validate the published package and repository boundaries. They are development tooling only and must not be imported by production source.

- `audits/` contains architecture, dependency, responsibility, LOC, SDK-boundary, tool-contract, and secret-hygiene audits.
- `tests/bdd/` contains root BDD scenarios for public package and runtime contracts.
- `tests/smoke/` contains focused runtime smoke checks.
- `tests/type-contracts/` contains compile-only contract checks.
- `secret-hygiene/` contains the reusable secret-audit implementation.
- `agentrx-diagnostics/` contains shared AgentRx diagnostic metadata for tests and reports.

Keep command names stable in root `package.json`; update paths here when scripts move.
