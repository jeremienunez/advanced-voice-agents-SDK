import type {
  DatabaseDefinition,
  DomainPack,
  MediaBridgeDefinition,
  OnboardingStep,
  PlanDefinition,
  PromptSection,
  ProviderDefinition,
  StoreDefinition,
  TenantDefinition,
  ToolManifest,
  VoiceAgentSdkDefinition,
} from "../types.js";
import { assertUnique, copy } from "./builder-values.js";
import { toToolManifest } from "./tool-manifest.js";

export class AgentBuilder {
  private readonly tenants: TenantDefinition[] = [];
  private readonly providers: ProviderDefinition[] = [];
  private readonly mediaBridges: MediaBridgeDefinition[] = [];
  private readonly plans: PlanDefinition[] = [];
  private readonly prompts: PromptSection[] = [];
  private readonly tools: ToolManifest[] = [];
  private readonly databases: DatabaseDefinition[] = [];
  private readonly stores: StoreDefinition[] = [];
  private readonly onboarding: OnboardingStep[] = [];
  private readonly packs: DomainPack[] = [];

  tenant(definition: TenantDefinition): this {
    this.tenants.push(copy(definition));
    return this;
  }

  provider(definition: ProviderDefinition): this {
    this.providers.push(copy(definition));
    return this;
  }

  mediaBridge(definition: MediaBridgeDefinition): this {
    this.mediaBridges.push(copy(definition));
    return this;
  }

  plan(definition: PlanDefinition): this {
    this.plans.push(copy(definition));
    return this;
  }

  prompt(section: PromptSection): this {
    this.prompts.push(copy(section));
    return this;
  }

  tool(definition: ToolManifest): this {
    this.tools.push(toToolManifest(definition));
    return this;
  }

  database(definition: DatabaseDefinition): this {
    this.databases.push(copy(definition));
    return this;
  }

  store(definition: StoreDefinition): this {
    this.stores.push(copy(definition));
    return this;
  }

  onboardingStep(step: OnboardingStep): this {
    this.onboarding.push(copy(step));
    return this;
  }

  use(pack: DomainPack): this {
    this.packs.push(pack);
    pack.plans?.forEach((plan) => this.plan(plan));
    pack.prompts?.forEach((prompt) => this.prompt(prompt));
    pack.tools?.forEach((tool) => this.tool(tool));
    if (pack.database) this.database(pack.database);
    pack.stores?.forEach((store) => this.store(store));
    pack.onboarding?.forEach((step) => this.onboardingStep(step));
    return this;
  }

  build(): VoiceAgentSdkDefinition {
    assertUnique(this.tenants.map((item) => item.id), "tenant");
    assertUnique(this.providers.map((item) => item.id), "provider");
    assertUnique(this.mediaBridges.map((item) => item.id), "media bridge");
    assertUnique(this.plans.map((item) => item.id), "plan");
    assertUnique(this.tools.map((item) => item.name), "tool");
    assertUnique(this.databases.map((item) => item.id), "database");
    assertUnique(this.stores.map((item) => item.id), "store");
    assertUnique(this.onboarding.map((item) => item.id), "onboarding step");

    return {
      tenants: [...this.tenants],
      providers: [...this.providers],
      mediaBridges: [...this.mediaBridges],
      plans: [...this.plans],
      prompts: [...this.prompts],
      tools: [...this.tools],
      databases: [...this.databases],
      stores: [...this.stores],
      onboarding: [...this.onboarding],
      packs: [...this.packs],
    };
  }
}
