import type { JsonRecord } from "./types.js";

export async function getJson(url: string): Promise<JsonRecord> {
  const response = await fetch(url);
  return parseResponse(url, response);
}

export async function postJson(
  url: string,
  body: unknown,
): Promise<JsonRecord> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseResponse(url, response);
}

export async function postForm(
  url: string,
  body: FormData,
): Promise<JsonRecord> {
  const response = await fetch(url, {
    method: "POST",
    body,
  });
  return parseResponse(url, response);
}

async function parseResponse(
  url: string,
  response: Response,
): Promise<JsonRecord> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${text}`);
  }
  return JSON.parse(text) as JsonRecord;
}
