import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { evaluateAndroidIdentity } from "./lib/android-identity.mjs";

const root = path.resolve(".");
const outputDir = path.join(root, "outputs", "android_identity");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, ""));
}

function trackedFromGit() {
  const output = execFileSync("git", ["-c", "core.quotepath=false", "ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output.split("\0").filter(Boolean);
}

const injectedSnapshot = process.env.IDLEWUXIA_GIT_SNAPSHOT
  ? JSON.parse(Buffer.from(process.env.IDLEWUXIA_GIT_SNAPSHOT, "base64").toString("utf8"))
  : null;
const trackedFiles = injectedSnapshot?.trackedFiles || trackedFromGit();
const contract = readJson("config/android_identity_contract.json");
const files = {};
for (const file of trackedFiles) {
  const absolute = path.join(root, file);
  if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) files[file] = fs.readFileSync(absolute, "utf8");
}

const result = evaluateAndroidIdentity({ contract, files, trackedFiles });
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, "android_identity_audit.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), ...result }, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(outputDir, "android_identity_audit.md"),
  [
    "# Android Identity Audit",
    "",
    `- Result: ${result.pass ? "PASS" : "FAIL"}`,
    `- Application ID: \`${result.applicationId}\``,
    `- Debug ID: \`${result.debugApplicationId}\``,
    `- Launcher: \`${result.launcherClass}\``,
    `- App name: ${result.appName}`,
    `- Findings: ${result.findings.length}`,
    "",
    ...(result.findings.length ? result.findings.map((row) => `- [${row.code}] ${row.subject}: ${row.message}`) : ["- Clean."]),
    "",
  ].join("\n"),
);

console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exitCode = 1;
