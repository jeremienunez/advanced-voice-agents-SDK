export function hasAnyEnv(names: string[]): boolean {
  return names.some((name) => Boolean(Bun.env[name]));
}
