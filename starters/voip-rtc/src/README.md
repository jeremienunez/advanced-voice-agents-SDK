# Starter Client Map

The client is organized around feature slices with shared UI, API, hooks, and domain code around them.

- `App.tsx` composes the studio shell and active feature.
- `api/` contains HTTP clients, with builder calls split by builder stage.
- `components/` contains shared layout, navigation, UI primitives, and atmosphere visuals. Component-wide CSS lives under each component group's `styles/` folder.
- `domain/app/` contains app shell and navigation models.
- `domain/builder/` contains builder types, defaults, progress, derived state, and AgentRx diagnostics.
- `domain/runtime/` contains RTC runtime config, event logs, and microphone diagnostics.
- `domain/onboarding/` contains onboarding environment and infra action models.
- `domain/shared/` contains cross-feature formatting helpers.
- `features/` contains the main screens: command center, builder, agent bank, RTC lab, hub, and onboarding.
- `hooks/` contains stateful feature orchestration.
- `styles/` contains global design-system and app-wide styles only. Feature CSS lives beside each feature under `features/*/styles/`.

Keep screen-specific UI inside `features/`; move only reusable primitives into `components/`.
