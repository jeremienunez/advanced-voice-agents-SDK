/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "solid-no-cycles",
      severity: "error",
      comment: "DIP/SRP: cycles hide responsibilities and make substitution unsafe.",
      from: {},
      to: { circular: true },
    },
    {
      name: "solid-no-unresolved-imports",
      severity: "error",
      comment: "A service boundary must resolve without runtime guesswork.",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "solid-no-unknown-packages",
      severity: "error",
      comment: "External dependencies must be declared explicitly.",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
    {
      name: "solid-no-duplicate-dependency-types",
      severity: "error",
      comment: "A package must not be both runtime and dev dependency.",
      from: {},
      to: {
        moreThanOneDependencyType: true,
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "solid-src-no-dev-deps",
      severity: "error",
      comment: "Production source cannot depend on dev-only packages.",
      from: {
        path: "^src/",
        pathNot: "\\.(?:test|spec)\\.(?:[cm]?[jt]sx?)$",
      },
      to: {
        dependencyTypes: ["npm-dev"],
        dependencyTypesNot: ["type-only"],
        pathNot: "node_modules/@types/",
      },
    },
    {
      name: "solid-no-dist-imports",
      severity: "error",
      comment: "Source modules must depend on source contracts, never build output.",
      from: {},
      to: { path: "(^|/)dist/" },
    },
    {
      name: "solid-core-is-product-agnostic",
      severity: "error",
      comment: "The SDK/runtime core cannot depend on starters, examples, or scripts.",
      from: { path: "^src/" },
      to: { path: "^(starters|examples|scripts)/" },
    },
    {
      name: "solid-sdk-is-foundation",
      severity: "error",
      comment: "SDK modules define contracts and cannot depend on runtime/client layers.",
      from: { path: "^src/sdk/" },
      to: { path: "^src/(server|client)/" },
    },
    {
      name: "solid-client-does-not-import-server",
      severity: "error",
      comment: "Browser client code cannot couple to server implementation.",
      from: { path: "^src/client/" },
      to: { path: "^src/server/" },
    },
    {
      name: "solid-server-does-not-import-client",
      severity: "error",
      comment: "Server implementation must depend on shared contracts, not client code.",
      from: { path: "^src/server/" },
      to: { path: "^src/client/" },
    },
    {
      name: "solid-starter-ui-does-not-import-server",
      severity: "error",
      comment: "Starter UI is a client service and cannot import server internals.",
      from: { path: "^starters/voip-rtc/src/" },
      to: { path: "^starters/voip-rtc/server/" },
    },
    {
      name: "solid-starter-server-does-not-import-ui",
      severity: "error",
      comment: "Starter server is a backend service and cannot import UI code.",
      from: { path: "^starters/voip-rtc/server/" },
      to: { path: "^starters/voip-rtc/src/" },
    },
    {
      name: "solid-ui-domain-is-pure",
      severity: "error",
      comment: "UI domain modules must stay framework/API free.",
      from: { path: "^starters/voip-rtc/src/domain/" },
      to: {
        path: "^starters/voip-rtc/src/(api|components|features|hooks)/|^starters/voip-rtc/server/",
      },
    },
    {
      name: "solid-ui-primitives-are-leaves",
      severity: "error",
      comment: "Reusable UI primitives cannot depend on app domain or features.",
      from: { path: "^starters/voip-rtc/src/components/ui/" },
      to: {
        path: "^starters/voip-rtc/src/(api|domain|features|hooks)/|^starters/voip-rtc/server/",
      },
    },
    {
      name: "solid-features-do-not-import-features",
      severity: "error",
      comment: "Feature slices communicate through app orchestration, hooks, API, or domain contracts.",
      from: { path: "^starters/voip-rtc/src/features/([^/]+)/" },
      to: {
        path: "^starters/voip-rtc/src/features/([^/]+)/",
        pathNot: "^starters/voip-rtc/src/features/$1/",
      },
    },
    {
      name: "solid-api-layer-does-not-import-ui",
      severity: "error",
      comment: "API clients are IO adapters and cannot depend on rendering or hooks.",
      from: { path: "^starters/voip-rtc/src/api/" },
      to: { path: "^starters/voip-rtc/src/(components|features|hooks)/" },
    },
    {
      name: "solid-builder-domain-is-pure",
      severity: "error",
      comment: "Builder domain cannot import adapters, state, routes, composition, or workflows.",
      from: { path: "^starters/voip-rtc/server/builder/domain/" },
      to: {
        path: "^starters/voip-rtc/server/builder/(adapters|composition|router|service|state|workflows|workflow-infra)\\b",
      },
    },
    {
      name: "solid-runtime-does-not-import-builder",
      severity: "error",
      comment: "Runtime execution must consume compiled contracts, not builder internals.",
      from: { path: "^starters/voip-rtc/server/runtime/" },
      to: { path: "^starters/voip-rtc/server/builder/" },
    },
    {
      name: "solid-learning-does-not-import-ui",
      severity: "error",
      comment: "Learning service is backend-only and must not know UI modules.",
      from: { path: "^starters/voip-rtc/server/learning/" },
      to: { path: "^starters/voip-rtc/src/" },
    },
    {
      name: "solid-http-does-not-import-app",
      severity: "error",
      comment: "HTTP policy must consume explicit route context, not app bootstrap internals.",
      from: { path: "^starters/voip-rtc/server/http/" },
      to: { path: "^starters/voip-rtc/server/app/" },
    },
    {
      name: "solid-http-does-not-import-voice",
      severity: "error",
      comment: "HTTP routes must use bootstrap context instead of voice internals.",
      from: { path: "^starters/voip-rtc/server/http/" },
      to: { path: "^starters/voip-rtc/server/voice/" },
    },
    {
      name: "solid-voice-does-not-import-app-or-http",
      severity: "error",
      comment: "Voice orchestration must stay reusable behind app/http composition.",
      from: { path: "^starters/voip-rtc/server/voice/" },
      to: { path: "^starters/voip-rtc/server/(app|http)/" },
    },
    {
      name: "solid-adapters-do-not-import-composition",
      severity: "error",
      comment: "Technical adapters bind external systems and must not depend on app/http/voice composition.",
      from: { path: "^starters/voip-rtc/server/adapters/" },
      to: { path: "^starters/voip-rtc/server/(app|http|voice)/" },
    },
    {
      name: "solid-tests-do-not-leak-into-production",
      severity: "error",
      comment: "Production modules cannot depend on test or BDD modules.",
      from: {
        path: "^(src|starters/voip-rtc/(src|server))/",
      },
      to: {
        path: "(^|/)(?:test-|.*\\.(?:test|spec)\\.|learning-bdd/|scripts/)",
      },
    },
  ],
  options: {
    includeOnly: [
      "^(src|starters/voip-rtc/(src|server|scripts)|examples|scripts)/",
    ],
    exclude: {
      path: [
        "(^|/)dist/",
        "(^|/)node_modules/",
        "^starters/voip-rtc/\\.builder-state/",
      ],
    },
    doNotFollow: {
      path: "node_modules",
    },
    combinedDependencies: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"],
      mainFields: ["module", "main", "types", "typings"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/(?:@[^/]+/[^/]+|[^/]+)",
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};
