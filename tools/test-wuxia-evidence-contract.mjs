import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

import {
  allEvidenceReferences,
  evidenceReferences,
  inferEvidenceSourceKind,
  migrateEvidenceContract,
  validateEvidenceContract,
} from "../src/evidenceContract.js";
import schema from "../config/wuxia_evidence_contract.schema.json" with { type: "json" };

const canonicalEvidence = {
  level: "cross_source_confirmed",
  sources: [
    {
      sourceFile: "evidence/task.csv",
      sourceRecord: "TaskId=10001",
      sourceKind: "project_generated",
    },
    {
      sourceFile: "evidence/rooms.csv",
      sourceRecord: "NODE_FB01_OUTER_GATE",
      sourceKind: "project_generated",
    },
  ],
};

assert.deepEqual(
  evidenceReferences(canonicalEvidence),
  canonicalEvidence.sources,
  "canonical multi-source evidence must preserve one typed reference per source file",
);

assert.deepEqual(
  evidenceReferences({
    level: "lua_confirmed",
    source: "res/script/map/mapRoom/fb01.lua",
    record: "fb01_01",
  }),
  [{
    sourceFile: "res/script/map/mapRoom/fb01.lua",
    sourceRecord: "fb01_01",
    sourceKind: "lua",
  }],
  "legacy single-file evidence must normalize through the same public interface",
);

const ambiguousReport = validateEvidenceContract({
  evidenceSchema: "idlewuxia.evidence.v2",
  playerSeed: { source: "recording_observed" },
  actions: [{
    evidence: {
      level: "cross_source_confirmed",
      source: "evidence/a.csv|evidence/b.csv",
      record: "A|B",
    },
  }],
});
assert.deepEqual(
  ambiguousReport.findings.map((entry) => entry.code).sort(),
  ["COMPOSITE_LEGACY_SOURCE", "PLAYER_SEED_LEGACY_SOURCE"],
  "the contract must reject overloaded source fields instead of guessing their meaning",
);

const legacyFlow = {
  playerSeed: { source: "recording_observed" },
  actions: [{
    evidence: {
      level: "cross_source_confirmed",
      source: "evidence/a.csv|evidence/b.csv",
      record: "A|B",
    },
  }],
};
const migrationContract = {
  playerSeedReference: {
    sourceFile: "public/competitor-reference/first-session/03_FS_003_CHARACTER_STATUS_frame_090s.png",
    sourceRecord: "FS_003_CHARACTER_STATUS",
    sourceKind: "recording",
    legacySource: "recording_observed",
  },
};
const migratedFlow = migrateEvidenceContract(legacyFlow, { direction: "up", contract: migrationContract });
assert.equal(migratedFlow.playerSeed.source, undefined);
assert.equal(migratedFlow.actions[0].evidence.sources.length, 2);
assert.deepEqual(
  migrateEvidenceContract(migratedFlow, { direction: "down", contract: migrationContract }),
  legacyFlow,
  "the versioned migration must support lossless rollback to the legacy evidence shape",
);

assert.deepEqual(
  evidenceReferences(migratedFlow.playerSeed),
  [{
    sourceFile: migrationContract.playerSeedReference.sourceFile,
    sourceRecord: migrationContract.playerSeedReference.sourceRecord,
    sourceKind: migrationContract.playerSeedReference.sourceKind,
  }],
  "a canonical direct provenance reference must use the same normalized interface",
);

const invalidPlayerSeedReport = validateEvidenceContract({
  evidenceSchema: "idlewuxia.evidence.v2",
  playerSeed: {
    sourceFile: "public/reference.png",
    sourceRecord: "FS_003_CHARACTER_STATUS",
    sourceKind: "recording_observed",
  },
});
assert.equal(
  invalidPlayerSeedReport.findings.some((entry) => entry.code === "INVALID_SOURCE_KIND"),
  true,
  "player provenance must use the same source-kind vocabulary as evidence references",
);

assert.equal(
  inferEvidenceSourceKind("public/reference/frame.png", "recording_observed"),
  "visual_reference",
  "visual evidence kind inference must not depend on a development-only path token",
);

const compositeSupplementalReport = validateEvidenceContract({
  evidenceSchema: "idlewuxia.evidence.v2",
  playerSeed: migrationContract.playerSeedReference,
  actions: [{
    evidence: {
      level: "cross_source_confirmed",
      source: "evidence/a.csv",
      sourceEvidence: "res/script/a.lua|res/script/b.lua",
    },
  }],
});
assert.equal(
  compositeSupplementalReport.findings.some((entry) => entry.code === "COMPOSITE_SOURCE_EVIDENCE"),
  true,
  "pipe-packed sourceEvidence must be rejected at every evidence owner",
);

const sourceEvidenceFlow = {
  playerSeed: { source: "recording_observed" },
  actions: [{
    evidence: {
      level: "cross_source_confirmed",
      source: "evidence/a.csv",
      record: "A",
      sourceEvidence: "res/script/a.lua|res/script/b.lua",
    },
  }],
};
const migratedSourceEvidenceFlow = migrateEvidenceContract(sourceEvidenceFlow, {
  direction: "up",
  contract: migrationContract,
});
assert.equal(typeof migratedSourceEvidenceFlow.actions[0].evidence.sourceEvidence, "object");
assert.equal(migratedSourceEvidenceFlow.actions[0].evidence.sourceEvidence.sources.length, 2);
assert.deepEqual(
  migrateEvidenceContract(migratedSourceEvidenceFlow, {
    direction: "down",
    contract: migrationContract,
  }),
  sourceEvidenceFlow,
  "supplemental multi-source evidence migration must be losslessly reversible",
);
assert.equal(
  allEvidenceReferences(migratedSourceEvidenceFlow.actions[0].evidence).length,
  3,
  "primary and supplemental references must remain individually addressable",
);

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
ajv.addKeyword({ keyword: "x-idlewuxia-migration" });
const validateSchema = ajv.compile(schema);
assert.equal(
  validateSchema({
    evidenceSchema: "idlewuxia.evidence.v2",
    playerSeed: migrationContract.playerSeedReference,
    states: [],
    actions: [{
      evidence: {
        level: "cross_source_confirmed",
        sources: [],
      },
    }],
    chapter1: {},
  }),
  false,
  "Draft 2020-12 schema must reject an empty canonical source collection",
);
assert.equal(
  validateSchema({
    evidenceSchema: "idlewuxia.evidence.v2",
    playerSeed: migrationContract.playerSeedReference,
    states: [],
    actions: [{
      evidence: {
        level: "cross_source_confirmed",
        source: "evidence/a.csv",
        sourceEvidence: "res/script/a.lua|res/script/b.lua",
      },
    }],
    chapter1: {},
  }),
  false,
  "Draft 2020-12 schema must reject a pipe-packed supplemental source",
);

const repairRoot = fs.mkdtempSync(path.join(os.tmpdir(), "idlewuxia-evidence-repair-"));
try {
  const repairConfigDir = path.join(repairRoot, "config");
  fs.mkdirSync(repairConfigDir, { recursive: true });
  for (const fileName of [
    "wuxia_first_session_flow.json",
    "wuxia_first_session_screen_contract.json",
  ]) {
    fs.copyFileSync(
      path.resolve("config", fileName),
      path.join(repairConfigDir, fileName),
    );
  }
  process.env.IDLEWUXIA_REPAIR_ROOT = repairRoot;
  await import(
    `${pathToFileURL(path.resolve("tools", "repair-wuxia-first-session-config.mjs")).href}?repair-test=${Date.now()}`
  );
  delete process.env.IDLEWUXIA_REPAIR_ROOT;
  const repairedFlow = JSON.parse(
    fs.readFileSync(path.join(repairConfigDir, "wuxia_first_session_flow.json"), "utf8"),
  );
  assert.equal(
    validateEvidenceContract(repairedFlow).status,
    "pass",
    "the tracked repair transform must not recreate a forbidden composite source",
  );
} finally {
  delete process.env.IDLEWUXIA_REPAIR_ROOT;
  fs.rmSync(repairRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ status: "pass", checks: 12 }, null, 2));
