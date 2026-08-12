import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildChapterPreview,
  buildRollbackEvidence,
  diffJson,
  hashJson,
  validateChapterPackage,
} from "./lib/chapter-authoring-workflow.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith("--") ? argv[++index] : true;
  }
  return args;
}

function resolveProjectPath(value, label) {
  if (!value || value === true) throw new Error(`Missing --${label}`);
  const resolved = path.resolve(root, String(value));
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`--${label} must stay inside the project workspace`);
  return resolved;
}

const args = parseArgs(process.argv.slice(2));
const inputPath = resolveProjectPath(args.input, "input");
const schemaPath = path.join(root, "config", "wuxia_chapter_definition.schema.json");
const combatPath = path.join(root, "config", "wuxia_combat_content.json");
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const input = readJson(inputPath);
const validation = validateChapterPackage({
  chapter: input,
  schema: readJson(schemaPath),
  combatContent: readJson(combatPath),
  externalEncounterIds: String(args["allow-external-encounters"] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
});

const report = {
  schema: "idlewuxia.chapter_authoring_inspection.v1",
  input: path.relative(root, inputPath).replace(/\\/g, "/"),
  inputHash: hashJson(input),
  validation,
  preview: buildChapterPreview(input),
};

if (args.compare) {
  const comparePath = resolveProjectPath(args.compare, "compare");
  const baseline = readJson(comparePath);
  report.compare = path.relative(root, comparePath).replace(/\\/g, "/");
  report.diff = diffJson(baseline, input);
  report.rollback = buildRollbackEvidence(baseline, input);
}

const rendered = `${JSON.stringify(report, null, 2)}\n`;
if (args.out) {
  const outputPath = resolveProjectPath(args.out, "out");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered, "utf8");
}
process.stdout.write(rendered);
if (!validation.valid) process.exitCode = 1;
