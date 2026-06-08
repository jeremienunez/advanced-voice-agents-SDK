export async function loadStarterEnv(
  scriptUrl: string,
): Promise<Record<string, string>> {
  const rootEnv = await readDotEnv(new URL("../../../.env", scriptUrl));
  const starterEnv = await readDotEnv(new URL("../.env", scriptUrl));
  const localEnv = await readDotEnv(new URL("../.env.local", scriptUrl));

  return compactEnv({
    ...rootEnv,
    ...starterEnv,
    ...localEnv,
    ...process.env,
  });
}

export async function readDotEnv(url: URL): Promise<Record<string, string>> {
  const file = Bun.file(url);
  if (!(await file.exists())) return {};

  const env: Record<string, string> = {};
  const text = await file.text();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    env[key] = value.replace(/^["']|["']$/g, "");
  }
  return env;
}

export function compactEnv(
  source: Record<string, string | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}
