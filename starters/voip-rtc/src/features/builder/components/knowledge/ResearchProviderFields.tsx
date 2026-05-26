import { SelectField } from "../../../../components/ui/SelectField.js";
import { TextField } from "../../../../components/ui/TextField.js";
import type {
  BuilderConfig,
  BuilderResearchSettings,
} from "../../../../domain/builder.js";

export function ResearchProviderFields({
  config,
  settings,
  updateResearchSettings,
}: {
  config: BuilderConfig | null;
  settings: BuilderResearchSettings;
  updateResearchSettings: (patch: Partial<BuilderResearchSettings>) => void;
}) {
  const providers = config?.providers.research ?? [];
  const verifiers = config?.providers.verification ?? [];
  const selected = providers.find((item) => item.id === settings.provider);
  const selectedVerifier = verifiers.find((item) => {
    return item.id === settings.verifierProvider;
  });

  return (
    <div className="researchProviderGrid">
      <SelectField
        label="Knowledge builder"
        name="researchProvider"
        options={providers.map((provider) => ({
          value: provider.id,
          label: provider.configured
            ? provider.label
            : `${provider.label} - missing key`,
          disabled: !provider.configured,
        }))}
        value={settings.provider}
        onValueChange={(provider) => {
          const nextProvider = providers.find((item) => item.id === provider);
          updateResearchSettings({
            provider,
            model: nextProvider?.defaultModel ?? settings.model,
          });
        }}
      />
      <TextField
        label="Research model"
        name="researchModel"
        placeholder={selected?.defaultModel ?? "deepseek-v4-pro"}
        value={settings.model}
        onValueChange={(model) => updateResearchSettings({ model })}
      />
      <SelectField
        label="Teacher verifier"
        name="teacherVerifier"
        options={verifiers.map((provider) => ({
          value: provider.id,
          label: provider.configured
            ? provider.label
            : `${provider.label} - missing key`,
          disabled: !provider.configured,
        }))}
        value={settings.verifierProvider ?? "kimi"}
        onValueChange={(verifierProvider) => {
          const next = verifiers.find((item) => item.id === verifierProvider);
          updateResearchSettings({
            verifierProvider,
            verifierModel: next?.defaultModel ?? settings.verifierModel,
          });
        }}
      />
      <TextField
        label="Teacher model"
        name="teacherModel"
        placeholder={selectedVerifier?.defaultModel ?? "kimi-k2.6"}
        value={settings.verifierModel ?? ""}
        onValueChange={(verifierModel) => updateResearchSettings({
          verifierModel,
        })}
      />
      <TextField
        label="Teacher passes"
        min={1}
        max={8}
        name="teacherPasses"
        type="number"
        value={String(settings.verificationPasses ?? 3)}
        onValueChange={(value) => updateResearchSettings({
          verificationPasses: Number(value),
        })}
      />
    </div>
  );
}
