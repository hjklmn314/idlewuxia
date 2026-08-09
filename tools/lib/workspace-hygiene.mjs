import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function normalizeRepoPath(value) {
  return String(value || "").replaceAll("\\", "/").replace(/^\.\//, "");
}

export function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function classifyTrackedFiles({ trackedFiles, shippingFiles, legacyFiles, referenceFiles }) {
  const shipping = new Set(shippingFiles.map(normalizeRepoPath));
  const legacy = new Set(legacyFiles.map(normalizeRepoPath));
  const reference = new Set(referenceFiles.map(normalizeRepoPath));
  const overlaps = [];
  for (const file of new Set([...shipping, ...legacy, ...reference])) {
    const classes = [shipping.has(file) && "active_authority", legacy.has(file) && "dormant_legacy", reference.has(file) && "reference_only"].filter(Boolean);
    if (classes.length > 1) overlaps.push({ file, classes });
  }
  const records = trackedFiles.map(normalizeRepoPath).sort().map((file) => ({
    file,
    classification: shipping.has(file)
      ? "active_authority"
      : legacy.has(file)
        ? "dormant_legacy"
        : reference.has(file)
          ? "reference_only"
          : "shared_governance",
  }));
  return { records, overlaps };
}

function relativeImports(source) {
  const imports = [];
  const pattern = /(?:from\s*|import\s*)["'](\.[^"']+)["']/g;
  for (const match of source.matchAll(pattern)) imports.push(match[1]);
  return imports;
}

function resolveModule(root, owner, request) {
  const raw = path.resolve(root, path.dirname(owner), request);
  const candidates = [raw, `${raw}.js`, `${raw}.mjs`, path.join(raw, "index.js")];
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  return found ? normalizeRepoPath(path.relative(root, found)) : null;
}

export function buildActiveModuleGraph(root, entryFiles) {
  const queue = [...entryFiles.map(normalizeRepoPath)];
  const visited = new Set();
  const missingImports = [];
  while (queue.length) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    const absolute = path.join(root, file);
    if (!fs.existsSync(absolute) || !/\.(?:js|mjs)$/.test(file)) continue;
    const source = fs.readFileSync(absolute, "utf8");
    for (const request of relativeImports(source)) {
      const resolved = resolveModule(root, file, request);
      if (!resolved) missingImports.push({ owner: file, request });
      else if (!visited.has(resolved)) queue.push(resolved);
    }
  }
  return { reachable: [...visited].sort(), missingImports };
}

export function createHygieneReport({ root, trackedFiles, projectScope, manifest }) {
  const legacyFiles = manifest.dormantLegacy.exactFiles;
  const referenceFiles = manifest.referenceOnly.exactFiles;
  const classification = classifyTrackedFiles({
    trackedFiles,
    shippingFiles: projectScope.shippingFiles,
    legacyFiles,
    referenceFiles,
  });
  const findings = [];
  const tracked = new Set(trackedFiles.map(normalizeRepoPath));
  for (const [classificationName, files] of [["dormant_legacy", legacyFiles], ["reference_only", referenceFiles]]) {
    for (const file of files.map(normalizeRepoPath)) {
      if (!tracked.has(file)) findings.push({ severity: "error", type: "manifest-file-not-tracked", classification: classificationName, file });
    }
  }
  for (const overlap of classification.overlaps) findings.push({ severity: "error", type: "classification-overlap", ...overlap });

  const graph = buildActiveModuleGraph(root, projectScope.activeRuntimeFiles.filter((file) => /\.(?:js|mjs)$/.test(file)));
  const legacy = new Set(legacyFiles.map(normalizeRepoPath));
  const activeLegacyImports = graph.reachable.filter((file) => legacy.has(file));
  for (const file of activeLegacyImports) findings.push({ severity: "error", type: "active-runtime-reaches-legacy", file });
  for (const missing of graph.missingImports) findings.push({ severity: "error", type: "active-runtime-import-missing", ...missing });

  const indexSource = fs.readFileSync(path.join(root, projectScope.htmlEntry), "utf8");
  for (const file of legacyFiles) {
    if (indexSource.includes(file) || indexSource.includes(`./${file}`)) findings.push({ severity: "error", type: "html-entry-references-legacy", file });
  }

  const records = classification.records.map((record) => ({
    ...record,
    bytes: fs.statSync(path.join(root, record.file)).size,
    sha256: sha256File(path.join(root, record.file)),
  }));
  const counts = Object.fromEntries(["active_authority", "dormant_legacy", "reference_only", "shared_governance"].map((name) => [name, records.filter((record) => record.classification === name).length]));
  const shippingClosure = records.filter((record) => record.classification === "active_authority").map(({ file, bytes, sha256 }) => ({ file, bytes, sha256 }));
  return {
    schema: "idlewuxia.workspace_hygiene_report.v1",
    generatedAt: new Date().toISOString(),
    projectId: manifest.projectId,
    migrationMode: manifest.migrationMode,
    pass: findings.length === 0,
    trackedFileCount: records.length,
    counts,
    activeModuleReachableCount: graph.reachable.length,
    activeLegacyImportCount: activeLegacyImports.length,
    shippingClosure,
    records,
    findings,
  };
}

export function compareShippingClosures(before, after) {
  const left = new Map((before || []).map((row) => [row.file, `${row.bytes}:${row.sha256}`]));
  const right = new Map((after || []).map((row) => [row.file, `${row.bytes}:${row.sha256}`]));
  const changes = [];
  for (const file of [...new Set([...left.keys(), ...right.keys()])].sort()) {
    if (left.get(file) !== right.get(file)) changes.push({ file, before: left.get(file) || null, after: right.get(file) || null });
  }
  return changes;
}
