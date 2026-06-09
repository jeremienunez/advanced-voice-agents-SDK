import type {
  DatabaseBackendPlan,
  KnowledgeBackendPlan,
} from "../infra/index.js";
import type { InfraPlanRequest } from "./planning.js";

export interface DatabaseBackendResolverPort {
  resolveDatabaseBackend(input: InfraPlanRequest): DatabaseBackendPlan;
}

export interface KnowledgeBackendResolveResult {
  defaultBackendId: string;
  backends: KnowledgeBackendPlan[];
  reasons: string[];
  warnings?: string[];
}

export interface KnowledgeBackendPort {
  id: string;
  plan: KnowledgeBackendPlan;
  isConfigured(): boolean;
  ensure?(): Promise<void>;
}
