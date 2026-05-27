export function requireEnv(names: string[]): string {
  for (const name of names) {
    const value = Bun.env[name];
    if (value) return value;
  }
  throw new Error(`Missing one of: ${names.join(", ")}`);
}

export function hasAnyEnv(names: string[]): boolean {
  return names.some((name) => Boolean(Bun.env[name]));
}
