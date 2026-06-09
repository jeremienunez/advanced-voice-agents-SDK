export type AdapterBoundaryOwner = "sdk" | "starter";

export type AdapterBindingMode = "runtime_adapter" | "planned_only";

export type AdapterPromotionPath =
  | "stay_starter"
  | "candidate_sdk_package"
  | "sdk_package";

export interface AdapterOwnershipBoundary {
  owner: AdapterBoundaryOwner;
  binding: AdapterBindingMode;
  promotion: AdapterPromotionPath;
  reason: string;
  promotionCriteria: string[];
}
