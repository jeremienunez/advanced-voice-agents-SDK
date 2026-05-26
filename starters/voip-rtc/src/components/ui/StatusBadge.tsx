export function StatusBadge({ state }: { state: string }) {
  return <div className={`status status-${state}`}>{state}</div>;
}
