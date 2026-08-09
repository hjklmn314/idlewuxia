import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import { compareShippingClosures, createHygieneReport } from "./lib/workspace-hygiene.mjs";

const root = process.cwd();
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};
const outputArg = argValue("--output") || "outputs/workspace_hygiene/hygiene_report.json";
const baselineArg = argValue("--baseline");

const manifest = readJson("config/production/workspace_hygiene_manifest.json");
const schema = readJson("config/production/schemas/workspace_hygiene_manifest.schema.json");
const ajv = new Ajv2020({ allErrors: true, strict: true });
if (!ajv.validate(schema, manifest)) {
  console.error(JSON.stringify({ pass: false, type: "schema-validation", errors: ajv.errors }, null, 2));
  process.exit(1);
}

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { cwd: root }).toString("utf8").split("\0").filter(Boolean);
const report = createHygieneReport({ root, trackedFiles, projectScope: readJson("config/project_scope.json"), manifest });
if (baselineArg) {
  const baseline = readJson(baselineArg);
  report.shippingClosureComparison = {
    baseline: baselineArg,
    changes: compareShippingClosures(baseline.shippingClosure, report.shippingClosure),
  };
  if (report.shippingClosureComparison.changes.length) {
    report.pass = false;
    report.findings.push({ severity: "error", type: "shipping-closure-changed", changes: report.shippingClosureComparison.changes });
  }
}

const outputPath = path.resolve(root, outputArg);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  pass: report.pass,
  trackedFileCount: report.trackedFileCount,
  counts: report.counts,
  activeModuleReachableCount: report.activeModuleReachableCount,
  activeLegacyImportCount: report.activeLegacyImportCount,
  shippingFiles: report.shippingClosure.length,
  shippingChanges: report.shippingClosureComparison?.changes.length ?? null,
  findings: report.findings,
  output: path.relative(root, outputPath).replaceAll("\\", "/"),
}, null, 2));
if (!report.pass) process.exit(1);
