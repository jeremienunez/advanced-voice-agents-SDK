import type {
  DocumentIngestionInput,
  DocumentIngestionPort,
  KnowledgeDocument,
} from "@voiceagentsdk/core/sdk";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { documentKind } from "../domain/document-kind.js";
import { asRecord, readString } from "../utils.js";

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

    if (kind === "xlsx" || kind === "xls") {
      return parseWorkbookDocument(input, kind);
    }

    if (kind !== "txt" && kind !== "md" && kind !== "web_research") {
      return {
        ...base,
        status: "unsupported",
        error: "Only .txt, .md, .xlsx, .xls, and .pdf are accepted in v1",
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
  kind: "xlsx" | "xls",
): Promise<KnowledgeDocument> {
  try {
    return await parseWorkbookDocumentWithExcelJs(input, kind);
  } catch (error) {
    const document = parseWorkbookDocumentWithSheetJs(input, kind);
    document.metadata = {
      ...(document.metadata ?? {}),
      primaryParser: "sheetjs",
      exceljsError: error instanceof Error ? error.message : "exceljs failed",
    };
    return document;
  }
}

async function parseWorkbookDocumentWithExcelJs(
  input: DocumentIngestionInput,
  kind: "xlsx" | "xls",
): Promise<KnowledgeDocument> {
  const workbook = new ExcelJS.Workbook();
  const content =
    typeof input.content === "string"
      ? Buffer.from(input.content)
      : Buffer.from(input.content);
  await workbook.xlsx.load(content as never);

  const sheetNames: string[] = [];
  const columns = new Set<string>();
  let rowCount = 0;
  const sections: string[] = [];

  workbook.eachSheet((worksheet) => {
    sheetNames.push(worksheet.name);
    const headerRow = worksheet.getRow(1);
    const headerValues = Array.isArray(headerRow.values)
      ? headerRow.values.slice(1)
      : [];
    const headers = headerValues.map(
      (value: unknown, index: number) =>
        cellToText(value) || `column_${index + 1}`,
    );
    headers.forEach((header) => columns.add(header));

    sections.push(`# Sheet: ${worksheet.name}`);
    sections.push(`Headers: ${headers.join(" | ")}`);

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowValues = Array.isArray(row.values) ? row.values.slice(1) : [];
      const values = rowValues.map((value: unknown) => cellToText(value));
      if (values.every((value) => !value)) return;
      rowCount += 1;
      const rowText = headers
        .map((header: string, index: number) => `${header}: ${values[index] ?? ""}`)
        .filter((item: string) => !item.endsWith(": "))
        .join(" ; ");
      sections.push(`Row ${rowNumber}: ${rowText}`);
    });
    sections.push("");
  });

  return {
    id: input.id ?? `doc_${crypto.randomUUID()}`,
    name: input.name,
    kind,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    text: sections.join("\n"),
    status: "parsed",
    metadata: {
      parser: "exceljs",
      rowCount,
      columns: Array.from(columns),
      sheetNames,
    },
  };
}

function parseWorkbookDocumentWithSheetJs(
  input: DocumentIngestionInput,
  kind: "xlsx" | "xls",
): KnowledgeDocument {
  const content =
    typeof input.content === "string"
      ? Buffer.from(input.content)
      : Buffer.from(input.content);
  const workbook = XLSX.read(content, {
    type: "buffer",
    cellDates: true,
  });
  const columns = new Set<string>();
  let rowCount = 0;
  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    headers.forEach((header) => columns.add(header));

    sections.push(`# Sheet: ${sheetName}`);
    sections.push(`Headers: ${headers.join(" | ")}`);
    rows.forEach((row, index) => {
      const rowText = headers
        .map((header) => `${header}: ${cellToText(row[header])}`)
        .filter((item) => !item.endsWith(": "))
        .join(" ; ");
      if (!rowText) return;
      rowCount += 1;
      sections.push(`Row ${index + 2}: ${rowText}`);
    });
    sections.push("");
  }

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
      sheetNames: workbook.SheetNames,
    },
  };
}

function cellToText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  const record = asRecord(value);
  if (typeof record.text === "string") return record.text.trim();
  if (Array.isArray(record.richText)) {
    return record.richText
      .map((item) => readString(item, "text"))
      .join("")
      .trim();
  }
  if (record.result != null) return cellToText(record.result);
  return String(value).trim();
}
