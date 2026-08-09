import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";
import { auditMergedAndroidManifest, auditSecurityDocuments } from "./lib/security-release.mjs";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const readJson = (relative) => JSON.parse(read(relative));
const contract = readJson("config/production/security_release_contract.json");
const schema = readJson("config/production/schemas/security_release_contract.schema.json");
const ajv = new Ajv2020({ allErrors: true, strict: true });
if (!ajv.validate(schema, contract)) {
  console.error(JSON.stringify({ pass: false, type: "schema-validation", errors: ajv.errors }, null, 2));
  process.exit(1);
}

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { cwd: root }).toString("utf8").split("\0").filter(Boolean).map((file) => file.replaceAll("\\", "/"));
const scanFiles = trackedFiles.filter((file) => contract.secrets.scanRoots.some((candidate) => candidate.endsWith("/") ? file.startsWith(candidate) : file === candidate));
const scannedTexts = scanFiles.filter((file) => !/\.(?:jar|png|jpg|jpeg|gif|webp|mp3|wav|ogg|apk|aab)$/i.test(file)).map((file) => ({ file, content: read(file) }));
const projectScope = readJson("config/project_scope.json");
const runtimeAuditFiles = [...new Set([
  ...projectScope.shippingFiles,
  "package.json",
  "capacitor.config.json",
  "android/app/build.gradle",
  "android/app/src/main/AndroidManifest.xml",
  ".github/workflows/ci.yml",
])];
const runtimeTexts = runtimeAuditFiles.map((file) => ({ file, content: read(file) }));
const audit = auditSecurityDocuments({
  contract,
  html: read("index.html"),
  manifestXml: read("android/app/src/main/AndroidManifest.xml"),
  filePathsXml: read("android/app/src/main/res/xml/file_paths.xml"),
  analytics: readJson("config/analytics_events.json"),
  packageJson: readJson("package.json"),
  runtimeTexts,
  trackedFiles,
  scannedTexts,
});
const mergedArgumentIndex = process.argv.indexOf("--merged-manifest");
const mergedManifestPath = mergedArgumentIndex >= 0 ? process.argv[mergedArgumentIndex + 1] : null;
const mergedAudit = mergedManifestPath
  ? auditMergedAndroidManifest(contract, read(mergedManifestPath))
  : null;
if (mergedAudit?.findings.length) {
  audit.pass = false;
  audit.findings.push(...mergedAudit.findings);
}
const report = {
  schema: "idlewuxia.security_release_audit.v1",
  generatedAt: new Date().toISOString(),
  status: audit.pass ? "pass" : "fail",
  runtimeProfile: contract.runtimeProfile,
  summary: {
    cspDirectives: Object.keys(audit.csp).length,
    androidPermissions: audit.permissions.length,
    exportedComponents: audit.exported.length,
    fileProviderPathElements: audit.fileProviderPathElements,
    runtimeDependencies: audit.runtimeDependencies,
    activatedExternalServices: contract.externalServices.activated.length,
    mergedManifestAudited: Boolean(mergedAudit),
    mergedManifestPermissions: mergedAudit?.permissions || [],
    mergedManifestExportedComponents: mergedAudit?.exported || [],
    scannedFiles: audit.scannedFileCount,
    findings: audit.findings.length,
  },
  knownReleaseBoundaries: contract.knownReleaseBoundaries,
  findings: audit.findings,
};
const output = path.join(root, "outputs/security/sec001_security_audit.json");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!audit.pass) process.exit(1);
