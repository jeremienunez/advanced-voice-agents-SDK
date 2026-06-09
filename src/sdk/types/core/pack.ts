import type { StoreDefinition } from "../store.js";
import type { DatabaseDefinition } from "./data.js";
import type {
  MediaBridgeDefinition,
  OnboardingStep,
  PlanDefinition,
  PromptSection,
  ProviderDefinition,
  TenantDefinition,
} from "./foundation.js";
import type { ToolManifest } from "./tools.js";

export interface DomainPack {
  id: string;
  displayName: string;
  description?: string;
  onboarding?: OnboardingStep[];
  prompts?: PromptSection[];
  tools?: ToolManifest[];
  database?: DatabaseDefinition;
  stores?: StoreDefinition[];
  plans?: PlanDefinition[];
  services?: Record<string, unknown>;
}

export interface VoiceAgentSdkDefinition {
  tenants: TenantDefinition[];
  providers: ProviderDefinition[];
  mediaBridges: MediaBridgeDefinition[];
  plans: PlanDefinition[];
  prompts: PromptSection[];
  tools: ToolManifest[];
  databases: DatabaseDefinition[];
  stores: StoreDefinition[];
  onboarding: OnboardingStep[];
  packs: DomainPack[];
}
