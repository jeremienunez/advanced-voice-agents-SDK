import {
  asRecord,
  readNumber,
  readString,
} from "../utils/record-readers.js";

export function normalizeResearchSettings(
  body: unknown,
  defaults: {
    model: string;
    provider: string;
    verifierModel: string;
    verifierProvider: string;
  },
): {
  provider: string;
  model: string;
  verifierProvider?: string;
  verifierModel?: string;
  verificationPasses?: number;
} {
  const source = asRecord(asRecord(body).research ?? {});
  return {
    provider: readString(source, "provider") || defaults.provider,
    model: readString(source, "model") || defaults.model,
    verifierProvider: readString(source, "verifierProvider") ||
      defaults.verifierProvider,
    verifierModel: readString(source, "verifierModel") || defaults.verifierModel,
    verificationPasses: readNumber(source, "verificationPasses"),
  };
}
