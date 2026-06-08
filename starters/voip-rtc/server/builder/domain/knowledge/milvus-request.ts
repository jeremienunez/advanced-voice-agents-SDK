import { normalizeToken } from "../infra/token.js";

export function isMilvusRequested(value: string | undefined): boolean {
  const normalized = normalizeToken(value);
  return normalized === "milvus" || normalized === "milvus_vector";
}
