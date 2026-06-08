# Migration To Builder SDK

The first pass created a clean core. The next pass wires the mature runtime to
the declarative SDK through ports instead of product dependencies.

## Next Runtime Ports

1. `TenantResolverPort`
   Resolve tenant/user/plan/provider/media metadata from an inbound channel
   context.

2. `SecretResolverPort`
   Resolve provider and webhook secrets from `SecretRef` values.

3. `ProviderFactoryPort`
   Instantiate OpenAI, Gemini, Grok or cascaded realtime providers from SDK
   provider definitions.

4. `MediaBridgeFactoryPort`
   Normalize Twilio/browser media bridges behind a single runtime contract.

5. `ToolRegistryAdapterPort`
   Convert SDK `ToolDefinition` values into runtime tool processors.

6. `DbAdapterRegistry`
   Bind SDK database definitions to consumer-provided data adapters.

7. Store repository adapters
   Bind `StoreDefinition` entities to safe repositories. The generated
   repository validates scope, allowed operations, allowed filters/sorts and
   writable fields before calling the DB adapter.

8. `PromptCompilerPort`
   Compile prompt sections, tenant variables, channel and plan metadata into
   runtime instructions.

9. `AuthTicketPort`
   Provide browser voice ticket issuance/validation without product auth.

## Builder Responsibility

The SDK remains declarative:

- define providers
- define prompts
- define tools
- define databases
- define onboarding metadata
- compile a `CompiledVoiceAgentSdk`

The consuming app remains responsible for adapters:

- persistence
- auth
- tenant config
- secrets
- observability
- deployment routing
