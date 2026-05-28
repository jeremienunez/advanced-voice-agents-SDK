import type {
  AgentInfraPlan,
  InfraIacArtifact,
  InfraIacBundle,
} from "@voiceagentsdk/core/sdk";

export class PlanOnlyInfraIacGenerator {
  createBundle(plan: AgentInfraPlan): InfraIacBundle {
    const artifacts = [
      jsonArtifact(
        "agent-infra.plan.json",
        "Portable agent infra plan for external IaC runners.",
        portablePlan(plan),
      ),
      ...targetArtifacts(plan),
    ];
    return {
      id: `iac_${plan.id}`,
      planId: plan.id,
      target: plan.computeTarget,
      applyMode: "manual",
      generatedAt: new Date().toISOString(),
      artifacts,
      notes: [
        "This bundle is generated output only; the starter does not apply it.",
        "Artifacts contain secret names and placeholders, never secret values.",
      ],
      warnings: plan.warnings,
    };
  }
}

function targetArtifacts(plan: AgentInfraPlan): InfraIacArtifact[] {
  if (plan.computeTarget === "vm") return vmArtifacts(plan);
  if (plan.computeTarget === "k3s") return kubernetesArtifacts(plan, "k3s");
  if (plan.computeTarget === "kubernetes") {
    return kubernetesArtifacts(plan, "kubernetes");
  }
  if (plan.computeTarget === "managed") {
    return [tofuVariablesArtifact(plan, "managed")];
  }
  return [
    textArtifact(
      "local/README.txt",
      "Local execution note.",
      [
        "Local target selected.",
        "Use the JSON plan as input for a local script or external runner.",
      ].join("\n"),
    ),
  ];
}

function vmArtifacts(plan: AgentInfraPlan): InfraIacArtifact[] {
  return [
    tofuVariablesArtifact(plan, "vm"),
    yamlArtifact(
      "vm/cloud-init.yaml",
      "Cloud-init bootstrap that writes the agent infra plan on a VM.",
      cloudInit(plan),
      "cloud-init",
    ),
  ];
}

function kubernetesArtifacts(
  plan: AgentInfraPlan,
  dialect: "k3s" | "kubernetes",
): InfraIacArtifact[] {
  const namespace = kubeName(plan.database.namespace || plan.draftId);
  return [
    yamlArtifact(
      `${dialect}/namespace.yaml`,
      `Namespace manifest for ${dialect}.`,
      namespaceManifest(namespace, plan),
      dialect,
    ),
    yamlArtifact(
      `${dialect}/agent-infra-config.yaml`,
      `ConfigMap carrying the agent infra plan for ${dialect}.`,
      configMapManifest(namespace, plan),
      dialect,
    ),
    yamlArtifact(
      `${dialect}/network-policy.yaml`,
      `Private-by-default network policy for ${dialect}.`,
      networkPolicyManifest(namespace),
      dialect,
    ),
    tofuVariablesArtifact(plan, dialect),
  ];
}

function namespaceManifest(namespace: string, plan: AgentInfraPlan): string {
  return [
    "apiVersion: v1",
    "kind: Namespace",
    "metadata:",
    `  name: ${namespace}`,
    "  labels:",
    "    app.kubernetes.io/part-of: voice-agent-sdk",
    `    voiceagentsdk.io/draft-id: ${yamlValue(plan.draftId)}`,
  ].join("\n");
}

function configMapManifest(namespace: string, plan: AgentInfraPlan): string {
  return [
    "apiVersion: v1",
    "kind: ConfigMap",
    "metadata:",
    "  name: voice-agent-infra-plan",
    `  namespace: ${namespace}`,
    "data:",
    "  agent-infra.plan.json: |-",
    indent(JSON.stringify(portablePlan(plan), null, 2), 4),
  ].join("\n");
}

function networkPolicyManifest(namespace: string): string {
  return [
    "apiVersion: networking.k8s.io/v1",
    "kind: NetworkPolicy",
    "metadata:",
    "  name: voice-agent-private-default",
    `  namespace: ${namespace}`,
    "spec:",
    "  podSelector: {}",
    "  policyTypes:",
    "    - Ingress",
    "    - Egress",
  ].join("\n");
}

function cloudInit(plan: AgentInfraPlan): string {
  return [
    "#cloud-config",
    "write_files:",
    "  - path: /etc/voice-agent/agent-infra.plan.json",
    "    owner: root:root",
    "    permissions: '0640'",
    "    content: |",
    indent(JSON.stringify(portablePlan(plan), null, 2), 6),
    "runcmd:",
    "  - [ sh, -lc, 'install -d -m 0750 /var/lib/voice-agent' ]",
  ].join("\n");
}

function tofuVariablesArtifact(
  plan: AgentInfraPlan,
  target: string,
): InfraIacArtifact {
  return jsonArtifact(
    `${target}/agent.auto.tfvars.json`,
    `OpenTofu variables for ${target} target.`,
    {
      agent_id: plan.draftId,
      namespace: plan.database.namespace,
      compute_target: plan.computeTarget,
      isolation: plan.isolation,
      provisioning_mode: plan.provisioningMode,
      default_backend_id: plan.defaultBackendId,
      runtime_database_credential_ref: plan.database.runtimeCredentialRef,
      network_policy: plan.security.networkPolicy,
      required_secret_names: plan.security.secretRefs,
      resources: plan.resources,
      knowledge_backends: plan.knowledgeBackends.map((backend) => ({
        id: backend.id,
        provider: backend.provider,
        role: backend.role,
        namespace: backend.namespace,
        required: backend.required,
        capabilities: backend.capabilities,
      })),
    },
    "opentofu",
  );
}

function portablePlan(plan: AgentInfraPlan) {
  return {
    planId: plan.id,
    draftId: plan.draftId,
    status: plan.status,
    computeTarget: plan.computeTarget,
    isolation: plan.isolation,
    provisioningMode: plan.provisioningMode,
    defaultBackendId: plan.defaultBackendId,
    database: plan.database,
    knowledgeBackends: plan.knowledgeBackends,
    resources: plan.resources,
    migrationPolicy: plan.migrationPolicy,
    security: {
      ...plan.security,
      secretRefs: plan.security.secretRefs,
    },
  };
}

function jsonArtifact(
  path: string,
  description: string,
  value: unknown,
  dialect: InfraIacArtifact["dialect"] = "json-plan",
): InfraIacArtifact {
  return {
    path,
    kind: dialect === "opentofu" ? "variables" : "plan",
    dialect,
    contentType: "application/json",
    content: JSON.stringify(value, null, 2),
    sensitive: false,
    description,
  };
}

function yamlArtifact(
  path: string,
  description: string,
  content: string,
  dialect: "cloud-init" | "kubernetes" | "k3s",
): InfraIacArtifact {
  return {
    path,
    kind: dialect === "cloud-init" ? "bootstrap" : "manifest",
    dialect,
    contentType: "text/yaml",
    content,
    sensitive: false,
    description,
  };
}

function textArtifact(
  path: string,
  description: string,
  content: string,
): InfraIacArtifact {
  return {
    path,
    kind: "plan",
    dialect: "json-plan",
    contentType: "text/plain",
    content,
    sensitive: false,
    description,
  };
}

function kubeName(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (normalized || "agent").slice(0, 63);
}

function yamlValue(value: string): string {
  return JSON.stringify(value);
}

function indent(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return value.split("\n").map((line) => `${prefix}${line}`).join("\n");
}
