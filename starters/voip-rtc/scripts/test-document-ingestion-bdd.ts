import { PlainTextDocumentIngestion } from "../server/builder/adapters/document-ingestion.js";
import { readDocumentInput } from "../server/builder/request/document-input.js";
import { assert } from "./shared/assertions.js";

const results = [
  await scenarioRejectsUnboundedRequests(),
  await scenarioRejectsDisallowedDocumentTypes(),
  await scenarioAcceptsBoundedTextDocuments(),
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
