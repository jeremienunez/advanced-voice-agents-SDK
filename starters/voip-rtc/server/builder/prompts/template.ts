import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface PromptTemplatePair {
  system: string;
  user: string;
}

export interface BuilderPromptLibrary {
  promptPlan: PromptTemplatePair;
  knowledgePlan: PromptTemplatePair;
  toolPlan: PromptTemplatePair;
  finalPrompt: PromptTemplatePair;
  databasePlan: PromptTemplatePair;
  research: PromptTemplatePair;
  knowledgeVerification: PromptTemplatePair;
}

export function loadBuilderPromptLibrary(): BuilderPromptLibrary {
  return {
    promptPlan: loadPair("prompt-plan"),
    knowledgePlan: loadPair("knowledge-plan"),
    toolPlan: loadPair("tool-plan"),
    finalPrompt: loadPair("final-prompt"),
    databasePlan: loadPair("database-plan"),
    research: loadPair("research"),
    knowledgeVerification: loadPair("knowledge-verification"),
  };
}

export function renderPromptTemplate(
  template: string,
  values: Record<string, unknown>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = values[String(key)];
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}

function loadPair(name: string): PromptTemplatePair {
  return {
    system: loadTemplate(`${name}.system.md`),
    user: loadTemplate(`${name}.user.md`),
  };
}

function loadTemplate(name: string): string {
  const path = fileURLToPath(new URL(`./templates/${name}`, import.meta.url));
  return readFileSync(path, "utf8").trim();
}
