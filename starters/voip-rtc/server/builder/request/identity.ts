import type { AgentBuilderIdentity } from "@voiceagentsdk/core/sdk";
import {
  asRecord,
  listFromUnknown,
  readString,
} from "../utils/record-readers.js";

export function normalizeIdentity(body: unknown): AgentBuilderIdentity {
  const source = asRecord(body).identity
    ? asRecord(asRecord(body).identity)
    : asRecord(body);
  const builderFirstName = readString(source, "builderFirstName");
  const builderLastName = readString(source, "builderLastName");
  const publicAgentName = readString(source, "publicAgentName");
  const intent = readString(source, "intent");
  const missing = [
    ["builderFirstName", builderFirstName],
    ["builderLastName", builderLastName],
    ["publicAgentName", publicAgentName],
    ["intent", intent],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required builder fields: ${missing.join(", ")}`);
  }

  return {
    builderFirstName,
    builderLastName,
    publicAgentName,
    intent,
    mustDo: listFromUnknown(source.mustDo),
    mustNotDo: listFromUnknown(source.mustNotDo),
  };
}
