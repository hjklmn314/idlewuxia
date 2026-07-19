import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditReachability } from "./audit-wuxia-fb01-entity-reachability.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) =>
  JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const flow = readJson("config/wuxia_first_session_flow.json");
const policy = readJson("config/wuxia_fb01_entity_reachability_policy.json");

{
  const report = auditReachability({
    flow,
    policy,
    sourceCommit: "test",
  });
  assert.equal(report.verdict, "pass");
  assert.equal(report.summary.entities, 139);
  assert.equal(report.summary.reachableEntities, 129);
  assert.equal(report.summary.unreachableEntities, 10);
  assert.equal(report.summary.intentionalDormantEntities, 10);
  assert.equal(report.summary.unclassifiedUnreachableEntities, 0);
  assert.equal(report.summary.reachableActions, 334);
  assert.equal(report.summary.intentionalDormantActions, 24);
  for (const id of ["bf2r06_1a", "bf2r06_1b", "tmnpc01e"]) {
    assert.ok(
      report.rows.find((row) => row.entityId === id)?.reachable,
      `${id} must be reached through nested configured result traversal`,
    );
  }
}

{
  const broken = clone(policy);
  broken.decisions = broken.decisions.filter(
    (decision) => decision.entityId !== "zhongqiuchuzi",
  );
  const report = auditReachability({
    flow,
    policy: broken,
    sourceCommit: "test",
  });
  assert.ok(
    report.findings.some(
      (finding) => finding.code === "UNCLASSIFIED_UNREACHABLE",
    ),
    "an unclassified unreachable entity must fail",
  );
}

{
  const broken = clone(policy);
  broken.dormantModules.find(
    (module) => module.moduleId === "treasure_hunt",
  ).enabledInFirstSession = true;
  const report = auditReachability({
    flow,
    policy: broken,
    sourceCommit: "test",
  });
  assert.ok(
    report.findings.some(
      (finding) => finding.code === "DORMANT_MODULE_ENABLED",
    ),
    "a dormant module enabled in normal first session must fail",
  );
}

{
  const brokenFlow = clone(flow);
  delete brokenFlow.chapterSystem.resultEffectPolicies.skillConversion;
  const report = auditReachability({
    flow: brokenFlow,
    policy,
    sourceCommit: "test",
  });
  assert.ok(
    report.findings.some(
      (finding) =>
        finding.code === "UNCLASSIFIED_UNREACHABLE" &&
        finding.message.includes("tmnpc01e"),
    ),
    "nested reachability must depend on the configured skill-conversion result-list contract",
  );
}

console.log("FB01 entity reachability tests: PASS (4 cases)");
