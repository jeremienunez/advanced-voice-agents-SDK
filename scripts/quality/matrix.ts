export type QualityGroup =
  | "audits"
  | "typechecks"
  | "core-bdd"
  | "starter-bdd"
  | "protocol-bdd"
  | "package"
  | "e2e";

export interface QualityStep {
  group: QualityGroup;
  command: string;
}

export const qualityMatrix: Record<QualityGroup, string[]> = {
  audits: [
    "audit:architecture",
    "audit:responsibility",
    "audit:loc",
    "audit:secrets",
    "audit:public-api",
    "audit:sdk-type-domains",
    "audit:sdk-type-imports",
    "audit:sdk-boundary",
    "audit:imports",
    "audit:tool-contracts",
  ],
  typechecks: [
    "typecheck:sdk",
    "typecheck:starters",
  ],
  "core-bdd": [
    "test:secret-hygiene:bdd",
    "test:log-redaction:bdd",
    "test:debug-audio:bdd",
    "test:adaptive-learning-loop:bdd",
    "test:fastify-voice-adapter:bdd",
    "test:public-boundaries:bdd",
    "test:protocol-mailbox:bdd",
    "test:agent-mailbox-worker:bdd",
    "test:package-metadata:bdd",
    "test:agentrx-diagnostics:bdd",
  ],
  "starter-bdd": [
    "test:solid-seams",
    "test:llm-harness",
    "test:infra-runner:bdd",
    "test:infra-evolution-approval:bdd",
    "test:runtime-db-credentials:bdd",
    "test:secret-resolver:bdd",
    "test:tenant-resolver:bdd",
    "test:adapter-boundaries:bdd",
    "test:temporal-worker:bdd",
    "test:redis-memory:bdd",
    "test:graph-memory-adapters:bdd",
    "test:tool-contracts:bdd",
    "test:tool-registry-adapter:bdd",
    "test:prompt-policy:bdd",
    "test:learning-preserves-server-policy:bdd",
    "test:model-cannot-self-confirm-tool:bdd",
    "test:pending-action-approval:bdd",
    "test:pending-action-expiry-quota:bdd",
    "test:tool-execution-policy-engine:bdd",
    "test:starter-production-mode:bdd",
    "test:prompt-compiler-port:bdd",
    "test:event-sink-logger-port:bdd",
    "test:memory-store-port:bdd",
    "test:provider-factory:bdd",
    "test:media-bridge-factory:bdd",
    "test:db-adapter-registry:bdd",
    "test:store-adapter-contracts:bdd",
    "test:runtime-tool-authorization:bdd",
    "test:active-agent-assignment:bdd",
    "test:learning-active-assignment-scope:bdd",
    "test:builder-draft-ownership:bdd",
    "test:builder-route-ownership:bdd",
    "test:builder-session-filtering:bdd",
    "test:document-ingestion:bdd",
    "test:database-provisioning",
  ],
  "protocol-bdd": [
    "test:a2a-mailbox-router:bdd",
    "test:a2a-mailbox-mcp-tools:bdd",
    "test:a2a-json-rpc-adapter:bdd",
    "test:mcp-tool-adapter:bdd",
    "test:mcp-json-rpc-adapter:bdd",
    "test:mcp-streamable-http-adapter:bdd",
    "test:a2a-mailbox-routes:bdd",
    "test:mcp-routes:bdd",
  ],
  package: [
    "pack:dry-run",
  ],
  e2e: [
    "test:rtc-e2e",
  ],
};

export const qualitySuites = {
  solid: [
    "audits",
    "typechecks",
    "starter-bdd",
    "core-bdd",
    "protocol-bdd",
    "e2e",
  ],
} satisfies Record<string, QualityGroup[]>;

export function stepsForSuite(suite: keyof typeof qualitySuites): QualityStep[] {
  return qualitySuites[suite].flatMap((group) => {
    return qualityMatrix[group].map((command) => ({ group, command }));
  });
}
