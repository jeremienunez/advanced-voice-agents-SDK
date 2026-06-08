import type {
  KnowledgeDocument,
  KnowledgeResearchBudget,
  KnowledgeResearchRequest,
} from "@voiceagentsdk/core/sdk";
import { defaultResearchBudget } from "../../catalog.js";
import {
  asRecord,
  readPositiveNumber,
} from "../../utils/record-readers.js";

export function normalizeResearchBudget(
  body: unknown,
): Partial<KnowledgeResearchBudget> {
  const source = asRecord(asRecord(body).budget ?? body);
  return {
    maxCycles: readPositiveNumber(source, "maxCycles"),
    maxQueriesPerCycle: readPositiveNumber(source, "maxQueriesPerCycle"),
    maxSources: readPositiveNumber(source, "maxSources"),
    maxEstimatedTokens: readPositiveNumber(source, "maxEstimatedTokens"),
    maxEstimatedCostUsd: readPositiveNumber(source, "maxEstimatedCostUsd"),
  };
}

export function resolveResearchBudget(
  input?: Partial<KnowledgeResearchBudget>,
): KnowledgeResearchBudget {
  const defaults = defaultResearchBudget();
  return {
    maxCycles: clampBudget(input?.maxCycles, 1, 12, defaults.maxCycles),
    maxQueriesPerCycle: clampBudget(
      input?.maxQueriesPerCycle,
      1,
      32,
      defaults.maxQueriesPerCycle,
    ),
    maxSources: clampBudget(input?.maxSources, 1, 200, defaults.maxSources),
    maxEstimatedTokens: clampBudget(
      input?.maxEstimatedTokens,
      1,
      250_000,
      defaults.maxEstimatedTokens,
    ),
    maxEstimatedCostUsd: clampBudget(
      input?.maxEstimatedCostUsd,
      0,
      50,
      defaults.maxEstimatedCostUsd,
    ),
  };
}

export function buildResearchObjectives(
  input: KnowledgeResearchRequest,
): Array<{ objective: string; queries: string[] }> {
  const requested = input.settings?.researchIntents?.filter(
    (intent) => intent.objective && intent.queries.length > 0,
  );
  if (requested?.length) return requested;

  const terms = extractResearchTerms(input.documents);
  const agentName = input.draft.identity.publicAgentName;
  const intent = input.draft.identity.intent;
  const primaryTerm = terms[0] ?? agentName;
  const secondaryTerm = terms[1] ?? compactIntent(intent);
  const domain = domainQueries(intent, primaryTerm, secondaryTerm);
  const planFirstObjective = input.documents.length === 0
    ? [{
        objective:
          "Create and commit to a formal knowledge implementation plan before collecting facts because no source file was uploaded.",
        queries: [
          `${secondaryTerm} official sources implementation plan`,
          `${agentName} knowledge base strategy sources official`,
          ...domain.plan,
        ],
      }]
    : [];

  return [
    ...planFirstObjective,
    {
      objective:
        "Collect official, institutional, and high-trust sources for the agent domain.",
      queries: domain.official,
    },
    {
      objective:
        "Distill practical operational knowledge for short, reliable voice answers.",
      queries: domain.operational,
    },
    {
      objective:
        "Find candidate schema, KG entities, relations, and repository fields.",
      queries: domain.schema,
    },
    {
      objective:
        "Identify gaps and follow-up research tasks the autonomous knowledge agent should run later.",
      queries: domain.gaps,
    },
  ];
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function uniqueSources(
  sources: Array<{ url: string; title: string }>,
): Array<{ url: string; title: string }> {
  const seen = new Set<string>();
  const uniqueItems: Array<{ url: string; title: string }> = [];
  for (const source of sources) {
    if (!source.url || seen.has(source.url)) continue;
    seen.add(source.url);
    uniqueItems.push(source);
  }
  return uniqueItems;
}

function clampBudget(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function extractResearchTerms(documents: KnowledgeDocument[]): string[] {
  const terms = new Set<string>();
  for (const document of documents) {
    const text = document.text ?? "";
    for (const match of text.matchAll(/route_destination:\s*([^;\n]+)/gi)) {
      const value = match[1]?.trim();
      if (value) terms.add(value);
      if (terms.size >= 8) break;
    }
    for (const match of text.matchAll(/region_viticole:\s*([^;\n]+)/gi)) {
      const value = match[1]?.trim();
      if (value) terms.add(value);
      if (terms.size >= 10) break;
    }
    if (terms.size >= 10) break;
  }
  return Array.from(terms);
}

function compactIntent(intent: string): string {
  return intent.replace(/\s+/g, " ").trim().slice(0, 140);
}

function domainQueries(intent: string, primary: string, secondary: string) {
  const text = intent.toLowerCase();
  if (
    text.includes("sav") ||
    text.includes("service après-vente") ||
    text.includes("technicien")
  ) {
    return {
      plan: [
        "France Travail ROME I1304 technicien SAV fiche metier",
        "service public garantie legale conformite reparation SAV",
      ],
      official: [
        "France Travail ROME I1304 technicien service apres vente",
        "ONISEP technicien service apres vente fiche metier",
        "service-public.fr garantie legale conformite reparation",
        `${primary} procedures SAV diagnostic ticket escalade`,
      ],
      operational: [
        `${secondary} diagnostic panne procedure SAV client`,
        "bonnes pratiques service apres vente relation client escalade",
        "compte rendu intervention SAV securite validation client",
        "gestion reclamation livraison transport produit defectueux",
      ],
      schema: [
        "schema ticket SAV diagnostic intervention pieces garantie",
        "knowledge graph service apres vente client produit panne intervention",
        "repository safe tickets SAV statuts escalade garantie",
        "assistant vocal SAV outils ticket resume escalade",
      ],
      gaps: [
        "SAV donnees manquantes diagnostic panne client garantie",
        "questionnaire qualification panne service apres vente",
        "risques securite intervention SAV escalade technicien",
        "sources officielles metier technicien SAV competences",
      ],
    };
  }

  if (
    text.includes("vin") ||
    text.includes("vignoble") ||
    text.includes("appellation")
  ) {
    return {
      plan: [
        "France wine routes official tourism knowledge graph",
        "INAO DATAtourisme Atout France route des vins official data",
      ],
      official: [
        `${primary} site:atout-france.fr Vignobles Decouvertes`,
        `${primary} route des vins official tourism`,
        `${secondary} destination vignoble officiel`,
        `${secondary} official wine tourism France`,
      ],
      operational: [
        `${primary} itinerary wine route tourism official`,
        `${secondary} caves domaines visite degustation officiel`,
        "France route des vins conseils voyage sources officielles",
        `${primary} appellations villes traversees tourisme`,
      ],
      schema: [
        `${primary} appellations communes route des vins`,
        `${secondary} domaines caves source officielle`,
        "data tourisme route des vins domaines caves France",
        `INAO appellations viticoles donnees officielles ${primary}`,
      ],
      gaps: [
        `${primary} official data gaps route wine tourism`,
        `${secondary} open data tourisme vignoble`,
        "OpenStreetMap craft winery France route des vins",
        "DATAtourisme caves domaines vignobles France",
      ],
    };
  }

  return {
    plan: [
      `${secondary} official sources`,
      `${primary} domain policy knowledge base`,
    ],
    official: [
      `${secondary} sources officielles`,
      `${secondary} government public data`,
      `${primary} official documentation`,
      `${primary} professional guidelines`,
    ],
    operational: [
      `${secondary} best practices workflow`,
      `${secondary} frequently asked questions`,
      `${secondary} user intent qualification`,
      `${primary} voice assistant operational rules`,
    ],
    schema: [
      `${secondary} data schema entities relations`,
      `${secondary} knowledge graph ontology`,
      `${primary} repository fields safe queries`,
      `${primary} tools workflow permissions`,
    ],
    gaps: [
      `${secondary} missing data checklist`,
      `${secondary} validation sources follow up research`,
      `${primary} edge cases escalation rules`,
      `${primary} confidence and citation policy`,
    ],
  };
}
