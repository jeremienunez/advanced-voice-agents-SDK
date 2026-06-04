import {
  createMcpJsonRpcToolAdapter,
  type McpJsonRpcToolAdapterOptions,
} from "./json-rpc-tool-adapter.js";

const DEFAULT_PROTOCOL_VERSION = "2025-11-25";
const PREVIOUS_PROTOCOL_VERSION = "2025-06-18";
const BACKWARD_COMPAT_PROTOCOL_VERSION = "2025-03-26";
const REQUIRED_ACCEPT_TYPES = ["application/json", "text/event-stream"] as const;

export interface McpStreamableHttpToolHandlerOptions
  extends McpJsonRpcToolAdapterOptions {
  supportedProtocolVersions?: readonly string[];
}

export type McpStreamableHttpToolHandler = (
  request: Request,
) => Promise<Response>;

export function createMcpStreamableHttpToolHandler(
  options: McpStreamableHttpToolHandlerOptions,
): McpStreamableHttpToolHandler {
  const supportedProtocolVersions = supportedVersions(options);
  return async function handleMcpStreamableHttpRequest(
    request: Request,
  ): Promise<Response> {
    const headerProtocolVersion = negotiateProtocolVersionFromHeader(
      request,
      supportedProtocolVersions,
    );
    const hasUnsupportedProtocolHeader =
      Boolean(request.headers.get("MCP-Protocol-Version")?.trim()) &&
      !headerProtocolVersion;
    if (hasUnsupportedProtocolHeader) {
      return textResponse("Unsupported MCP protocol version", 400);
    }
    const earlyProtocolVersion = headerProtocolVersion ??
      BACKWARD_COMPAT_PROTOCOL_VERSION;
    if (request.method !== "POST") {
      return textResponse("MCP stream endpoints are not supported", 405, {
        Allow: "POST",
        "MCP-Protocol-Version": earlyProtocolVersion,
      });
    }
    if (!hasJsonContentType(request.headers)) {
      return textResponse("Content-Type must be application/json", 415, {
        "MCP-Protocol-Version": earlyProtocolVersion,
      });
    }
    if (!hasRequiredAcceptTypes(request.headers)) {
      return textResponse(
        "Accept must include application/json and text/event-stream",
        406,
        { "MCP-Protocol-Version": earlyProtocolVersion },
      );
    }

    const body = await readJsonBody(request);
    if (body === undefined) {
      return textResponse("Invalid JSON body", 400, {
        "MCP-Protocol-Version": earlyProtocolVersion,
      });
    }

    const protocolVersion = negotiatePostProtocolVersion(
      request,
      body,
      supportedProtocolVersions,
    );
    if (!protocolVersion) {
      return textResponse("Unsupported MCP protocol version", 400);
    }

    const adapter = createMcpJsonRpcToolAdapter({
      ...options,
      protocolVersion,
    });
    const result = await adapter.handle(body);
    if (!result) {
      return new Response(null, {
        status: 202,
        headers: { "MCP-Protocol-Version": protocolVersion },
      });
    }
    if (isRejectedJsonRpcInput(result)) {
      return jsonResponse(result, 400, protocolVersion);
    }

    return jsonResponse(result, 200, protocolVersion);
  };
}

function supportedVersions(
  options: McpStreamableHttpToolHandlerOptions,
): readonly string[] {
  const versions = [
    ...(options.supportedProtocolVersions ?? []),
    options.protocolVersion,
    DEFAULT_PROTOCOL_VERSION,
    PREVIOUS_PROTOCOL_VERSION,
    BACKWARD_COMPAT_PROTOCOL_VERSION,
  ];
  return Array.from(new Set(versions.filter(isNonEmptyString)));
}

function negotiatePostProtocolVersion(
  request: Request,
  body: unknown,
  supportedProtocolVersions: readonly string[],
): string | null {
  const headerVersion = negotiateProtocolVersionFromHeader(
    request,
    supportedProtocolVersions,
  );
  if (headerVersion) return headerVersion;
  if (request.headers.get("MCP-Protocol-Version")?.trim()) return null;
  const initializeVersion = initializeProtocolVersion(body);
  if (initializeVersion) {
    return supportedProtocolVersions.includes(initializeVersion)
      ? initializeVersion
      : latestSupportedProtocolVersion(supportedProtocolVersions);
  }
  return supportedProtocolVersions.includes(BACKWARD_COMPAT_PROTOCOL_VERSION)
    ? BACKWARD_COMPAT_PROTOCOL_VERSION
    : null;
}

function negotiateProtocolVersionFromHeader(
  request: Request,
  supportedProtocolVersions: readonly string[],
): string | null {
  const requested = request.headers.get("MCP-Protocol-Version")?.trim();
  if (!requested) return null;
  return supportedProtocolVersions.includes(requested) ? requested : null;
}

function initializeProtocolVersion(body: unknown): string | null {
  const request = asRecord(body);
  if (request.jsonrpc !== "2.0" || request.method !== "initialize") return null;
  const params = asRecord(request.params);
  const protocolVersion = params.protocolVersion;
  return typeof protocolVersion === "string" && protocolVersion.trim()
    ? protocolVersion.trim()
    : null;
}

function latestSupportedProtocolVersion(
  supportedProtocolVersions: readonly string[],
): string {
  return supportedProtocolVersions[0] ?? DEFAULT_PROTOCOL_VERSION;
}

function hasJsonContentType(headers: Headers): boolean {
  return mediaType(headers.get("content-type")) === "application/json";
}

function hasRequiredAcceptTypes(headers: Headers): boolean {
  const accepted = new Set(mediaTypes(headers.get("accept")));
  return REQUIRED_ACCEPT_TYPES.every((type) => accepted.has(type));
}

async function readJsonBody(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function mediaTypes(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map(mediaType)
    .filter(isNonEmptyString);
}

function mediaType(value: string | null): string {
  return (value ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textResponse(
  message: string,
  status: number,
  headers: HeadersInit = {},
): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...headers,
    },
  });
}

function jsonResponse(
  data: unknown,
  status: number,
  protocolVersion: string,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "MCP-Protocol-Version": protocolVersion,
    },
  });
}

function isRejectedJsonRpcInput(result: unknown): boolean {
  const response = asRecord(result);
  const error = asRecord(response.error);
  return response.id === null && error.code === -32600;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
