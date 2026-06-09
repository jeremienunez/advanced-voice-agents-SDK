export interface ActiveAgentScope {
  tenantId?: string;
  userId?: string;
  planId?: string;
}

export interface ActiveAgentAssignmentPort {
  getActiveAgent(
    input: ActiveAgentScope,
  ): string | undefined | Promise<string | undefined>;
  setActiveAgent(
    input: ActiveAgentScope & { draftId: string },
  ): void | Promise<void>;
}
