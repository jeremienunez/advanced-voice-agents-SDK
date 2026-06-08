import { uniqueSources } from "../../domain/research/plan.js";

export function sourcesFromMarkdown(
  text: string,
): Array<{ url: string; title: string }> {
  const sources = Array.from(text.matchAll(/https?:\/\/[^\s)\]]+/g)).map(
    ([url]) => ({
      url: url.replace(/[.,;:]+$/, ""),
      title: url.replace(/^https?:\/\//, ""),
    }),
  );
  return uniqueSources(sources);
}
