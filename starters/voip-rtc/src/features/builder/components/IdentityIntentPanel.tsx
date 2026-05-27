import { Button } from "../../../components/ui/Button.js";
import { Panel } from "../../../components/ui/Panel.js";
import { SelectField } from "../../../components/ui/SelectField.js";
import { TextareaField } from "../../../components/ui/TextareaField.js";
import { TextField } from "../../../components/ui/TextField.js";
import type {
  BuilderConfig,
  BuilderIdentity,
} from "../../../domain/builder.js";

export function IdentityIntentPanel({
  form,
  config,
  busy,
  canAnalyze,
  updateField,
  analyzeIntent,
}: {
  form: BuilderIdentity;
  config: BuilderConfig | null;
  busy: string | null;
  canAnalyze: boolean;
  updateField: (key: keyof BuilderIdentity, value: string) => void;
  analyzeIntent: () => Promise<void>;
}) {
  const providerOptions = config?.providers.prompt.length
    ? config.providers.prompt.map((provider) => ({
        value: provider.id,
        label: provider.configured
          ? provider.label
          : `${provider.label} - missing key`,
        disabled: !provider.configured,
      }))
    : [
        {
          value: "",
          label: "Waiting for builder config",
          disabled: true,
        },
      ];

  return (
    <Panel title="1. Identity + Intent">
      <div className="formGrid">
        <TextField
          label="Builder first name"
          name="builderFirstName"
          placeholder="Camille"
          value={form.builderFirstName}
          onValueChange={(value) => updateField("builderFirstName", value)}
        />
        <TextField
          label="Builder last name"
          name="builderLastName"
          placeholder="Martin"
          value={form.builderLastName}
          onValueChange={(value) => updateField("builderLastName", value)}
        />
        <TextField
          label="Public agent name"
          name="publicAgentName"
          placeholder="Route des Vins Concierge"
          value={form.publicAgentName}
          onValueChange={(value) => updateField("publicAgentName", value)}
        />
        <SelectField
          label="Builder provider"
          name="llmProvider"
          options={providerOptions}
          value={form.llmProvider}
          onValueChange={(value) => {
            const provider = config?.providers.prompt.find((item) => {
              return item.id === value;
            });
            updateField("llmProvider", value);
            if (provider) updateField("llmModel", provider.defaultModel);
          }}
        />
        <TextField
          label="Builder LLM"
          name="llmModel"
          placeholder={config?.defaults.promptModel ?? "model from /config"}
          value={form.llmModel}
          onValueChange={(value) => updateField("llmModel", value)}
        />
      </div>
      <TextareaField
        label="Main intent"
        name="intent"
        placeholder="Construire un agent vocal pour aider une agence de voyage a conseiller des itineraires sur les routes des vins."
        value={form.intent}
        onValueChange={(value) => updateField("intent", value)}
      />
      <div className="formGrid">
        <TextareaField
          label="Must do"
          name="mustDo"
          placeholder={
            "Repondre en phrases courtes\nCiter les sources knowledge\nDemander les preferences de voyage"
          }
          value={form.mustDo}
          onValueChange={(value) => updateField("mustDo", value)}
        />
        <TextareaField
          label="Must never do"
          name="mustNotDo"
          placeholder={
            "Inventer une appellation ou un tarif\nConfondre conseil touristique et medical\nExecuter une action sans confirmation"
          }
          value={form.mustNotDo}
          onValueChange={(value) => updateField("mustNotDo", value)}
        />
      </div>
      <div className="actions">
        <Button
          onClick={() => void analyzeIntent()}
          disabled={!canAnalyze || Boolean(busy)}
          variant="primary"
        >
          {busy === "prompt" ? "Analyzing" : "Analyze intent"}
        </Button>
      </div>
    </Panel>
  );
}
