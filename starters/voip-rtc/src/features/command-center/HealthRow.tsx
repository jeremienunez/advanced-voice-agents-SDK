export function HealthRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ready" | "idle" | "error";
}) {
  return (
    <div className={`healthRow ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
