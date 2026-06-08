# A2A and MCP Protocol Compatibility Research

Date: 2026-06-04

## Objective

Integrate A2A and MCP intelligently into the SDK so downstream applications can
interoperate with agent ecosystems without making the core SDK depend on one
runtime framework, one server adapter, or one protocol package.

## Source Snapshot

- MCP latest specification: https://modelcontextprotocol.io/specification/2025-11-25
- MCP architecture: https://modelcontextprotocol.io/docs/learn/architecture
- MCP tools: https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- MCP transports: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- MCP authorization: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- MCP official SDK list: https://modelcontextprotocol.io/docs/sdk
- MCP TypeScript SDK docs: https://ts.sdk.modelcontextprotocol.io/
- A2A specification: https://a2a-protocol.org/latest/specification/
- A2A protocol definitions: https://a2a-protocol.org/latest/definitions/
- A2A discovery: https://a2a-protocol.org/latest/topics/agent-discovery/
- A2A and MCP comparison: https://a2a-protocol.org/latest/topics/a2a-and-mcp/
- A2A project repository: https://github.com/a2aproject/A2A
- A2A JavaScript SDK repository: https://github.com/a2aproject/a2a-js

Package state checked on 2026-06-04:

- `@modelcontextprotocol/sdk`: npm latest `1.29.0`; official TypeScript SDK is
  Tier 1; peer dependency includes `zod`.
- `@a2a-js/sdk`: npm latest `0.3.13`; `next` is `1.0.0-alpha.0`; published
  latest still targets A2A v0.3 while the A2A spec/repo show v1.0.x.

## Protocol Facts

MCP is a JSON-RPC client/server protocol for connecting an LLM host to tools,
resources, prompts, and related client features such as sampling, elicitation,
logging, and experimental task wrappers. MCP has a data layer and a transport
layer. Current transports are stdio for local processes and Streamable HTTP for
remote servers, with optional SSE for streaming. Tool descriptions and
annotations must be treated as untrusted unless they come from a trusted server.
Sensitive tool calls should keep human confirmation, timeout, audit, input
validation, and result validation in the host/application.

A2A is an agent-to-agent collaboration protocol under the Linux Foundation,
contributed by Google. Its v1.0 model centers on `AgentCard`, `Message`, `Task`,
`Artifact`, and `Part`. Core operations include send message, send streaming
message, get/list/cancel/subscribe task, push notification config operations,
and extended agent card retrieval. Bindings include JSON-RPC over HTTP, gRPC,
and HTTP+JSON/REST. Discovery starts from an Agent Card, commonly via a
well-known URI, curated registry, or private direct configuration.

A2A and MCP are complementary, not substitutes. MCP is best for well-scoped
tools/resources with structured inputs and outputs. A2A is best for autonomous
peer agents that can maintain state, negotiate multi-turn work, and produce
artifacts. A2A agents can expose some simple skills as MCP-style tools, but
stateful collaboration should remain A2A.

## Current SDK Fit

The repository already has the right internal boundaries:

- `src/sdk` owns public contracts and builders.
- `src/server` owns runtime orchestration, sessions, policy, providers, and
  adapter code.
- `src/client/browser` owns browser voice ergonomics.
- `starters/voip-rtc` is a reference integration and can depend on SDK/server
  entrypoints.

Existing SDK contracts map well to MCP:

- `ToolManifest` can become an MCP `Tool` descriptor.
- `parameters` maps to MCP `inputSchema`.
- `outputSchema` maps to MCP output/structured content support.
- `sideEffect`, `executionMode`, `maxCallsPerSession`, and `timeoutMs` map to
  host-side safety policy, not to trusted remote claims.
- `ToolExecutionPolicyEngine` already enforces validation, authorization,
  confirmations, limits, timeouts, audit, and result redaction before handlers
  run.

Existing SDK contracts map partially to A2A:

- `VoiceAgentSdkDefinition`, `DomainPack`, compiled drafts, and active agents
  can produce Agent Card capabilities and skills.
- `VoiceSessionConfig` and session lifecycle states can feed a task executor.
- Learning runs and knowledge compilation can later become artifacts or task
  history, but should not be forced into A2A v1 in the first slice.

## Architecture Decision

1. Keep `src/sdk` protocol-neutral.
   Define small A2A/MCP compatibility types and pure mapping functions, but do
   not import `@modelcontextprotocol/sdk` or `@a2a-js/sdk` from `src/sdk`.

2. Add optional protocol entrypoints after the type boundary exists.
   Runtime adapters should live outside the main SDK facade, for example:
   `@voiceagentsdk/core/server/mcp` and `@voiceagentsdk/core/server/a2a`.

3. Prefer MCP official TypeScript SDK for actual MCP server/client runtime.
   The official SDK is current and supports stdio plus Streamable HTTP. Keep it
   out of the default package path by using a dedicated optional adapter
   entrypoint.

4. Treat A2A JS v1 as not stable enough for a hard dependency today.
   Build an internal A2A v1-compatible card/task/request boundary first. The
   official JS SDK can be used behind an adapter after its v1 line is stable.

5. Never let protocol import bypass SDK policy.
   Remote MCP tools and remote A2A skills must enter as manifests plus adapter
   refs. Runtime execution must still go through authorization, scope checks,
   pending confirmations, audit logging, redaction, and timeout controls.

6. Version every protocol surface explicitly.
   Persist supported MCP protocol versions and A2A protocol versions in
   compatibility metadata. Reject unknown required extensions rather than
   silently degrading.

## Initial Integration Slices

### Slice 1: Protocol Compatibility Types

Add protocol-neutral SDK types for:

- MCP tool descriptor compatibility.
- A2A Agent Card compatibility.
- A2A task state mapping.
- Protocol version metadata.

This slice should only add pure types and mapping functions plus BDD coverage.

### Slice 2: MCP Tool Export

Map `ToolManifest` arrays to MCP `tools/list` descriptors and execute calls
through existing `ToolExecutionPolicyEngine`. This makes the SDK able to expose
its tools to MCP hosts without changing model-provider code.

### Slice 3: MCP Tool Import

Represent trusted remote MCP tools as SDK `ToolManifest` objects with
`handlerRef` values that route through an MCP client adapter. This preserves the
existing tool registry and policy engine.

### Slice 4: A2A Agent Card Export

Generate an A2A v1 Agent Card from compiled agent metadata, selected tools,
knowledge state, provider/channel support, and app-owned auth metadata. Keep
extended card access behind app-owned auth.

### Slice 5: A2A Task Adapter

Expose a task executor that maps A2A `message/send` and streaming updates onto
SDK runtime sessions. The first production-safe scope should support text/chat
tasks. Voice streaming and media negotiation can come later because A2A v1
roadmap still mentions dynamic UX/media negotiation as future work.

## Security Requirements

- All imported tool/skill descriptions are untrusted prompt input.
- Unknown protocol extensions are rejected unless explicitly configured as
  optional.
- Remote MCP STDIO servers are never spawned by default from model output.
- HTTP protocol adapters must use app-owned auth and tenant resolution.
- Destructive or external-action tools keep confirmation even when invoked by an
  MCP host or A2A peer.
- Protocol logs must use existing redaction rules.

## Deferred Items

- A2A gRPC binding.
- A2A push notification config persistence.
- Full OAuth client implementation inside core.
- Automatic public registry publication.
- Voice/video dynamic media negotiation over A2A.
