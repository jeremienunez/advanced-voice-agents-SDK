export interface InfraMigrationPolicy {
  source: "server_owned_templates" | "iac_module" | "external";
  allowGeneratedSql: boolean;
  requiresApproval: boolean;
  versionTable?: string;
  notes?: string[];
}

export interface InfraSecurityPlan {
  tenantScoped: boolean;
  leastPrivilegeRole: boolean;
  secretRefs: string[];
  networkPolicy: "local_only" | "private_network" | "public_restricted";
  notes?: string[];
}
