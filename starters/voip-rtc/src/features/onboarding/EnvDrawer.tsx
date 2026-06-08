import type {
  OnboardingEnvField,
  OnboardingEnvGroup,
  OnboardingRequirement,
} from "../../domain/onboarding/types.js";

const groupLabels: Record<OnboardingEnvGroup, string> = {
  voice: "Voice runtime",
  builder: "Builder LLMs",
  knowledge: "Knowledge store",
  infra: "Infra harness",
  auth: "Voice auth",
};

export function EnvDrawer({
  fields,
  group,
  onChange,
  requirements,
  values,
}: {
  fields: OnboardingEnvField[];
  group: OnboardingEnvGroup;
  onChange: (name: string, value: string) => void;
  requirements: OnboardingRequirement[];
  values: Record<string, string>;
}) {
  const configured = fields.filter((field) => field.configured).length;
  const missing = requirements.filter((item) => {
    return item.group === group && !item.satisfied;
  });
  return (
    <details
      className={missing.length ? "envDrawer attention" : "envDrawer"}
      open={group === "voice" || missing.length > 0}
    >
      <summary className="envDrawerSummary">
        <span>{groupLabels[group]}</span>
        <small>
          {missing.length ? `${missing.length} warning` : `${configured}/${fields.length} configured`}
        </small>
      </summary>
      <div className="envDrawerBody">
        {fields.map((field) => (
          <EnvField
            field={field}
            key={field.name}
            value={values[field.name] ?? ""}
            onChange={(value) => onChange(field.name, value)}
          />
        ))}
      </div>
    </details>
  );
}

function EnvField({
  field,
  value,
  onChange,
}: {
  field: OnboardingEnvField;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="envField" id={`env-${field.name}`}>
      <span>{field.label}</span>
      {field.options ? (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.secret ? field.maskedValue ?? "not configured" : field.defaultValue}
          type={field.secret ? "password" : "text"}
          value={value}
        />
      )}
      <small>
        {field.name} · {field.configured ? field.source : "missing"} · {field.description}
      </small>
    </label>
  );
}
