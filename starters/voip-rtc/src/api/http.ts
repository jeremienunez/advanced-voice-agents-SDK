const DEV_AUTH_TOKEN = import.meta.env.VITE_VOICE_DEV_AUTH_TOKEN;

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetchWithNetworkError(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function postForm<T>(url: string, body: FormData): Promise<T> {
  const response = await fetchWithNetworkError(url, {
    method: "POST",
    body,
  });
  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function readError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as { error?: string };
      return payload.error ?? "";
    } catch {
      return "";
    }
  }
  return response.text();
}

export async function fetchWithNetworkError(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(url, withAuthHeaders(init));
  } catch (error) {
    throw new Error(
      error instanceof TypeError
        ? `Starter server unavailable at ${url}. Start the VOIP RTC starter server or check the Vite API URL.`
        : error instanceof Error
          ? error.message
          : "Network request failed",
    );
  }
}

function withAuthHeaders(init?: RequestInit): RequestInit | undefined {
  if (!DEV_AUTH_TOKEN) return init;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${DEV_AUTH_TOKEN}`);
  return { ...init, headers };
}
