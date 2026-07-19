import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configRoot = path.join(root, "config", "production");
const outputDir = path.join(root, "outputs", "production_os");

const contracts = [
  ["projectProfile", "codex_os_project_profile.json"],
  ["subsystemRegistry", "subsystem_registry.json"],
  ["uiExperienceRegistry", "ui_experience_registry.json"],
  ["assetRegistry", "asset_registry.json"],
  ["toolchainRegistry", "toolchain_registry.json"],
  ["stagePlan", "production_stage_plan.json"],
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function addFinding(findings, severity, code, subject, message) {
  findings.push({ severity, code, subject, message });
}

function findTaskCycles(tasks) {
  const dependencies = new Map(tasks.map((task) => [task.id, task.dependsOn || []]));
  const visiting = new Set();
  const visited = new Set();
  const cycles = [];

  function visit(id, trail) {
    if (visiting.has(id)) {
      const start = trail.indexOf(id);
      cycles.push([...trail.slice(start), id]);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of dependencies.get(id) || []) {
      if (dependencies.has(dependency)) visit(dependency, [...trail, id]);
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const id of dependencies.keys()) visit(id, []);
  return cycles;
}

function validateSchemas(documents, findings) {
  const schemaPath = path.join(configRoot, "schemas", "production_os_contract.schema.json");
  const schema = readJson(schemaPath);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  ajv.addSchema(schema);

  for (const [definition, fileName] of contracts) {
    const validate = ajv.compile({
      $ref: `${schema.$id}#/$defs/${definition}`,
    });
    const valid = validate(documents[definition]);
    if (!valid) {
      for (const error of validate.errors || []) {
        addFinding(
          findings,
          "P0",
          "SCHEMA_INVALID",
          `${fileName}${error.instancePath || "/"}`,
          error.message || "JSON Schema validation failed.",
        );
      }
    }
  }

  return {
    path: relative(schemaPath),
    sha256: sha256(schemaPath),
  };
}

function validateSemantics(documents, findings) {
  const profile = documents.projectProfile;
  const subsystems = documents.subsystemRegistry;
  const ui = documents.uiExperienceRegistry;
  const assets = documents.assetRegistry;
  const tools = documents.toolchainRegistry;
  const plan = documents.stagePlan;

  const taskIds = new Set(plan.tasks.map((task) => task.id));
  const gateIds = new Set(plan.gates.map((gate) => gate.id));
  const assetIds = new Set(assets.assets.map((asset) => asset.id));

  const idCollections = [
    ["tasks", plan.tasks.map((item) => item.id)],
    ["gates", plan.gates.map((item) => item.id)],
    ["subsystems", subsystems.subsystems.map((item) => item.id)],
    ["screens", ui.screens.map((item) => item.id)],
    ["viewports", ui.viewports.map((item) => item.id)],
    ["assets", assets.assets.map((item) => item.id)],
    ["asset slots", assets.requiredSlots.map((item) => item.id)],
    ["tools", tools.tools.map((item) => item.id)],
  ];
  for (const [subject, values] of idCollections) {
    const duplicates = duplicateValues(values);
    if (duplicates.length) {
      addFinding(findings, "P0", "DUPLICATE_ID", subject, `Duplicate IDs: ${duplicates.join(", ")}`);
    }
  }

  const expectedGates = Array.from({ length: 8 }, (_, index) => `G${index}`);
  const missingGates = expectedGates.filter((id) => !gateIds.has(id));
  const extraGates = [...gateIds].filter((id) => !expectedGates.includes(id));
  if (missingGates.length || extraGates.length) {
    addFinding(
      findings,
      "P0",
      "GATE_SET_INVALID",
      "production_stage_plan.gates",
      `Expected G0-G7; missing=${missingGates.join(",") || "none"} extra=${extraGates.join(",") || "none"}.`,
    );
  }

  for (const task of plan.tasks) {
    for (const dependency of task.dependsOn || []) {
      if (!taskIds.has(dependency)) {
        addFinding(findings, "P0", "UNKNOWN_TASK_DEPENDENCY", task.id, `Unknown dependency: ${dependency}`);
      }
      if (dependency === task.id) {
        addFinding(findings, "P0", "SELF_DEPENDENCY", task.id, "A task cannot depend on itself.");
      }
    }
    if (!gateIds.has(task.gate)) {
      addFinding(findings, "P0", "UNKNOWN_TASK_GATE", task.id, `Unknown gate: ${task.gate}`);
    }
    if (task.status === "done" && (task.evidence || []).length === 0) {
      addFinding(findings, "P0", "DONE_WITHOUT_EVIDENCE", task.id, "Done tasks require evidence.");
    }
    if (task.status === "postponed" && !task.postponedReason) {
      addFinding(findings, "P0", "POSTPONED_WITHOUT_REASON", task.id, "Postponed tasks require a reason.");
    }
  }

  for (const cycle of findTaskCycles(plan.tasks)) {
    addFinding(findings, "P0", "TASK_DEPENDENCY_CYCLE", cycle[0], cycle.join(" -> "));
  }

  for (const gate of plan.gates) {
    for (const taskId of gate.requiredTaskIds) {
      if (!taskIds.has(taskId)) {
        addFinding(findings, "P0", "UNKNOWN_GATE_TASK", gate.id, `Unknown required task: ${taskId}`);
      }
    }
    if (gate.status.startsWith("pass")) {
      const unfinished = gate.requiredTaskIds.filter((id) => {
        const task = plan.tasks.find((item) => item.id === id);
        return task?.status !== "done";
      });
      if (unfinished.length) {
        addFinding(
          findings,
          "P0",
          "PASSED_GATE_HAS_UNFINISHED_TASK",
          gate.id,
          `Passed gate contains unfinished tasks: ${unfinished.join(", ")}`,
        );
      }
    }
  }

  for (const subsystem of subsystems.subsystems) {
    for (const taskId of subsystem.nextTaskIds) {
      if (!taskIds.has(taskId)) {
        addFinding(findings, "P0", "UNKNOWN_SUBSYSTEM_TASK", subsystem.id, `Unknown task: ${taskId}`);
      }
    }
    for (const file of [subsystem.stateAuthority, ...(subsystem.runtimeModules || []), ...(subsystem.configuration || [])]) {
      if (file.startsWith("outputs/")) continue;
      if (!fs.existsSync(path.join(root, file))) {
        addFinding(findings, "P0", "MISSING_SUBSYSTEM_FILE", subsystem.id, `Missing project file: ${file}`);
      }
    }
  }

  const screenContractPath = path.join(root, "config", "wuxia_first_session_screen_contract.json");
  const screenContract = readJson(screenContractPath);
  const activeScreenIds = new Set(Object.keys(screenContract.screens || {}));
  const registeredScreenIds = new Set(ui.screens.map((screen) => screen.id));
  const missingRegisteredScreens = [...activeScreenIds].filter((id) => !registeredScreenIds.has(id));
  const unknownRegisteredScreens = [...registeredScreenIds].filter((id) => !activeScreenIds.has(id));
  if (missingRegisteredScreens.length || unknownRegisteredScreens.length) {
    addFinding(
      findings,
      "P0",
      "UI_SCREEN_DRIFT",
      "ui_experience_registry.screens",
      `Missing=${missingRegisteredScreens.join(",") || "none"} unknown=${unknownRegisteredScreens.join(",") || "none"}.`,
    );
  }
  const expectedPairs = ui.screens.length * ui.viewports.length;
  if (ui.acceptancePolicy.requiredScreenViewportPairs !== expectedPairs) {
    addFinding(
      findings,
      "P0",
      "UI_MATRIX_COUNT_DRIFT",
      "ui_experience_registry.acceptancePolicy",
      `Configured ${ui.acceptancePolicy.requiredScreenViewportPairs}, expected ${expectedPairs}.`,
    );
  }

  const projectScope = readJson(path.join(root, "config", "project_scope.json"));
  const shippingFiles = new Set(projectScope.shippingFiles || []);
  for (const asset of assets.assets) {
    if (asset.adoption === "ship") {
      if (asset.provenance !== "project-owned" || asset.licenseStatus !== "approved") {
        addFinding(findings, "P0", "UNAPPROVED_SHIPPING_ASSET", asset.id, "Shipping assets must be project-owned and approved.");
      }
      if (!asset.shippingPath || !asset.sha256) {
        addFinding(findings, "P0", "INCOMPLETE_SHIPPING_ASSET", asset.id, "Shipping path and SHA-256 are required.");
        continue;
      }
      const filePath = path.join(root, asset.shippingPath);
      if (!fs.existsSync(filePath)) {
        addFinding(findings, "P0", "MISSING_SHIPPING_ASSET", asset.id, `Missing ${asset.shippingPath}`);
        continue;
      }
      const actualHash = sha256(filePath);
      const actualBytes = fs.statSync(filePath).size;
      if (actualHash !== asset.sha256) {
        addFinding(findings, "P0", "SHIPPING_ASSET_HASH_DRIFT", asset.id, `Expected ${asset.sha256}, got ${actualHash}.`);
      }
      if (actualBytes !== asset.bytes) {
        addFinding(findings, "P0", "SHIPPING_ASSET_SIZE_DRIFT", asset.id, `Expected ${asset.bytes}, got ${actualBytes}.`);
      }
      if (!shippingFiles.has(asset.shippingPath)) {
        addFinding(findings, "P0", "SHIPPING_ASSET_OUTSIDE_SCOPE", asset.id, `${asset.shippingPath} is not in project_scope.shippingFiles.`);
      }
    } else if (asset.shippingPath) {
      addFinding(findings, "P0", "NONSHIPPING_ASSET_HAS_SHIPPING_PATH", asset.id, "Only adoption=ship may define shippingPath.");
    }
  }

  for (const slot of assets.requiredSlots) {
    if (slot.status === "satisfied" && (!slot.assetId || !assetIds.has(slot.assetId))) {
      addFinding(findings, "P0", "SATISFIED_SLOT_WITHOUT_ASSET", slot.id, "Satisfied slots require a known assetId.");
    }
    if (slot.status === "open" && (!slot.taskId || !taskIds.has(slot.taskId))) {
      addFinding(findings, "P0", "OPEN_SLOT_WITHOUT_TASK", slot.id, "Open slots require a known taskId.");
    }
  }

  for (const tool of tools.tools) {
    if (tool.taskId && !taskIds.has(tool.taskId)) {
      addFinding(findings, "P0", "UNKNOWN_TOOL_TASK", tool.id, `Unknown task: ${tool.taskId}`);
    }
  }

  const authorityPaths = Object.values(profile.authorities);
  for (const authorityPath of authorityPaths) {
    if (!fs.existsSync(path.join(root, authorityPath))) {
      addFinding(findings, "P0", "MISSING_AUTHORITY_FILE", authorityPath, "Declared authority does not exist.");
    }
  }

  const inactiveIds = new Set(profile.inactiveEngines.map((engine) => engine.id));
  for (const engineId of ["ue5", "cocos-creator", "godot", "unity"]) {
    if (!inactiveIds.has(engineId)) {
      addFinding(findings, "P0", "INACTIVE_ENGINE_MISSING", engineId, "Non-project engine must be explicitly inactive.");
    }
  }

  const postponedTasks = new Set(plan.tasks.filter((task) => task.status === "postponed").map((task) => task.id));
  for (const postponed of profile.postponedScope) {
    if (postponed.id === "CombatSession") continue;
    if (!postponedTasks.has(postponed.id)) {
      addFinding(findings, "P0", "POSTPONED_SCOPE_DRIFT", postponed.id, "Profile-postponed task is not postponed in stage plan.");
    }
  }
}

export function loadProductionDocuments() {
  return Object.fromEntries(
    contracts.map(([definition, fileName]) => [
      definition,
      readJson(path.join(configRoot, fileName)),
    ]),
  );
}

export function validateProductionDocuments(documents) {
  const findings = [];
  const schema = validateSchemas(documents, findings);
  validateSemantics(documents, findings);
  return { findings, schema };
}

export function runProductionValidation({ writeReport = true } = {}) {
  const documents = loadProductionDocuments();
  const { findings, schema } = validateProductionDocuments(documents);
  const report = {
    schema: "idlewuxia.production_validation_report.v1",
    generatedAt: new Date().toISOString(),
    status: findings.some((finding) => finding.severity === "P0") ? "fail" : "pass",
    source: {
      schema,
      configs: contracts.map(([, fileName]) => {
        const filePath = path.join(configRoot, fileName);
        return {
          path: relative(filePath),
          sha256: sha256(filePath),
          bytes: fs.statSync(filePath).size,
        };
      }),
    },
    summary: {
      configs: contracts.length,
      gates: documents.stagePlan.gates.length,
      tasks: documents.stagePlan.tasks.length,
      subsystems: documents.subsystemRegistry.subsystems.length,
      screens: documents.uiExperienceRegistry.screens.length,
      viewports: documents.uiExperienceRegistry.viewports.length,
      screenViewportPairs:
        documents.uiExperienceRegistry.screens.length * documents.uiExperienceRegistry.viewports.length,
      assets: documents.assetRegistry.assets.length,
      shippingAssets: documents.assetRegistry.assets.filter((asset) => asset.adoption === "ship").length,
      tools: documents.toolchainRegistry.tools.length,
      findings: findings.length,
      p0: findings.filter((finding) => finding.severity === "P0").length,
    },
    findings,
  };

  if (writeReport) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "validation-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  return { report, documents };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { report } = runProductionValidation();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "pass") process.exitCode = 1;
}
