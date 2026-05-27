export function parseJsonPayload<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(content) as T;
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return fallback;
    try {
      return JSON.parse(content.slice(start, end + 1)) as T;
    } catch {
      return fallback;
    }
  }
}

export function toJsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
