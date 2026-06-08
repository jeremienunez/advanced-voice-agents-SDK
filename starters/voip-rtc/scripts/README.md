# Starter Scripts Map

The starter keeps command names stable in `package.json`; this folder only controls where implementations live.

- `dev/` contains local development entrypoints.
- `infra/` contains provisioning, policy, runtime, and onboarding helpers.
- `harnesses/route-wines/` contains the Route des Vins AgentRx harness.
- `tests/bdd/` contains behavior tests.
- `tests/integration/` contains integration-style starter checks.
- `tests/e2e/` contains browser and RTC end-to-end checks.
- `tests/shared/` contains shared script assertions and environment helpers.
- `tests/fixtures/` contains fixture builders for learning, LLM, and SOLID seam checks.

If a script is invoked by `package.json`, keep the command name stable and update only the path.
