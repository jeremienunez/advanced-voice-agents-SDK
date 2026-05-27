import type { InfraPlanRequest } from "@voiceagentsdk/core/sdk";

export function searchableIntent(input: InfraPlanRequest): string {
  const identity = input.draft.identity;
  const documentNames = (input.documents ?? [])
    .map((document) => document.name)
    .join(" ");
  return [
    identity.publicAgentName,
    identity.intent,
    ...identity.mustDo,
    ...identity.mustNotDo,
    input.knowledgePlan?.strategy,
    documentNames,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function hasAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}
