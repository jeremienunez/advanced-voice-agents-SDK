import type {
  AgentChannel,
  MediaBridgeDefinition,
  PlanDefinition,
  PromptSection,
  ProviderDefinition,
  TenantDefinition,
  ToolManifest,
  VoiceAgentSdkDefinition,
} from "./types/core/index.js";
import type { StoreDefinition, StoreEntityDefinition } from "./types/store.js";

export interface PromptRenderInput {
  channel: AgentChannel;
  variables?: Record<string, string | number | boolean | null | undefined>;
}

export interface CompiledVoiceAgentSdk {
  readonly definition: VoiceAgentSdkDefinition;
  getTenant(id: string): TenantDefinition | undefined;
  getProvider(id: string): ProviderDefinition | undefined;
  getMediaBridge(id: string): MediaBridgeDefinition | undefined;
  getStore(id: string): StoreDefinition | undefined;
  getStoreEntity(
    storeId: string,
    entityId: string,
  ): StoreEntityDefinition | undefined;
  providerForTenant(tenantId: string): ProviderDefinition | undefined;
  mediaBridgeForTenant(tenantId: string): MediaBridgeDefinition | undefined;
  planIncludes(planId: string, requiredPlanId: string): boolean;
  toolsForPlan(planId?: string): ToolManifest[];
  promptFor(input: PromptRenderInput): string;
}

export function compileVoiceAgentSdk(
  definition: VoiceAgentSdkDefinition,
): CompiledVoiceAgentSdk {
  validateDefinition(definition);

  const tenants = new Map(definition.tenants.map((item) => [item.id, item]));
  const providers = new Map(definition.providers.map((item) => [item.id, item]));
  const mediaBridges = new Map(
    definition.mediaBridges.map((item) => [item.id, item]),
  );
  const plans = new Map(definition.plans.map((item) => [item.id, item]));
  const stores = new Map(definition.stores.map((item) => [item.id, item]));

  const planIncludes = (
    planId: string,
    requiredPlanId: string,
    visited = new Set<string>(),
  ): boolean => {
    if (planId === requiredPlanId) return true;
    if (visited.has(planId)) return false;
    visited.add(planId);

    const plan = plans.get(planId);
    if (!plan?.inherits) return false;
    return plan.inherits.some((parent) =>
      planIncludes(parent, requiredPlanId, visited),
    );
  };

  const renderPrompt = (input: PromptRenderInput): string => {
    return definition.prompts
      .filter((section) => {
        return !section.channels || section.channels.includes(input.channel);
      })
      .sort(comparePromptSections)
      .map((section) => renderSection(section, input.variables ?? {}))
      .join("\n\n");
  };

  return {
    definition,
    getTenant: (id) => tenants.get(id),
    getProvider: (id) => providers.get(id),
    getMediaBridge: (id) => mediaBridges.get(id),
    getStore: (id) => stores.get(id),
    getStoreEntity: (storeId, entityId) => {
      return stores.get(storeId)?.entities.find((item) => item.id === entityId);
    },
    providerForTenant: (tenantId) => {
      const tenant = tenants.get(tenantId);
      if (!tenant?.defaultProviderId) return definition.providers[0];
      return providers.get(tenant.defaultProviderId);
    },
    mediaBridgeForTenant: (tenantId) => {
      const tenant = tenants.get(tenantId);
      if (!tenant?.defaultMediaBridgeId) return definition.mediaBridges[0];
      return mediaBridges.get(tenant.defaultMediaBridgeId);
    },
    planIncludes,
    toolsForPlan: (planId) => {
      if (!planId) {
        return definition.tools.filter((tool) => !tool.allowedPlans?.length);
      }
      return definition.tools.filter((tool) => {
        if (!tool.allowedPlans?.length) return true;
        return tool.allowedPlans.some((required) =>
          planIncludes(planId, required),
        );
      });
    },
    promptFor: renderPrompt,
  };
}

function validateDefinition(definition: VoiceAgentSdkDefinition): void {
  const providerIds = new Set(definition.providers.map((item) => item.id));
  const mediaBridgeIds = new Set(definition.mediaBridges.map((item) => item.id));
  const planIds = new Set(definition.plans.map((item) => item.id));
  const storeIds = new Set<string>();

  for (const tenant of definition.tenants) {
    if (tenant.defaultProviderId && !providerIds.has(tenant.defaultProviderId)) {
      throw new Error(
        `Tenant "${tenant.id}" references missing provider "${tenant.defaultProviderId}"`,
      );
    }
    if (
      tenant.defaultMediaBridgeId &&
      !mediaBridgeIds.has(tenant.defaultMediaBridgeId)
    ) {
      throw new Error(
        `Tenant "${tenant.id}" references missing media bridge "${tenant.defaultMediaBridgeId}"`,
      );
    }
  }

  for (const mediaBridge of definition.mediaBridges) {
    if (mediaBridge.providerId && !providerIds.has(mediaBridge.providerId)) {
      throw new Error(
        `Media bridge "${mediaBridge.id}" references missing provider "${mediaBridge.providerId}"`,
      );
    }
  }

  for (const plan of definition.plans) {
    for (const inherited of plan.inherits ?? []) {
      if (!planIds.has(inherited)) {
        throw new Error(
          `Plan "${plan.id}" references missing parent plan "${inherited}"`,
        );
      }
    }
  }

  for (const tool of definition.tools) {
    for (const allowedPlan of tool.allowedPlans ?? []) {
      if (!planIds.has(allowedPlan)) {
        throw new Error(
          `Tool "${tool.name}" references missing plan "${allowedPlan}"`,
        );
      }
    }
  }

  for (const store of definition.stores) {
    if (storeIds.has(store.id)) {
      throw new Error(`Duplicate store: ${store.id}`);
    }
    storeIds.add(store.id);
    validateStore(store);
  }
}

function validateStore(store: StoreDefinition): void {
  const entityIds = new Set<string>();
  for (const entity of store.entities) {
    if (entityIds.has(entity.id)) {
      throw new Error(`Store "${store.id}" has duplicate entity "${entity.id}"`);
    }
    entityIds.add(entity.id);

    const fieldIds = new Set(entity.fields.map((field) => field.id));
    if (!fieldIds.has(entity.primaryKey)) {
      throw new Error(
        `Store entity "${entity.id}" references missing primary key "${entity.primaryKey}"`,
      );
    }
  }
}

function comparePromptSections(a: PromptSection, b: PromptSection): number {
  return (a.priority ?? 100) - (b.priority ?? 100);
}

function renderSection(
  section: PromptSection,
  variables: Record<string, string | number | boolean | null | undefined>,
): string {
  return section.body.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (_, key) => {
    const value = variables[key];
    return value === undefined || value === null ? "" : String(value);
  });
}
