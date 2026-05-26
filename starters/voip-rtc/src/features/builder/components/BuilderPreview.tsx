import { Metric } from "../../../components/ui/Metric.js";
import { Panel } from "../../../components/ui/Panel.js";
import type { AgentBuildDraft } from "../../../domain/builder.js";

export function BuilderPreview({
  draft,
  previewPrompt,
  selectedTools,
}: {
  draft: AgentBuildDraft | null;
  previewPrompt: string;
  selectedTools: string[];
}) {
  return (
    <aside className="builderPreview">
      <Panel title="Live Prompt Preview">
        <pre className="promptPreview">{previewPrompt}</pre>
      </Panel>
      <Panel title="Decisions">
        <Metric label="Draft" value={draft?.id ?? "not created"} />
        <Metric label="Status" value={draft?.status ?? "idle"} />
        <Metric
          label="Knowledge"
          value={draft?.knowledgePlan?.strategy ?? "not planned"}
        />
        <Metric
          label="Tools"
          value={selectedTools.length ? selectedTools.join(", ") : "none"}
        />
      </Panel>
    </aside>
  );
}
