export function json(
  data: unknown,
  corsHeaders: Record<string, string>,
  init?: ResponseInit,
): Response {
  return Response.json(data, {
    ...init,
    headers: { ...corsHeaders, ...(init?.headers ?? {}) },
  });
}
