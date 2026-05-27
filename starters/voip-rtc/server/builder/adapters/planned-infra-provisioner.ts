import type {
  InfraProvisionInput,
  InfraProvisionResult,
  InfraProvisionerPort,
  InfraProvisionValidation,
} from "@voiceagentsdk/core/sdk";
import { validateInfraProvisionInput } from "../domain/infra-provisioning.js";

export class PlannedInfraProvisioner implements InfraProvisionerPort {
  isConfigured(): boolean {
    return true;
  }

  validate(input: InfraProvisionInput): InfraProvisionValidation {
    return validateInfraProvisionInput(input);
  }

  async apply(input: InfraProvisionInput): Promise<InfraProvisionResult> {
    const validation = this.validate(input);
    if (!validation.ok) {
      throw new Error(`Infra validation failed: ${validation.errors.join("; ")}`);
    }
    return {
      status: "validated",
      planId: input.plan.id,
      resources: input.plan.resources,
      warnings: validation.warnings,
    };
  }
}
