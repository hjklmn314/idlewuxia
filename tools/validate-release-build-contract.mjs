import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import { auditReleaseBuildContract, releaseInputInventory } from "./lib/release-build.mjs";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(read(relativePath).replace(/^\uFEFF/, ""));
const contract = readJson("config/production/release_build_contract.json");
const schema = readJson("config/production/schemas/release_build_contract.schema.json");
const ajv = new Ajv2020({ allErrors: true, strict: true });
if (!ajv.validate(schema, contract)) {
  console.error(JSON.stringify({ status: "fail", type: "schema-validation", errors: ajv.errors }, null, 2));
  process.exit(1);
}

function git(args, fallback = "") {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return fallback;
  }
}

const args = new Set(process.argv.slice(2));
const strictRelease = args.has("--strict-release");
const phaseArgument = process.argv.find((value) => value.startsWith("--phase="));
const phase = phaseArgument?.slice("--phase=".length) || "tooling";
if (!["tooling", "prebuild", "postbuild"].includes(phase)) throw new Error(`Unsupported validation phase: ${phase}`);
const manifestPath = path.join(root, contract.traceability.manifestPath);
const sbomPath = path.join(root, contract.sbom.outputPath);
const audit = auditReleaseBuildContract({
  contract,
  buildGradle: read("android/app/build.gradle"),
  proguardRules: read("android/app/proguard-rules.pro"),
  plan: readJson("config/production/production_stage_plan.json"),
  trackedFiles: git(["ls-files", "-z"]).split("\0").filter(Boolean).map((file) => file.replaceAll("\\", "/")),
  inputInventory: releaseInputInventory(root, contract),
  environment: process.env,
  gitState: {
    clean: git(["status", "--porcelain"]) === "",
    head: git(["rev-parse", "HEAD"]),
    upstream: git(["rev-parse", "@{upstream}"]),
    greenCiCommit: process.env.IDLEWUXIA_GREEN_CI_SHA || "",
  },
  phase,
  artifactManifest: phase === "postbuild" && fs.existsSync(manifestPath) ? readJson(contract.traceability.manifestPath) : null,
  sbom: phase === "postbuild" && fs.existsSync(sbomPath) ? readJson(contract.sbom.outputPath) : null,
});

const report = {
  schema: "idlewuxia.release_build_preflight.v1",
  generatedAt: new Date().toISOString(),
  phase,
  status: audit.staticPass ? (audit.releaseEligible ? "release-eligible" : "tooling-pass-release-blocked") : "fail",
  strictRelease,
  staticPass: audit.staticPass,
  releaseEligible: audit.releaseEligible,
  summary: {
    inputFiles: contract.traceability.requiredInputFiles.length,
    artifactKinds: contract.androidBuild.artifacts.map((row) => row.kind),
    requiredDependencies: contract.releaseReadiness.requiredTaskIds.length,
    staticFindings: audit.findings.length,
    releaseBlockers: audit.releaseBlockers.length,
  },
  findings: audit.findings,
  releaseBlockers: audit.releaseBlockers,
};
const output = path.join(root, "outputs/release/release_build_preflight.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!audit.staticPass || (strictRelease && !audit.releaseEligible)) process.exit(1);
