import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

import {
  collectEvidenceReferenceEntries,
  EVIDENCE_SCHEMA,
  EVIDENCE_SOURCE_KINDS,
  evidenceReferences,
  validateEvidenceContract,
} from "../src/evidenceContract.js";
import { materializeWebBundle } from "./lib/web-bundle-freshness.mjs";

const root = process.cwd();
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const schemaPath = path.join(root, "config", "wuxia_evidence_contract.schema.json");
const outputDir = path.join(root, "outputs", "wuxia_evidence_contract");
const flow = JSON.parse(fs.readFileSync(flowPath, "utf8").replace(/^\uFEFF/, ""));
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8").replace(/^\uFEFF/, ""));
const report = validateEvidenceContract(flow);
const canonicalEntries = collectEvidenceReferenceEntries(flow).filter((entry) => entry.shape === "canonical");
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  allowUnionTypes: true,
});
ajv.addKeyword({ keyword: "x-idlewuxia-migration" });
const validateSchema = ajv.compile(schema);

function appendSchemaFindings(candidate, prefix) {
  if (validateSchema(candidate)) return;
  for (const error of validateSchema.errors || []) {
    report.findings.push({
      severity: "error",
      code: "JSON_SCHEMA_VIOLATION",
      path: `${prefix}${error.instancePath || "$"}`,
      detail: `${error.keyword}: ${error.message || "schema mismatch"}`,
    });
  }
}

appendSchemaFindings(flow, "source:");

const scope = JSON.parse(
  fs.readFileSync(path.join(root, "config", "project_scope.json"), "utf8").replace(/^\uFEFF/, ""),
);
const sourceFiles = new Map();
for (const relativePath of scope.shippingFiles || []) {
  const sourcePath = path.join(root, relativePath);
  if (fs.existsSync(sourcePath)) sourceFiles.set(relativePath, fs.readFileSync(sourcePath));
}
const materialized = materializeWebBundle({ scope, sourceFiles });
for (const finding of materialized.findings) {
  report.findings.push({
    severity: "error",
    code: `WEB_MATERIALIZATION_${finding.type}`,
    path: finding.path,
    detail: finding.detail,
  });
}
const shippingFlowBytes = materialized.outputFiles.get("config/wuxia_first_session_flow.json");
let shippingEvidenceStripped = false;
if (!shippingFlowBytes) {
  report.findings.push({
    severity: "error",
    code: "SHIPPING_FLOW_MISSING",
    path: "shipping:config/wuxia_first_session_flow.json",
    detail: "Materialized shipping closure did not contain the first-session flow.",
  });
} else {
  const shippingFlow = JSON.parse(shippingFlowBytes.toString("utf8").replace(/^\uFEFF/, ""));
  const leakedEvidencePaths = [];
  const visitShipping = (value, valuePath = "$") => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visitShipping(entry, `${valuePath}[${index}]`));
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      const childPath = `${valuePath}.${key}`;
      if ([
        "evidenceSchema",
        "evidence",
        "sourceEvidence",
        "sourceFile",
        "sourceRecord",
        "sourceKind",
      ].includes(key)) {
        leakedEvidencePaths.push(childPath);
      }
      visitShipping(entry, childPath);
    }
  };
  visitShipping(shippingFlow);
  shippingEvidenceStripped = leakedEvidencePaths.length === 0;
  for (const leakedPath of leakedEvidencePaths) {
    report.findings.push({
      severity: "error",
      code: "SHIPPING_EVIDENCE_LEAK",
      path: `shipping:${leakedPath}`,
      detail: "Development provenance must be stripped together with evidenceSchema.",
    });
  }
}

if (schema.$id !== "idlewuxia.evidence_contract.v2") {
  report.findings.push({
    severity: "error",
    code: "CONTRACT_ID_MISMATCH",
    path: "$schema.$id",
    detail: "Expected idlewuxia.evidence_contract.v2.",
  });
}
if (schema.properties?.evidenceSchema?.const !== EVIDENCE_SCHEMA) {
  report.findings.push({
    severity: "error",
    code: "CONTRACT_RUNTIME_SCHEMA_MISMATCH",
    path: "$schema.properties.evidenceSchema.const",
    detail: `Expected ${EVIDENCE_SCHEMA}.`,
  });
}
const schemaSourceKinds = schema.$defs?.sourceKind?.enum || [];
if (JSON.stringify(schemaSourceKinds) !== JSON.stringify(EVIDENCE_SOURCE_KINDS)) {
  report.findings.push({
    severity: "error",
    code: "SOURCE_KIND_ENUM_MISMATCH",
    path: "$schema.$defs.sourceKind.enum",
    detail: "Runtime and JSON Schema source-kind vocabularies differ.",
  });
}

const playerSeedReferences = evidenceReferences(flow.playerSeed);
if (playerSeedReferences.length !== 1) {
  report.findings.push({
    severity: "error",
    code: "PLAYER_SEED_REFERENCE_COUNT",
    path: "$.playerSeed",
    detail: "Player seed must resolve to exactly one typed source reference.",
  });
}
for (const reference of playerSeedReferences) {
  if (!fs.existsSync(path.join(root, reference.sourceFile))) {
    report.findings.push({
      severity: "error",
      code: "PLAYER_SEED_SOURCE_FILE_MISSING",
      path: "$.playerSeed.sourceFile",
      detail: reference.sourceFile,
    });
  }
}
let canonicalReferenceCount = 0;
let canonicalFileMatches = 0;
let canonicalLogicalReferences = 0;
let canonicalRecordChecks = 0;
let canonicalRecordMatches = 0;
for (const entry of canonicalEntries) {
  for (const reference of entry.references) {
    canonicalReferenceCount += 1;
    const normalizedSource = reference.sourceFile.replaceAll("\\", "/");
    if (
      normalizedSource.startsWith("res/script/")
      || normalizedSource.startsWith("outputs/")
    ) {
      canonicalLogicalReferences += 1;
      continue;
    }
    const absolute = path.isAbsolute(reference.sourceFile)
      ? reference.sourceFile
      : path.join(root, reference.sourceFile);
    if (!fs.existsSync(absolute)) {
      report.findings.push({
        severity: "error",
        code: "CANONICAL_SOURCE_FILE_MISSING",
        path: `${entry.ownerPath}.sourceFile`,
        detail: reference.sourceFile,
      });
      continue;
    }
    canonicalFileMatches += 1;
    if (!reference.sourceRecord || !/\.(?:csv|json|lua|md|txt)$/i.test(reference.sourceFile)) continue;
    canonicalRecordChecks += 1;
    const searchableToken = reference.sourceRecord.includes("=")
      ? reference.sourceRecord.split("=").at(-1)
      : reference.sourceRecord;
    const sourceText = fs.readFileSync(absolute, "utf8");
    if (sourceText.includes(searchableToken)) {
      canonicalRecordMatches += 1;
    } else {
      report.findings.push({
        severity: "error",
        code: "CANONICAL_SOURCE_RECORD_MISSING",
        path: `${entry.ownerPath}.sourceRecord`,
        detail: `${reference.sourceFile} :: ${reference.sourceRecord}`,
      });
    }
  }
}

report.status = report.findings.length ? "fail" : "pass";
report.summary = {
  ...report.summary,
  findings: report.findings.length,
  playerSeedReferences: playerSeedReferences.length,
  canonicalEntries: canonicalEntries.length,
  canonicalReferences: canonicalReferenceCount,
  canonicalFileMatches,
  canonicalLogicalReferences,
  canonicalRecordChecks,
  canonicalRecordMatches,
  sourceSchemaValid: !report.findings.some(
    (finding) => finding.code === "JSON_SCHEMA_VIOLATION" && finding.path.startsWith("source:"),
  ),
  shippingEvidenceStripped,
};
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "evidence_contract_validation.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(report, null, 2));
if (report.status !== "pass") process.exit(1);
