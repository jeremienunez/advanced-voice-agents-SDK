import type {
  InfraIsolationMode,
  InfraProvisioningMode,
} from "@voiceagentsdk/core/sdk";
import type { IntentInfraPlannerOptions } from "./routing.js";

export interface BackendPlanInput {
  options: IntentInfraPlannerOptions;
  schemaName: string;
  isolation: InfraIsolationMode;
  provisioningMode: InfraProvisioningMode;
}
