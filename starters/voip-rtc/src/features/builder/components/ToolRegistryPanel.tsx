import type { Dispatch, SetStateAction } from "react";
import { Button } from "../../../components/ui/Button.js";
import { Panel } from "../../../components/ui/Panel.js";
import type {
  AgentBuildDraft,
  ToolRegistryItem,
} from "../../../domain/builder.js";

export function ToolRegistryPanel({
  draft,
  toolRegistry,
  selectedTools,
  busy,
  setSelectedTools,
  compileAgent,
}: {
  draft: AgentBuildDraft | null;
  toolRegistry: ToolRegistryItem[];
  selectedTools: string[];
  busy: string | null;
  setSelectedTools: Dispatch<SetStateAction<string[]>>;
  compileAgent: () => Promise<void>;
}) {
  return (
    <Panel title="5. Tool Registry">
      <div className="toolGrid">
        {toolRegistry.map((tool) => (
          <label key={tool.name} className="toolOption">
            <input
              name={`tool-${tool.name}`}
              type="checkbox"
              checked={selectedTools.includes(tool.name)}
              onChange={(event) => {
                setSelectedTools((current) =>
                  event.target.checked
                    ? [...new Set([...current, tool.name])]
                    : current.filter((item) => item !== tool.name),
                );
              }}
            />
            <span>
              <strong>{tool.title}</strong>
              <em>{tool.description}</em>
            </span>
          </label>
        ))}
      </div>
      <div className="actions">
        <Button
          onClick={() => void compileAgent()}
          disabled={!draft?.promptPlan || Boolean(busy)}
          variant="primary"
        >
          {busy === "compile-agent" ? "Compiling" : "Compile agent"}
        </Button>
      </div>
    </Panel>
  );
}
