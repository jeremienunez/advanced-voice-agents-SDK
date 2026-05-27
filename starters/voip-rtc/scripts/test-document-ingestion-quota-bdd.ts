import type { KnowledgeDocument } from "@voiceagentsdk/core/sdk";
import type { BuilderWorkflowDependencies } from "../server/builder/types.js";
import { createBuilderWorkflows } from "../server/builder/workflows.js";
import { assert } from "./shared/assertions.js";

const results = [
  await scenarioIngestionQuotaIsScopedByIp(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioIngestionQuotaIsScopedByIp() {
  let parseCalls = 0;
  const workflows = createBuilderWorkflows({
    documentParseTimeoutMs: 1000,
    documentIngestionQuota: singleRequestQuota(),
    ingestion: {
      async parse(): Promise<KnowledgeDocument> {
        parseCalls += 1;
        return parsedDocument();
      },
    },
  } as unknown as BuilderWorkflowDependencies);

  await workflows.ingestDocument(markdownRequest(), { clientIp: "203.0.113.10" });
  const blocked = await captureError(() =>
    workflows.ingestDocument(markdownRequest(), { clientIp: "203.0.113.10" })
  );
  await workflows.ingestDocument(markdownRequest(), { clientIp: "203.0.113.11" });

  assert(
    blocked?.message.includes("Document ingestion quota exceeded"),
    `second request from same IP must be quota rejected, got ${blocked?.message ?? "success"}`,
  );
  assert(parseCalls === 2, "quota rejection must happen before parsing");

  return "document-ingestion-quota-by-ip";
}

function singleRequestQuota() {
  const counts = new Map<string, number>();
  return {
    consume(input: { clientIp?: string }) {
      const key = input.clientIp ?? "unknown";
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return {
        allowed: next <= 1,
        remaining: Math.max(0, 1 - next),
        retryAfterMs: next <= 1 ? undefined : 60_000,
      };
    },
  };
}

function markdownRequest(): Request {
  return new Request("http://starter.test/builder/ingest-document", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": "120",
    },
    body: JSON.stringify({ name: "quota.md", content: "# quota" }),
  });
}

function parsedDocument(): KnowledgeDocument {
  return {
    id: "quota-doc",
    name: "quota.md",
    kind: "md",
    status: "parsed",
    text: "# quota",
  };
}

async function captureError(
  action: () => Promise<unknown>,
): Promise<Error | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
