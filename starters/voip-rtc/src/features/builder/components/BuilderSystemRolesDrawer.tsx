import { SelectField } from "../../../components/ui/SelectField.js";
import { TextField } from "../../../components/ui/TextField.js";
import type {
  BuilderConfig,
  BuilderProviderOption,
  BuilderSystemConfig,
  BuilderSystemModelSelection,
  BuilderSystemRole,
} from "../../../domain/builder/types.js";

const rows: Array<{
  modelLabel: string;
  providerLabel: string;
  providers: keyof BuilderConfig["providers"];
  role: BuilderSystemRole;
}> = [
  {
    role: "builder.planner",
    providers: "prompt",
    providerLabel: "Planning engine",
    modelLabel: "Planning model",
  },
  {
    role: "builder.researcher",
    providers: "research",
    providerLabel: "Research engine",
    modelLabel: "Research model",
  },
  {
    role: "builder.verifier",
    providers: "verification",
    providerLabel: "Verifier engine",
    modelLabel: "Verifier model",
  },
];

export function BuilderSystemRolesDrawer({
  config,
  value,
  onSelectionChange,
}: {
  config: BuilderConfig | null;
  value: BuilderSystemConfig;
  onSelectionChange: (
    role: BuilderSystemRole,
    selection: BuilderSystemModelSelection,
  ) => void;
}) {
  return (
    <details className="builderSystemDrawer">
      <summary className="builderSystemSummary">
        <span>Builder system roles</span>
        <small>{configuredCount(value)}/3 selected</small>
      </summary>
      <div className="builderSystemGrid">
        {rows.map((row) => {
          const providers = config?.providers[row.providers] ?? [];
          const current = selectionFor(row.role, value, providers);
          return (
            <div className="builderSystemRow" key={row.role}>
              <SelectField
                label={row.providerLabel}
                name={`${row.role}-provider`}
                options={providerOptions(providers)}
                value={current.provider}
                onValueChange={(provider) => {
                  const selected = providers.find((item) => item.id === provider);
                  onSelectionChange(row.role, {
                    provider,
                    model: selected?.defaultModel ?? current.model,
                  });
                }}
              />
              <TextField
                label={row.modelLabel}
                name={`${row.role}-model`}
                placeholder={current.model || "model from /config"}
                value={current.model}
                onValueChange={(model) => {
                  onSelectionChange(row.role, {
                    ...current,
                    model,
                  });
                }}
              />
            </div>
          );
        })}
      </div>
    </details>
  );
}

function configuredCount(value: BuilderSystemConfig): number {
  return rows.filter((row) => value.modelSelections[row.role]?.provider).length;
}

function providerOptions(providers: BuilderProviderOption[]) {
  if (!providers.length) {
    return [{ value: "", label: "Waiting for builder config", disabled: true }];
  }
  return providers.map((provider) => ({
    value: provider.id,
    label: provider.configured ? provider.label : `${provider.label} - missing key`,
    disabled: !provider.configured,
  }));
}

function selectionFor(
  role: BuilderSystemRole,
  value: BuilderSystemConfig,
  providers: BuilderProviderOption[],
): BuilderSystemModelSelection {
  const selected = value.modelSelections[role];
  if (selected) return selected;
  const provider = providers.find((item) => item.configured) ?? providers[0];
  return {
    provider: provider?.id ?? "",
    model: provider?.defaultModel ?? "",
  };
}
