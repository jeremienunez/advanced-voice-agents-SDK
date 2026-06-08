# Agnostic Boundary

`src` is the core package boundary. It must stay provider/runtime oriented and
must not embed application-specific business logic.

## Allowed In `src`

- SDK builders, definitions and compilation.
- Server transports and provider protocol types.
- Voice session lifecycle, state, interruption and audio pipeline logic.
- Browser voice protocol/client utilities without product UI.
- Generic adapters/facades with no tenant-specific assumptions.
- Low-level utilities: audio conversion, denoise, gain, echo, ids, logging.

## Not Allowed In `src`

- Product prompts.
- Product tools.
- Product repositories/entities/schemas.
- Product jobs, emails, controllers and routes.
- Fixed tenant defaults or fixed business categories.
- Workspace imports from the source application.

## Required Adapter Ports

- `TenantResolverPort`
- `SecretResolverPort`
- `ProviderFactoryPort`
- `MediaBridgeFactoryPort`
- `ToolRegistryAdapterPort`
- `DbAdapterRegistry`
- `PromptCompilerPort`
- `AuthTicketPort`
- `EventSink` / `LoggerPort`
- `MemoryStore`

The example pack may contain domain vocabulary because it is outside the core
package boundary.
