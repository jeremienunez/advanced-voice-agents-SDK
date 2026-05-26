import {
  createDatabaseBuilder,
  createToolBuilder,
  defineDomainPack,
} from "../../../src/sdk/index.js";

function objectInput(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : {};
}

const database = createDatabaseBuilder("wine-investment")
  .displayName("Wine investment domain")
  .table({
    id: "catalog_items",
    primaryKey: "id",
    fields: { type: "object" },
    indexes: ["name", "region", "appellation", "producer"],
  })
  .table({
    id: "collection_items",
    primaryKey: "id",
    fields: { type: "object" },
    indexes: ["tenant_id", "user_id", "catalog_item_id"],
  })
  .table({
    id: "market_signals",
    primaryKey: "id",
    fields: { type: "object" },
    indexes: ["catalog_item_id", "region", "updated_at"],
  })
  .vectorIndex({
    id: "catalog_embeddings",
    dimensions: 1536,
    metric: "cosine",
    metadataSchema: { type: "object" },
  })
  .build();

const searchCatalog = createToolBuilder("search_catalog")
  .describe("Search domain catalog items by natural language or filters")
  .category("catalog")
  .parameters({
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number" },
      filters: { type: "object" },
    },
    required: ["query"],
  })
  .handler(async (input, context) => {
    return context.database?.query("catalog_items", objectInput(input)) ?? [];
  })
  .build();

const searchCollection = createToolBuilder("search_collection")
  .describe("Search the end user's private collection")
  .category("collection")
  .parameters({
    type: "object",
    properties: {
      query: { type: "string" },
      userId: { type: "string" },
      limit: { type: "number" },
    },
    required: ["query"],
  })
  .handler(async (input, context) => {
    return context.database?.query("collection_items", {
      ...objectInput(input),
      userId: context.userId,
    });
  })
  .build();

const readMarketSignals = createToolBuilder("read_market_signals")
  .describe("Read market context for a catalog item or region")
  .category("market")
  .parameters({
    type: "object",
    properties: {
      catalogItemId: { type: "string" },
      region: { type: "string" },
    },
  })
  .handler(async (input, context) => {
    return context.database?.query("market_signals", objectInput(input)) ?? [];
  })
  .build();

export const wineInvestmentPack = defineDomainPack({
  id: "wine-investment",
  displayName: "Wine investment",
  description:
    "Example pack showing where the copied wine/cellar/investment logic should live.",
  onboarding: [
    {
      id: "domain-positioning",
      title: "Domain positioning",
      fields: [
        {
          id: "assistant_name",
          label: "Assistant name",
          type: "text",
          required: true,
        },
        {
          id: "expertise_level",
          label: "Expertise level",
          type: "select",
          required: true,
          options: [
            { label: "Generalist", value: "generalist" },
            { label: "Expert", value: "expert" },
          ],
        },
        {
          id: "tone",
          label: "Voice tone",
          type: "textarea",
        },
      ],
    },
    {
      id: "domain-data",
      title: "Domain data",
      fields: [
        {
          id: "catalog_source",
          label: "Catalog source",
          type: "text",
          required: true,
        },
        {
          id: "collection_source",
          label: "Collection source",
          type: "text",
        },
      ],
    },
  ],
  prompts: [
    {
      id: "domain-role",
      title: "Domain role",
      body:
        "You are a domain expert. Use the configured tools when facts must come from the tenant database.",
      priority: 10,
      channels: ["voice", "chat", "sms"],
    },
  ],
  tools: [searchCatalog, searchCollection, readMarketSignals],
  database,
  plans: [
    { id: "starter", label: "Starter", features: ["catalog"] },
    {
      id: "pro",
      label: "Pro",
      inherits: ["starter"],
      features: ["catalog", "collection", "market"],
    },
  ],
});
