interface RequestIpServer {
  requestIP?(request: Request): { address?: string } | null;
}

export function resolveClientIp(request: Request, server: unknown): string {
  const forwarded = firstForwardedFor(request.headers.get("x-forwarded-for"));
  if (forwarded) return forwarded;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const peer = (server as RequestIpServer).requestIP?.(request)?.address;
  return peer || "unknown";
}

function firstForwardedFor(value: string | null): string | undefined {
  return value
    ?.split(",")
    .map((item) => item.trim())
    .find(Boolean);
}
