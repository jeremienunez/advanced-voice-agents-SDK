import type { BuilderRequestContext } from "../builder/types.js";
import { corsHeadersFor } from "./cors.js";
import type { StarterRouteContext } from "./types.js";

export async function handleMcpRoute(
  app: StarterRouteContext,
  request: Request,
  url: URL,
  context: BuilderRequestContext,
): Promise<Response> {
  if (!context.identity) return new Response("Unauthorized", { status: 401 });
  if (!app.mcpToolService) {
    return Response.json(
      { error: "MCP tool service is not configured" },
      { status: 404, headers: corsHeadersFor(app.env, request) },
    );
  }
  return withCors(
    await app.mcpToolService.handle(request, url, context),
    app,
    request,
  );
}

function withCors(
  response: Response,
  app: StarterRouteContext,
  request: Request,
): Response {
  const headers = new Headers(corsHeadersFor(app.env, request));
  response.headers.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
