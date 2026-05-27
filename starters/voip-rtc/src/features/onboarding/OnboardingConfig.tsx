import { useEffect, useMemo, useState } from "react";
import {
  fetchOnboardingState,
  runInfraAction,
  saveOnboardingEnv,
} from "../../api/onboardingApi.js";
import { Button } from "../../components/ui/Button.js";
import { EnvDrawer } from "./EnvDrawer.js";
import { GuidedInfraPanel } from "./GuidedInfraPanel.js";
import type {
  InfraAction,
  InfraActionResult,
  OnboardingDependency,
  OnboardingEnvGroup,
  OnboardingRequirement,
  OnboardingState,
} from "../../domain/onboarding.js";

const groupOrder: OnboardingEnvGroup[] = [
  "voice",
  "builder",
  "knowledge",
  "infra",
  "auth",
];

type InfraProfile = "dev" | "user" | "custom";

export function OnboardingConfig({ apiBase }: { apiBase: string }) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [infraResult, setInfraResult] = useState<InfraActionResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, [apiBase]);

  const grouped = useMemo(() => {
    const groups = new Map<OnboardingEnvGroup, OnboardingState["env"]["fields"]>();
    for (const field of state?.env.fields ?? []) {
      groups.set(field.group, [...(groups.get(field.group) ?? []), field]);
    }
    return groups;
  }, [state]);

  const requiredReady = Boolean(state?.dependencies
    .filter((item) => item.required)
    .every((item) => item.status === "ok"));
  const envReady = Boolean(state?.env.requirements
    .filter((item) => item.severity === "required")
    .every((item) => item.satisfied));
  const setupReady = requiredReady && envReady;
  const configuredCount = state?.env.fields.filter((field) => field.configured).length ?? 0;
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
    <div className="onboardingPage fade-in">
      <header className="onboardingHero">
        <div>
          <p className="eyebrow">Onboarding config</p>
          <h1>Start safely</h1>
          <p>
            This is the first stop before Builder or RTC. The starter checks
            your machine, explains what is missing, and stores only approved
            settings in the ignored `.env.local` file.
          </p>
        </div>
        <div className="onboardingStatus">
          <span className={setupReady ? "ready" : "blocked"} />
          {setupReady ? "Ready to build" : "Setup needed"}
        </div>
      </header>

      <section className="onboardingSummary" aria-label="Onboarding summary">
        <Metric title="Env store" value={state?.env.store.path ?? ".env.local"} />
        <Metric title="Configured keys" value={`${configuredCount}`} />
        <Metric title="Required setup" value={setupReady ? "OK" : "Needs attention"} />
        <Metric title="Infra driver" value={values.BUILDER_INFRA_APPLY_DRIVER || "dev-local"} />
      </section>

      <RequirementWarnings requirements={state?.env.requirements ?? []} />

      {error && <p className="onboardingMessage error">{error}</p>}
      {notice && <p className="onboardingMessage">{notice}</p>}

      <div className="onboardingGrid">
        <GuidedInfraPanel
          busy={busy}
          dependencies={state?.dependencies ?? []}
          infraResult={infraResult}
          driver={values.BUILDER_INFRA_APPLY_DRIVER || "dev-local"}
          onRefresh={() => void refresh()}
          onProfileChange={selectInfraProfile}
          onRun={run}
          profile={infraProfile}
          ready={infraReady}
          target={values.BUILDER_INFRA_COMPUTE_TARGET || "local"}
        />

        <section className="onboardingPanel envPanel">
          <PanelHeader title="Environment store" detail={state?.env.store.format ?? "dotenv"} />
          {state && groupOrder.map((group) => {
            const fields = grouped.get(group) ?? [];
            return (
              <EnvDrawer
                fields={fields}
                group={group}
                key={group}
                requirements={state.env.requirements}
                values={values}
                onChange={(name, value) => setValues((current) => ({
                  ...current,
                  [name]: value,
                }))}
              />
            );
          })}
          <div className="envActions">
            <Button disabled={Boolean(busy)} onClick={saveEnv} variant="primary">
              {busy === "save" ? "Saving" : "Save .env.local"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function RequirementWarnings({
  requirements,
}: {
  requirements: OnboardingRequirement[];
}) {
  if (requirements.length === 0) return null;
  return (
    <section className="requirementWarnings" aria-label="Required configuration">
      {requirements.map((item) => (
        <article
          className={item.satisfied ? "requirementCard ok" : "requirementCard warning"}
          key={item.id}
        >
          <div>
            <strong>{item.label}</strong>
            <p>{item.message}</p>
            <span>{item.candidateKeys.join(item.mode === "all" ? " + " : " or ")}</span>
          </div>
          <a href={`#env-${item.candidateKeys[0]}`}>
            {item.satisfied ? "Configured" : "Add key"}
          </a>
        </article>
      ))}
    </section>
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

function PanelHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="panelHeader">
      <h2>{title}</h2>
      {detail && <span>{detail}</span>}
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
