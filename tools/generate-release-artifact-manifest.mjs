import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { normalizeFingerprint, releaseInputInventory, sha256File } from "./lib/release-build.mjs";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, ""));
const contract = readJson("config/production/release_build_contract.json");
const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const actualFingerprint = normalizeFingerprint(arg("signing-certificate-sha256"));
const expectedFingerprint = normalizeFingerprint(process.env[contract.externalSigning.certificateFingerprintEnvironment]);
if (!actualFingerprint || !expectedFingerprint || actualFingerprint !== expectedFingerprint) throw new Error("The verified artifact signing certificate does not match IDLEWUXIA_RELEASE_CERT_SHA256.");
const artifacts = contract.androidBuild.artifacts.map((row) => {
  const file = path.join(root, row.publishedPath);
  if (!fs.existsSync(file)) throw new Error(`Release artifact is missing: ${row.publishedPath}`);
  return { kind: row.kind, path: row.publishedPath, bytes: fs.statSync(file).size, sha256: sha256File(file) };
});
const r8MappingPath = path.join(root, contract.androidBuild.mappingEvidence.publishedPath);
if (!fs.existsSync(r8MappingPath)) throw new Error(`R8 mapping evidence is missing: ${contract.androidBuild.mappingEvidence.publishedPath}`);
const sbomPath = path.join(root, contract.sbom.outputPath);
const webManifestPath = path.join(root, JSON.parse(fs.readFileSync(path.join(root, "config/web_bundle_contract.json"), "utf8")).manifestPath);
const reproducibilityPath = path.join(root, contract.reproducibility.reportPath);
for (const file of [sbomPath, webManifestPath, reproducibilityPath]) if (!fs.existsSync(file)) throw new Error(`Required release evidence is missing: ${path.relative(root, file)}`);
const reproducibility = JSON.parse(fs.readFileSync(reproducibilityPath, "utf8"));
if (reproducibility.pass !== true) throw new Error("Reproducibility report is not PASS.");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const upstreamCommit = execFileSync("git", ["rev-parse", "@{upstream}"], { cwd: root, encoding: "utf8" }).trim();
if (sourceCommit !== upstreamCommit) throw new Error("Local commit is not equal to its upstream commit.");
const clean = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim() === "";
if (!clean) throw new Error("Worktree must be clean before a formal artifact manifest is generated.");
const manifest = {
  schema: contract.traceability.manifestSchema,
  generatedAt: new Date().toISOString(),
  applicationId: contract.applicationId,
  versionCode: contract.releaseVersion.versionCode,
  versionName: contract.releaseVersion.versionName,
  sourceCommit,
  upstreamCommit,
  greenCiCommit: process.env.IDLEWUXIA_GREEN_CI_SHA || null,
  configAndBuildInputs: releaseInputInventory(root, contract),
  webBundleManifestSha256: sha256File(webManifestPath),
  sbomSha256: sha256File(sbomPath),
  artifacts,
  r8Mapping: {
    path: contract.androidBuild.mappingEvidence.publishedPath,
    bytes: fs.statSync(r8MappingPath).size,
    sha256: sha256File(r8MappingPath)
  },
  signingCertificateSha256: actualFingerprint,
  toolVersions: {
    node: process.version,
    java: arg("java-version"),
    gradle: arg("gradle-version"),
    androidBuildTools: arg("android-build-tools-version")
  },
  reproducibility
};
const output = path.join(root, contract.traceability.manifestPath);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ status: "pass", output: contract.traceability.manifestPath, artifacts }, null, 2));
