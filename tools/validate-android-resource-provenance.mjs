import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const resourceRoot = path.join(root, "android", "app", "src", "main", "res");
const binaryExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);

function normalize(value) {
  return value.replaceAll("\\", "/");
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const tracked = new Set(execFileSync("git", ["ls-files", "-z"], {
  cwd: root,
  encoding: "utf8",
}).split("\0").filter(Boolean).map(normalize));

const binaryResources = walk(resourceRoot)
  .filter((file) => binaryExtensions.has(path.extname(file).toLowerCase()))
  .map((file) => normalize(path.relative(root, file)))
  .sort();
const untrackedBinaryResources = binaryResources.filter((file) => !tracked.has(file));

const report = {
  contract: "idlewuxia.android-resource-provenance.v1",
  status: untrackedBinaryResources.length === 0 ? "pass" : "fail",
  resourceRoot: normalize(path.relative(root, resourceRoot)),
  binaryResourceCount: binaryResources.length,
  trackedBinaryResourceCount: binaryResources.length - untrackedBinaryResources.length,
  untrackedBinaryResourceCount: untrackedBinaryResources.length,
  untrackedBinaryResources,
  rule: "Every binary Android product resource must be tracked so its provenance, review, and release inclusion are reproducible.",
};

const outputDirectory = path.join(root, "outputs", "android_resource_provenance");
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "android_resource_provenance_report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (report.status !== "pass") {
  console.error(`Android resource provenance: FAIL (${untrackedBinaryResources.length} untracked binary resources)`);
  for (const file of untrackedBinaryResources) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`Android resource provenance: PASS (${binaryResources.length} binary resources, all tracked)`);
