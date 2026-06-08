import { Button } from "../../components/ui/Button.js";
import type {
  InfraAction,
  InfraActionResult,
  OnboardingDependency,
  OnboardingEnvGroup,
  OnboardingRequirement,
  OnboardingState,
} from "../../domain/onboarding/types.js";
import { EnvDrawer } from "./EnvDrawer.js";
import { GuidedInfraPanel } from "./GuidedInfraPanel.js";
import {
  environmentSteps,
  type EnvironmentStepId,
} from "./environment-view-model.js";

const envGroups: OnboardingEnvGroup[] = [
  "voice",
  "builder",
  "knowledge",
  "infra",
  "auth",
];

export function EnvironmentSlider({
  activeStep,
  busy,
  dependencies,
  groupedFields,
  infraReady,
  infraResult,
  onChangeField,
  onRefresh,
  onRun,
  onSaveEnv,
  onSelectInfraProfile,
  onStepChange,
  profile,
  requirements,
  state,
  values,
}: {
  activeStep: EnvironmentStepId;
  busy: string | null;
  dependencies: OnboardingDependency[];
  groupedFields: Map<OnboardingEnvGroup, OnboardingState["env"]["fields"]>;
  infraResult: InfraActionResult | null;
  infraReady: boolean;
  profile: "dev" | "user" | "custom";
  requirements: OnboardingRequirement[];
  state: OnboardingState | null;
  values: Record<string, string>;
  onChangeField: (name: string, value: string) => void;
  onRefresh: () => void;
  onRun: (action: InfraAction) => void;
  onSaveEnv: () => void | Promise<void>;
  onSelectInfraProfile: (profile: "dev" | "user") => void;
  onStepChange: (step: EnvironmentStepId) => void;
}) {
  const activeIndex = environmentSteps.findIndex((step) => step.id === activeStep);
  const step = environmentSteps[activeIndex] ?? environmentSteps[0];
  const canGoBack = activeIndex > 0;
  const canGoNext = activeIndex < environmentSteps.length - 1;

  return (
    <section className="environmentSlider" aria-label="Guided environment setup">
      <header className="sliderHeader">
        <div>
          <span>Step {activeIndex + 1} of {environmentSteps.length}</span>
          <h2>{step.label}</h2>
          <p>{step.detail}</p>
        </div>
        <div className="sliderDots" aria-label="Environment setup steps">
          {environmentSteps.map((item, index) => (
            <button
              aria-current={item.id === activeStep ? "step" : undefined}
              aria-label={`Go to step ${index + 1}: ${item.label}`}
              className={item.id === activeStep ? "active" : ""}
              key={item.id}
              onClick={() => onStepChange(item.id)}
              type="button"
            />
          ))}
        </div>
      </header>

      <div className="sliderBody">
        {activeStep === "requirements" && (
          <RequirementsStep
            dependencies={dependencies}
            requirements={requirements}
            onOpenEnv={(fieldName) => {
              onStepChange("env");
              window.setTimeout(() => {
                const field = document.getElementById(`env-${fieldName}`);
                const drawer = field?.closest("details");
                if (drawer instanceof HTMLDetailsElement) drawer.open = true;
                const control = field?.querySelector<HTMLElement>("input, select");
                field?.scrollIntoView({ block: "center", behavior: "smooth" });
                control?.focus({ preventScroll: true });
              }, 0);
            }}
          />
        )}

        {activeStep === "env" && (
          <section className="onboardingPanel envPanel">
            <div className="panelHeader">
              <h2>Environment store</h2>
              <span>{state?.env.store.format ?? "dotenv"}</span>
            </div>
            {state && envGroups.map((group) => (
              <EnvDrawer
                fields={groupedFields.get(group) ?? []}
                group={group}
                key={group}
                requirements={requirements}
                values={values}
                onChange={onChangeField}
              />
            ))}
            <div className="envActions">
              <Button
                disabled={Boolean(busy)}
                onClick={() => void onSaveEnv()}
                variant="primary"
              >
                {busy === "save" ? "Saving" : "Save .env.local"}
              </Button>
            </div>
          </section>
        )}

        {(activeStep === "preview" || activeStep === "verify") && (
          <GuidedInfraPanel
            busy={busy}
            dependencies={dependencies}
            driver={values.BUILDER_INFRA_APPLY_DRIVER || "dev-local"}
            infraResult={infraResult}
            onProfileChange={onSelectInfraProfile}
            onRefresh={onRefresh}
            onRun={onRun}
            profile={profile}
            ready={infraReady}
            target={values.BUILDER_INFRA_COMPUTE_TARGET || "local"}
          />
        )}
      </div>

      <footer className="sliderFooter">
        <Button disabled={!canGoBack} onClick={() => onStepChange(environmentSteps[activeIndex - 1].id)}>
          Previous
        </Button>
        <Button
          disabled={!canGoNext}
          onClick={() => onStepChange(environmentSteps[activeIndex + 1].id)}
          variant="primary"
        >
          Next
        </Button>
      </footer>
    </section>
  );
}

function RequirementsStep({
  dependencies,
  onOpenEnv,
  requirements,
}: {
  dependencies: OnboardingDependency[];
  requirements: OnboardingRequirement[];
  onOpenEnv: (fieldName: string) => void;
}) {
  return (
    <div className="requirementsStep">
      <section className="onboardingPanel">
        <div className="panelHeader">
          <h2>Local dependencies</h2>
          <span>{dependencies.filter((item) => item.required).length} required</span>
        </div>
        <div className="dependencyList">
          {dependencies.map((item) => (
            <div className="dependencyRow" key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail || item.command}</span>
              </div>
              <div className="dependencyActions">
                <span className={`pill ${item.status}`}>{item.status}</span>
                {item.status !== "ok" && (
                  <a href={item.docsUrl} rel="noreferrer" target="_blank">Docs</a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="onboardingPanel">
        <div className="panelHeader">
          <h2>Required configuration</h2>
          <span>{requirements.filter((item) => item.severity === "required").length} checks</span>
        </div>
        <div className="requirementLines">
          {requirements.map((item) => (
            <div
              className={item.satisfied ? "requirementLine ok" : "requirementLine warning"}
              key={item.id}
            >
              <div>
                <strong>{item.label}</strong>
                <p>{item.message}</p>
                <span>{item.candidateKeys.join(item.mode === "all" ? " + " : " or ")}</span>
              </div>
              <button
                className="requirementCta"
                onClick={() => onOpenEnv(item.candidateKeys[0])}
                type="button"
              >
                {item.satisfied ? "View key" : "Add key"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
