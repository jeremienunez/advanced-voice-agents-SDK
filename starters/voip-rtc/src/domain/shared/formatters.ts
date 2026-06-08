import type { KnowledgeDocument } from "../builder/knowledge.js";

export function formatDocumentMetadata(document: KnowledgeDocument): string {
  if (!document.metadata) return "";
  const rowCount = document.metadata.rowCount;
  const columns = document.metadata.columns;
  const rowLabel = typeof rowCount === "number" ? `, ${rowCount} rows` : "";
  const columnLabel = Array.isArray(columns) ? `, ${columns.length} cols` : "";
  return rowLabel || columnLabel ? `${rowLabel}${columnLabel}` : "";
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatKhz(sampleRate: number): string {
  return `${sampleRate / 1000} kHz`;
}
