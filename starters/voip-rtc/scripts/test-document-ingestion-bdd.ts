import type {
  DocumentIngestionInput,
  KnowledgeDocument,
} from "@voiceagentsdk/core/sdk";
import { PlainTextDocumentIngestion } from "../server/builder/adapters/document-ingestion.js";
import type { BuilderWorkflowDependencies } from "../server/builder/types.js";
import { createBuilderWorkflows } from "../server/builder/workflows.js";
import { readDocumentInput } from "../server/builder/request/document-input.js";
import { assert } from "./shared/assertions.js";
import * as XLSX from "xlsx";

const results = [
  await scenarioRejectsUnboundedRequests(),
  await scenarioRejectsDisallowedDocumentTypes(),
  await scenarioAcceptsBoundedTextDocuments(),
  await scenarioWorkbookParserReportsCaps(),
  await scenarioParserTimeoutFailsClosed(),
];

console.log(JSON.stringify({ status: "ok", results }, null, 2));

async function scenarioRejectsUnboundedRequests() {
  const missingLength = await captureError(() =>
    readDocumentInput(jsonRequest({ name: "notes.txt", content: "hello" }, {}))
  );
  assert(
    missingLength?.message.includes("content-length is required"),
    `missing content-length must fail, got ${missingLength?.message ?? "success"}`,
  );

  const tooLarge = await captureError(() =>
    readDocumentInput(jsonRequest(
      { name: "notes.txt", content: "hello" },
      { "content-length": String(9 * 1024 * 1024) },
    ))
  );
  assert(
    tooLarge?.message.includes("Request body is too large"),
    `large content-length must fail, got ${tooLarge?.message ?? "success"}`,
  );

  return "bounded-request-required";
}

async function scenarioRejectsDisallowedDocumentTypes() {
  const executable = await captureError(() =>
    readDocumentInput(jsonRequest(
      {
        name: "payload.exe",
        mimeType: "application/x-msdownload",
        content: "MZ",
      },
      { "content-length": "90" },
    ))
  );
  assert(
    executable?.message.includes("Document type is not allowed"),
    `disallowed document type must fail, got ${executable?.message ?? "success"}`,
  );

  const legacyWorkbook = await captureError(() =>
    readDocumentInput(jsonRequest(
      {
        name: "legacy.xls",
        mimeType: "application/vnd.ms-excel",
        content: "legacy",
      },
      { "content-length": "120" },
    ))
  );
  assert(
    legacyWorkbook?.message.includes("Document type is not allowed"),
    `legacy xls must fail before parsing, got ${legacyWorkbook?.message ?? "success"}`,
  );

  return "document-type-allowlist";
}

async function scenarioAcceptsBoundedTextDocuments() {
  const input = await readDocumentInput(jsonRequest(
    {
      id: "doc-bdd",
      name: "notes.md",
      mimeType: "text/markdown",
      content: "# Safe notes",
    },
    { "content-length": "120" },
  ));
  const document = await new PlainTextDocumentIngestion().parse(input);

  assert(input.name === "notes.md", "bounded markdown name must be preserved");
  assert(document.status === "parsed", "bounded markdown must parse");
  assert(document.text === "# Safe notes", "bounded markdown content must parse");

  return "bounded-text-document-accepted";
}

async function scenarioWorkbookParserReportsCaps() {
  const rowDocument = await new PlainTextDocumentIngestion().parse({
    id: "xlsx-bdd",
    name: "row-limits.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: 1,
    content: workbookWithOverflowingRows(),
  });
  const rowMetadata = rowDocument.metadata ?? {};

  assert(rowDocument.status === "parsed", "bounded xlsx rows must parse");
  assert(rowMetadata.rowCount === 5000, "xlsx row cap must be enforced");
  assert(rowMetadata.truncated === true, "xlsx row cap must be observable");
  assert(
    !String(rowDocument.text).includes("row-5001"),
    "xlsx rows beyond the cap must not feed knowledge text",
  );

  const cellDocument = await new PlainTextDocumentIngestion().parse({
    id: "xlsx-bdd-cells",
    name: "cell-limits.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: 1,
    content: workbookWithOverflowingCells(),
  });
  const cellMetadata = cellDocument.metadata ?? {};
  const columns = Array.isArray(cellMetadata.columns) ? cellMetadata.columns : [];

  assert(cellDocument.status === "parsed", "bounded xlsx cells must parse");
  assert(columns.length === 80, "xlsx cell cap must be enforced");
  assert(cellMetadata.truncated === true, "xlsx cell cap must be observable");
  assert(
    !String(cellDocument.text).includes("value-81"),
    "xlsx cells beyond the cap must not feed knowledge text",
  );

  const textDocument = await new PlainTextDocumentIngestion().parse({
    id: "xlsx-bdd-text",
    name: "text-limits.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: 1,
    content: workbookWithOverflowingText(),
  });
  const textMetadata = textDocument.metadata ?? {};

  assert(textDocument.status === "parsed", "bounded xlsx text must parse");
  assert(textMetadata.truncated === true, "xlsx text cap must be observable");
  assert(
    !String(textDocument.text).includes("x".repeat(501)),
    "xlsx cell text must be capped before knowledge text",
  );

  const sheetDocument = await new PlainTextDocumentIngestion().parse({
    id: "xlsx-bdd-sheets",
    name: "sheet-limits.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sizeBytes: 1,
    content: workbookWithOverflowingSheets(),
  });
  const metadata = sheetDocument.metadata ?? {};
  const sheetNames = Array.isArray(metadata.sheetNames)
    ? metadata.sheetNames
    : [];

  assert(sheetDocument.status === "parsed", "bounded xlsx sheets must parse");
  assert(sheetNames.length === 12, "xlsx sheet cap must be enforced");
  assert(metadata.truncated === true, "xlsx sheet cap must be observable");

  return "workbook-parser-caps";
}

async function scenarioParserTimeoutFailsClosed() {
  let observedSignal: AbortSignal | undefined;
  const workflows = createBuilderWorkflows({
    documentParseTimeoutMs: 1,
    documentIngestionQuota: { consume: () => ({ allowed: true, remaining: 1 }) },
    ingestion: {
      parse(
        input: DocumentIngestionInput,
        options?: { signal?: AbortSignal },
      ): Promise<KnowledgeDocument> {
        observedSignal = options?.signal;
        return new Promise<KnowledgeDocument>(() => {
          void input;
        });
      },
    },
  } as unknown as BuilderWorkflowDependencies);

  const result = await Promise.race([
    workflows.ingestDocument(jsonRequest(
      { id: "slow-doc", name: "slow.md", content: "# slow" },
      { "content-length": "120" },
    )),
    wait(50).then(() => null),
  ]);

  assert(result !== null, "parser timeout seam must settle stuck parsers");
  assert(result.document.status === "failed", "parser timeout must fail closed");
  assert(
    result.document.error?.includes("timed out after 1ms") === true,
    `parser timeout error must be explicit, got ${result.document.error ?? "none"}`,
  );
  assert(observedSignal?.aborted === true, "parser timeout must abort the parser signal");

  return "parser-timeout-fails-closed";
}

function jsonRequest(
  body: unknown,
  headers: Record<string, string>,
): Request {
  return new Request("http://starter.test/builder/ingest-document", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
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

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function workbookWithOverflowingRows(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const rows = [["name", "notes"]];
  for (let index = 1; index <= 5001; index += 1) {
    rows.push([`row-${index}`, "ok"]);
  }
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    "main",
  );
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

function workbookWithOverflowingCells(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const headers = Array.from({ length: 81 }, (_, index) => `column_${index + 1}`);
  const values = Array.from({ length: 81 }, (_, index) => `value-${index + 1}`);
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([headers, values]),
    "main",
  );
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

function workbookWithOverflowingText(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["name", "notes"], ["row-1", "x".repeat(600)]]),
    "main",
  );
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

function workbookWithOverflowingSheets(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["name"], ["main"]]),
    "main",
  );
  for (let index = 2; index <= 13; index += 1) {
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["name"], [`sheet-${index}`]]),
      `extra_${index}`,
    );
  }
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}
