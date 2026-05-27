export interface ScenarioResult {
  scenario: string;
  claims: string[];
}

export async function scenario(
  name: string,
  run: () => Promise<string[]>,
): Promise<ScenarioResult> {
  try {
    return { scenario: name, claims: await run() };
  } catch (error) {
    throw new Error(`${name}: ${messageFrom(error)}`);
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function fail(message: string): never {
  console.error(JSON.stringify({ status: "error", error: message }, null, 2));
  process.exit(1);
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
