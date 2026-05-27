import type { AgentInfraPlan, InfraResourceRef } from "./infra.js";
import type { KnowledgeDocument } from "./builder.js";
import type { DatabaseBuildPlan, DatabaseBuildStatus } from "./database.js";
import type { AgentBuildDraft } from "./draft.js";

export interface DatabaseProvisionValidation {
  ok: boolean;
  status: DatabaseBuildStatus;
  errors: string[];
  warnings: string[];
}

export interface DatabaseProvisionInput {
  draft: AgentBuildDraft;
  plan: DatabaseBuildPlan;
}

export interface InfraProvisionInput {
  draft: AgentBuildDraft;
  plan: AgentInfraPlan;
}

export interface DatabaseProvisionResult {
  status: DatabaseBuildStatus;
  schemaName: string;
  appliedStatements: string[];
  warnings: string[];
  appliedAt: string;
}

export interface InfraProvisionResult {
  status: AgentInfraPlan["status"];
  planId: string;
  resources: InfraResourceRef[];
  warnings: string[];
  appliedAt?: string;
}

export interface InfraProvisionValidation {
  ok: boolean;
  status: AgentInfraPlan["status"];
  errors: string[];
  warnings: string[];
}

export interface DatabaseProvisionerPort {
  isConfigured(): boolean;
  validate(input: DatabaseProvisionInput): DatabaseProvisionValidation;
  apply(input: DatabaseProvisionInput): Promise<DatabaseProvisionResult>;
}

export interface InfraProvisionerPort {
  isConfigured(): boolean;
  validate(input: InfraProvisionInput): InfraProvisionValidation;
  apply(input: InfraProvisionInput): Promise<InfraProvisionResult>;
}

export interface DocumentIngestionInput {
  id?: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  content: string | ArrayBuffer;
}

export interface DocumentIngestionOptions {
  signal?: AbortSignal;
}

export interface DocumentIngestionPort {
  parse(
    input: DocumentIngestionInput,
    options?: DocumentIngestionOptions,
  ): Promise<KnowledgeDocument>;
}
