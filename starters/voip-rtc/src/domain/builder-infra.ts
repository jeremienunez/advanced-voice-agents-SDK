export interface AgentInfraPlan {
  id: string;
  draftId: string;
  status: string;
  computeTarget: string;
  isolation: string;
  provisioningMode: string;
  defaultBackendId: string;
  database: {
    id: string;
    provider: string;
    configured: boolean;
    namespace: string;
    schemaName?: string;
    reason: string;
  };
  knowledgeBackends: Array<{
    id: string;
    provider: string;
    role: string;
    configured: boolean;
    namespace: string;
    required: boolean;
    capabilities: string[];
    reason: string;
  }>;
  iac?: {
    id: string;
    target: string;
    applyMode: string;
    generatedAt: string;
    artifacts: Array<{
      path: string;
      kind: string;
      dialect: string;
      contentType: string;
      sensitive: boolean;
      description: string;
    }>;
    notes: string[];
    warnings?: string[];
  };
  storePlan?: {
    enabled: boolean;
    scopes: string[];
    createOn: string;
    temporalWorkflow: AgentLearningStoreBackendPlan;
    temporalMemory: AgentLearningStoreBackendPlan;
    graphMemory: AgentLearningStoreBackendPlan;
    auditStore: AgentLearningStoreBackendPlan;
    vectorBackend?: AgentLearningStoreBackendPlan;
    guardrails: {
      appendOnlyVersions: boolean;
      rollbackPointer: boolean;
      auditEveryChange: boolean;
      redactSecrets: boolean;
      destructiveInfraMigrations: string;
    };
    reasons: string[];
    warnings?: string[];
  };
  reasons: string[];
  warnings?: string[];
}

export interface AgentLearningStoreBackendPlan {
  id: string;
  kind: string;
  provider: string;
  configured: boolean;
  required: boolean;
  namespace: string;
  createOn: string;
  capabilities: string[];
  reason: string;
  requiredEnv?: string[];
  ttlSeconds?: number;
}
