import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { deterministicUuidFromHex, parseGradleCoordinates, sha256Bytes, sha256File } from "./lib/release-build.mjs";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, ""));
const contract = readJson("config/production/release_build_contract.json");
const lock = readJson("package-lock.json");
const gradleReportPath = path.join(root, contract.sbom.gradleDependencyReportPath);
const gradleText = fs.existsSync(gradleReportPath) ? fs.readFileSync(gradleReportPath, "utf8") : "";

function encodePurlPart(value) {
  return String(value).split("/").map(encodeURIComponent).join("/");
}

const npmComponents = [];
for (const [packagePath, row] of Object.entries(lock.packages || {})) {
  if (!packagePath.startsWith("node_modules/") || !row.version) continue;
  const name = packagePath.slice("node_modules/".length);
  const purl = `pkg:npm/${encodePurlPart(name)}@${encodeURIComponent(row.version)}`;
  npmComponents.push({
    type: "library",
    "bom-ref": purl,
    name,
    version: row.version,
    purl,
    scope: row.dev ? "optional" : "required",
    hashes: row.integrity?.startsWith("sha512-")
      ? [{ alg: "SHA-512", content: Buffer.from(row.integrity.slice("sha512-".length), "base64").toString("hex") }]
      : undefined,
  });
}
npmComponents.sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"], "en"));

const gradleComponents = parseGradleCoordinates(gradleText).map((row) => {
  const purl = `pkg:maven/${encodeURIComponent(row.group)}/${encodeURIComponent(row.name)}@${encodeURIComponent(row.version)}`;
  return { type: "library", "bom-ref": purl, group: row.group, name: row.name, version: row.version, purl, scope: "required" };
});
const componentsByRef = new Map([...npmComponents, ...gradleComponents].map((row) => [row["bom-ref"], row]));
const components = [...componentsByRef.values()].sort((left, right) => left["bom-ref"].localeCompare(right["bom-ref"], "en"));
const lockHash = sha256File(path.join(root, "package-lock.json"));
const gradleHash = gradleText ? sha256Bytes(Buffer.from(gradleText)) : null;
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const commitTime = execFileSync("git", ["show", "-s", "--format=%cI", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const seed = sha256Bytes(Buffer.from(`${commit}\n${lockHash}\n${gradleHash || "missing"}`));
const completeness = gradleText.includes("releaseRuntimeClasspath") && gradleComponents.length > 0 ? "complete" : "npm-complete-gradle-unresolved";
const applicationRef = `pkg:npm/idlewuxia@${encodeURIComponent(lock.version || "0.0.0")}`;
const bom = {
  bomFormat: "CycloneDX",
  specVersion: contract.sbom.specVersion,
  serialNumber: `urn:uuid:${deterministicUuidFromHex(seed)}`,
  version: 1,
  metadata: {
    timestamp: commitTime,
    component: { type: "application", "bom-ref": applicationRef, name: "idlewuxia", version: lock.version || "0.0.0" },
    properties: [
      { name: "idlewuxia:sourceCommit", value: commit },
      { name: "idlewuxia:packageLockSha256", value: lockHash },
      { name: "idlewuxia:gradleReportSha256", value: gradleHash || "missing" },
      { name: "idlewuxia:completeness", value: completeness }
    ]
  },
  components,
  dependencies: [{ ref: applicationRef, dependsOn: components.map((row) => row["bom-ref"]) }],
  properties: [
    { name: "idlewuxia:completeness", value: completeness },
    { name: "idlewuxia:npmComponents", value: String(npmComponents.length) },
    { name: "idlewuxia:gradleComponents", value: String(gradleComponents.length) },
    { name: "idlewuxia:totalComponents", value: String(components.length) }
  ]
};
const output = path.join(root, contract.sbom.outputPath);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(bom, null, 2)}\n`);
console.log(JSON.stringify({
  status: completeness === "complete" ? "pass" : "pass-with-known-limitation",
  output: contract.sbom.outputPath,
  npmComponents: npmComponents.length,
  gradleComponents: gradleComponents.length,
  totalComponents: components.length,
  completeness
}, null, 2));
