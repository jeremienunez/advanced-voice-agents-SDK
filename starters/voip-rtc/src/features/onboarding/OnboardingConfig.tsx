import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchOnboardingState,
  runInfraAction,
  saveOnboardingEnv,
} from "../../api/onboardingApi.js";
import type {
  InfraAction,
  InfraActionResult,
  OnboardingDependency,
  OnboardingState,
} from "../../domain/onboarding/types.js";
import { EnvironmentSlider } from "./EnvironmentSlider.js";
import {
  configuredEnvCount,
  environmentSteps,
  groupEnvFields,
  requiredDependenciesReady,
  requiredEnvReady,
  type EnvironmentStepId,
} from "./environment-view-model.js";

type InfraProfile = "dev" | "user" | "custom";

export function OnboardingConfig({ apiBase }: { apiBase: string }) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [activeStep, setActiveStep] = useState<EnvironmentStepId>("requirements");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [infraResult, setInfraResult] = useState<InfraActionResult | null>(null);
  const runInFlightRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [apiBase]);

  const grouped = useMemo(() => groupEnvFields(state), [state]);
  const requiredReady = requiredDependenciesReady(state?.dependencies ?? []);
  const envReady = requiredEnvReady(state);
  const setupReady = requiredReady && envReady;
  const configuredCount = configuredEnvCount(state);
  const infraProfile = profileFor(values);
  const infraReady = isInfraReady(values, state?.dependencies ?? []);

  async function refresh(signal?: AbortSignal) {
    setBusy((current) => current ?? "refresh");
    setError(null);
    try {
      const next = await fetchOnboardingState(apiBase, signal);
      hydrate(next, setState, setValues);
    } catch (err) {
      if (signal?.aborted) return;
      setError(messageFrom(err));
    } finally {
      if (signal?.aborted) return;
      setBusy((current) => current === "refresh" ? null : current);
    }
  }

  async function saveEnv() {
    if (!state) return;
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      const payload = Object.fromEntries(
        state.env.fields
          .filter((field) => !field.secret || values[field.name]?.trim())
          .map((field) => [field.name, values[field.name] ?? ""]),
      );
      const next = await saveOnboardingEnv(apiBase, payload);
      hydrate(next, setState, setValues);
      setNotice("Saved to .env.local. Restart the server/client for Vite and Bun env reload.");
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      setBusy(null);
    }
  }

  async function run(action: InfraAction) {
    if (runInFlightRef.current || busy) return;
    runInFlightRef.current = true;
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const result = await runInfraAction(apiBase, action, {
        driver: values.BUILDER_INFRA_APPLY_DRIVER ?? "dev-local",
        target: values.BUILDER_INFRA_COMPUTE_TARGET ?? "local",
        draftId: "onboarding",
      });
      setInfraResult(result.infra);
      setNotice(result.infra.ok ? `Infra ${action} completed.` : `Infra ${action} returned an error.`);
      if (action === "apply" || action === "destroy") await refresh();
    } catch (err) {
      setError(messageFrom(err));
    } finally {
      runInFlightRef.current = false;
      setBusy(null);
    }
  }

  function selectInfraProfile(profile: Exclude<InfraProfile, "custom">) {
    setValues((current) => ({
      ...current,
      BUILDER_INFRA_APPLY_DRIVER: profile === "dev" ? "dev-local" : "k3s-docker",
      BUILDER_INFRA_COMPUTE_TARGET: profile === "dev" ? "local" : "k3s",
      VOICE_PUBLIC_HOST: "127.0.0.1",
      VOICE_SERVER_HOST: "127.0.0.1",
      VITE_DEV_HOST: "127.0.0.1",
    }));
  }

  return (
    <div className="environmentPage fade-in">
      <header className="environmentHero">
        <div>
          <p className="studioEyebrow">Environment</p>
          <h1>Setup and runtime health</h1>
          <p>
            Follow the guided setup to verify local requirements, save approved
            environment values, and preview infrastructure changes before
            applying them.
          </p>
        </div>
        <div className={setupReady ? "environmentStatus ready" : "environmentStatus blocked"}>
          {setupReady ? "Ready to build" : "Setup needed"}
        </div>
      </header>

      <section className="environmentSummary" aria-label="Environment summary">
        <Metric title="Env store" value={state?.env.store.path ?? ".env.local"} />
        <Metric title="Configured keys" value={`${configuredCount}`} />
        <Metric title="Required setup" value={setupReady ? "OK" : "Needs attention"} />
        <Metric title="Infra driver" value={values.BUILDER_INFRA_APPLY_DRIVER || "dev-local"} />
      </section>

      {error && <p className="onboardingMessage error">{error}</p>}
      {notice && <p className="onboardingMessage">{notice}</p>}

      <div className="environmentGrid">
        <EnvironmentSlider
          activeStep={activeStep}
          busy={busy}
          dependencies={state?.dependencies ?? []}
          groupedFields={grouped}
          infraReady={infraReady}
          infraResult={infraResult}
          profile={infraProfile}
          requirements={state?.env.requirements ?? []}
          state={state}
          values={values}
          onChangeField={(name, value) => setValues((current) => ({
            ...current,
            [name]: value,
          }))}
          onRefresh={() => void refresh()}
          onRun={run}
          onSaveEnv={saveEnv}
          onSelectInfraProfile={selectInfraProfile}
          onStepChange={setActiveStep}
        />

        <aside className="environmentChecks" aria-label="Environment setup checklist">
          {environmentSteps.map((step, index) => (
            <button
              aria-current={activeStep === step.id ? "step" : undefined}
              className={activeStep === step.id ? "active" : ""}
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              type="button"
            >
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="onboardingMetric">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function hydrate(
  next: OnboardingState,
  setState: (state: OnboardingState) => void,
  setValues: (values: Record<string, string>) => void,
) {
  setState(next);
  setValues(Object.fromEntries(
    next.env.fields.map((field) => [
      field.name,
      field.secret ? "" : field.value ?? field.defaultValue ?? "",
    ]),
  ));
}

function profileFor(values: Record<string, string>): InfraProfile {
  const driver = values.BUILDER_INFRA_APPLY_DRIVER || "dev-local";
  const target = values.BUILDER_INFRA_COMPUTE_TARGET || "local";
  if (driver === "dev-local" && target === "local") return "dev";
  if (driver === "k3s-docker" && target === "k3s") return "user";
  return "custom";
}

function isInfraReady(
  values: Record<string, string>,
  dependencies: OnboardingDependency[],
): boolean {
  const driver = values.BUILDER_INFRA_APPLY_DRIVER || "dev-local";
  const requiredIds = driver === "k3s-docker"
    ? ["docker-cli", "docker-daemon", "kubectl-cli"]
    : driver === "kubectl"
      ? ["kubectl-cli", "kubernetes-context"]
      : [];
  return requiredIds.every((id) => {
    return dependencies.find((item) => item.id === id)?.status === "ok";
  });
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Onboarding request failed";
}
