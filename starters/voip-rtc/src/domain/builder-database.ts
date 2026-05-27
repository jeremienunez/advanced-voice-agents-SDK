export interface DatabaseBuildPlan {
  id: string;
  status: string;
  databaseProvider: string;
  schemaName: string;
  sqlMigration: string;
  statements: Array<{
    id: string;
    sql: string;
    purpose: string;
    riskLevel: string;
  }>;
  vectorization: {
    embeddingProvider: string;
    embeddingModel: string;
    dimensions: number;
    sourceFields: string[];
    metadataFields: string[];
    retrievalMode: string;
    index: {
      kind: string;
      metric: string;
    };
    rationale?: string;
  };
  repositories: {
    repositories: Array<{
      id: string;
      table: string;
      operations: string[];
      vectorSearch?: boolean;
      lexicalSearch?: boolean;
    }>;
    safetyRules: string[];
    rationale?: string;
  };
  reasons: string[];
  risks: string[];
  validationErrors?: string[];
  appliedAt?: string;
}
