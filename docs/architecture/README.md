# Architecture Notes

Curated architecture documents live here. They describe stable boundaries,
runtime flows, migration notes, and audit findings that should help a reader
understand the repository without digging through implementation files first.

## Map

- [Agnostic boundary](agnostic-boundary.md): SDK and runtime ownership limits.
- [Builder intent flow](builder-intent-flow.md): how user intent becomes a
  structured builder plan.
- [Extraction manifest](extraction-manifest.md): extracted SDK/server surfaces.
- [Migration to builder SDK](migration-to-builder-sdk.md): migration notes for
  the current builder-oriented SDK shape.
- [A2A and MCP protocol compatibility](protocol-compatibility-a2a-mcp.md):
  protocol mapping and compatibility notes.
- [Server runtime manifest](server-runtime-manifest.md): server runtime
  responsibilities and adapter boundaries.
- [SDK developer README](sdk/README.md): developer-facing SDK notes.
- [Audits](audits/): dated architecture and boundary audit notes.
