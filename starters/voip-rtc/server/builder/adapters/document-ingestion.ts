import type {
  DocumentIngestionInput,
  DocumentIngestionPort,
  KnowledgeDocument,
} from "@voiceagentsdk/core/sdk";
import * as XLSX from "xlsx";
import { documentKind } from "../domain/document-kind.js";
import { asRecord, readString } from "../utils.js";

const MAX_WORKBOOK_BYTES = 8 * 1024 * 1024;
const MAX_WORKBOOK_SHEETS = 12;
const MAX_ROWS_PER_SHEET = 5000;
const MAX_CELLS_PER_ROW = 80;
const MAX_CELL_CHARS = 500;
const MAX_DOCUMENT_CHARS = 500_000;

export class PlainTextDocumentIngestion implements DocumentIngestionPort {
  async parse(input: DocumentIngestionInput): Promise<KnowledgeDocument> {
    const kind = documentKind(input.name, input.mimeType);
    const base = {
      id: input.id ?? `doc_${crypto.randomUUID()}`,
      name: input.name,
      kind,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      metadata: {},
    };

    if (kind === "pdf") {
      return {
        ...base,
        status: "unsupported",
        error: "PDF parsing needs a parser adapter in this starter v1",
      };
    }

    if (kind === "xls") {
      return {
        ...base,
        status: "unsupported",
        error:
          "Legacy .xls parsing is disabled; upload .xlsx so the starter can use the maintained SheetJS parser.",
      };
    }

    if (kind === "xlsx") {
      return parseWorkbookDocument(input, kind);
    }

    if (kind !== "txt" && kind !== "md" && kind !== "web_research") {
      return {
        ...base,
        status: "unsupported",
        error: "Only .txt, .md, .xlsx, and .pdf are accepted in v1",
      };
    }

    const text =
      typeof input.content === "string"
        ? input.content
        : new TextDecoder().decode(input.content);

    return {
      ...base,
      text,
      status: "parsed",
    };
  }
}

async function parseWorkbookDocument(
  input: DocumentIngestionInput,
  kind: "xlsx",
): Promise<KnowledgeDocument> {
  const content =
    typeof input.content === "string"
      ? Buffer.from(input.content)
      : Buffer.from(input.content);
  if (content.byteLength > MAX_WORKBOOK_BYTES) {
    return {
      id: input.id ?? `doc_${crypto.randomUUID()}`,
      name: input.name,
      kind,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      status: "unsupported",
      error: `Workbook is too large; max ${MAX_WORKBOOK_BYTES} bytes`,
    };
  }

  const workbook = XLSX.read(content, {
    type: "buffer",
    cellDates: true,
    dense: true,
    sheetRows: MAX_ROWS_PER_SHEET + 1,
  });

  const sheetNames: string[] = [];
  const columns = new Set<string>();
  let rowCount = 0;
  let documentChars = 0;
  let truncated = false;
  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames.slice(0, MAX_WORKBOOK_SHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    sheetNames.push(sheetName);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      blankrows: false,
      defval: "",
      header: 1,
      raw: false,
    });
    const headerRow = rows[0] ?? [];
    const headers = headerRow
      .slice(0, MAX_CELLS_PER_ROW)
      .map((value, index) => cellToText(value) || `column_${index + 1}`);
    headers.forEach((header) => columns.add(header));

    sections.push(`# Sheet: ${sheetName}`);
    sections.push(`Headers: ${headers.join(" | ")}`);

    for (const [index, row] of rows.slice(1).entries()) {
      if (documentChars >= MAX_DOCUMENT_CHARS) {
        truncated = true;
        break;
      }
      const rowNumber = index + 2;
      const rowValues = row.slice(0, MAX_CELLS_PER_ROW);
      const values = rowValues.map((value: unknown) => cellToText(value));
      if (values.every((value) => !value)) continue;
      rowCount += 1;
      const rowText = headers
        .map((header: string, index: number) => `${header}: ${values[index] ?? ""}`)
        .filter((item: string) => !item.endsWith(": "))
        .join(" ; ");
      sections.push(`Row ${rowNumber}: ${rowText}`);
      documentChars += rowText.length;
    }
    sections.push("");
    if (truncated) break;
  }
  if (workbook.SheetNames.length > MAX_WORKBOOK_SHEETS) truncated = true;

  return {
    id: input.id ?? `doc_${crypto.randomUUID()}`,
    name: input.name,
    kind,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    text: sections.join("\n"),
    status: "parsed",
    metadata: {
      parser: "sheetjs",
      rowCount,
      columns: Array.from(columns),
      sheetNames,
      truncated,
    },
  };
}

function cellToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return limitCellText(value.trim());
  if (typeof value === "number" || typeof value === "boolean") {
    return limitCellText(String(value));
  }
  if (value instanceof Date) return limitCellText(value.toISOString());
  const record = asRecord(value);
  if (typeof record.text === "string") return limitCellText(record.text.trim());
  if (Array.isArray(record.richText)) {
    return limitCellText(
      record.richText
        .map((item) => readString(item, "text"))
        .join("")
        .trim(),
    );
  }
  if (record.result != null) return cellToText(record.result);
  return limitCellText(String(value).trim());
}

function limitCellText(value: string): string {
  return value.slice(0, MAX_CELL_CHARS);
}
