import type { BuilderConfig } from "../../../domain/builder.js";

export function BuilderStatus({
  config,
  error,
}: {
  config: BuilderConfig | null;
  error: string | null;
}) {
  if (error) return <div className="status status-error">config error</div>;
  if (!config) return <div className="status">loading</div>;

  const ready = config.availability.deepseek && config.availability.voyage;

  return (
    <div className={`status ${ready ? "status-listening" : "status-error"}`}>
      {ready ? "ready" : "partial"}
    </div>
  );
}
