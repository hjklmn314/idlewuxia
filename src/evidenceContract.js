function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export const EVIDENCE_SCHEMA = "idlewuxia.evidence.v2";

export const EVIDENCE_SOURCE_KINDS = Object.freeze([
  "lua",
  "project_config",
  "project_generated",
  "recording",
  "visual_reference",
  "unknown",
]);
const SOURCE_KINDS = new Set(EVIDENCE_SOURCE_KINDS);

function canonicalReference(value = {}) {
  return {
    sourceFile: cleanText(value.sourceFile),
    sourceRecord: cleanText(value.sourceRecord),
    sourceKind: cleanText(value.sourceKind),
  };
}

export function inferEvidenceSourceKind(sourceFile, evidenceLevel = "") {
  const normalizedFile = cleanText(sourceFile).replaceAll("\\", "/").toLowerCase();
  const normalizedLevel = cleanText(evidenceLevel).toLowerCase();
  if (normalizedFile.startsWith("res/script/") || normalizedFile.endsWith(".lua")) return "lua";
  if (normalizedFile.startsWith("config/")) return "project_config";
  if (/\.(?:png|jpe?g|webp|gif)$/.test(normalizedFile)) return "visual_reference";
  if (normalizedFile.includes("/outputs/") || normalizedFile.startsWith("outputs/")) return "project_generated";
  if (normalizedLevel.includes("recording")) return "recording";
  if (normalizedLevel.includes("lua")) return "lua";
  if (normalizedLevel.includes("config")) return "project_config";
  return "unknown";
}

export function evidenceReferences(evidence = {}) {
  if (Array.isArray(evidence.sources)) {
    return evidence.sources.map(canonicalReference);
  }
  if (cleanText(evidence.sourceFile) || cleanText(evidence.sourceKind)) {
    return [canonicalReference(evidence)];
  }
  const sourceFile = cleanText(evidence.source);
  if (sourceFile && !sourceFile.includes("|")) {
    return [{
      sourceFile,
      sourceRecord: cleanText(evidence.record),
      sourceKind: inferEvidenceSourceKind(sourceFile, evidence.level),
    }];
  }
  return [];
}

export function evidenceSourceFiles(evidence = {}) {
  return evidenceReferences(evidence).map((entry) => entry.sourceFile).filter(Boolean);
}

export function evidenceSourceRecords(evidence = {}) {
  return evidenceReferences(evidence).map((entry) => entry.sourceRecord).filter(Boolean);
}

export function allEvidenceReferences(evidence = {}) {
  const references = [...evidenceReferences(evidence)];
  const supplemental = evidence?.sourceEvidence;
  if (typeof supplemental === "string") {
    const sourceFile = cleanText(supplemental);
    if (sourceFile && !sourceFile.includes("|")) {
      references.push({
        sourceFile,
        sourceRecord: "",
        sourceKind: inferEvidenceSourceKind(sourceFile, evidence.level),
      });
    }
  } else if (supplemental && typeof supplemental === "object" && !Array.isArray(supplemental)) {
    references.push(...allEvidenceReferences(supplemental));
  }
  return references;
}

export function evidenceSummary(evidence = {}) {
  const references = allEvidenceReferences(evidence);
  const sourceText = references
    .map((entry) => [entry.sourceKind, entry.sourceFile, entry.sourceRecord].filter(Boolean).join(":"))
    .join(" | ");
  return [cleanText(evidence.level), sourceText].filter(Boolean).join(" / ");
}

function visitEvidenceObjects(value, path, visitor) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visitEvidenceObjects(entry, `${path}[${index}]`, visitor));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if ((key === "evidence" || key === "sourceEvidence") && entry && typeof entry === "object" && !Array.isArray(entry)) {
      visitor(entry, childPath);
    }
    visitEvidenceObjects(entry, childPath, visitor);
  }
}

export function collectEvidenceReferenceEntries(flow = {}) {
  const entries = [];
  const playerReferences = evidenceReferences(flow.playerSeed);
  if (playerReferences.length) {
    entries.push({
      ownerPath: "$.playerSeed",
      shape: "canonical",
      references: playerReferences,
    });
  }
  visitEvidenceObjects(flow, "$", (evidence, ownerPath) => {
    const references = evidenceReferences(evidence);
    if (!references.length) return;
    entries.push({
      ownerPath,
      shape: Array.isArray(evidence.sources) ? "canonical" : "legacy_single",
      references,
    });
  });
  return entries;
}

export function validateEvidenceContract(flow = {}) {
  const findings = [];
  const stats = {
    evidenceObjects: 0,
    canonicalEvidenceObjects: 0,
    canonicalReferences: 0,
    legacySingleSourceObjects: 0,
    compositeLegacySourceObjects: 0,
    compositeSourceEvidenceValues: 0,
  };
  const add = (code, path, detail) => findings.push({ severity: "error", code, path, detail });
  const validateReference = (source, sourcePath) => {
    if (!cleanText(source?.sourceFile) || cleanText(source?.sourceFile).includes("|")) {
      add("INVALID_SOURCE_FILE", `${sourcePath}.sourceFile`, "sourceFile must identify exactly one file.");
    }
    if (!SOURCE_KINDS.has(cleanText(source?.sourceKind))) {
      add("INVALID_SOURCE_KIND", `${sourcePath}.sourceKind`, "sourceKind is missing or unsupported.");
    }
    if (typeof source?.sourceRecord !== "string") {
      add("INVALID_SOURCE_RECORD", `${sourcePath}.sourceRecord`, "sourceRecord must be a string.");
    }
  };

  if (flow.evidenceSchema !== EVIDENCE_SCHEMA) {
    add("EVIDENCE_SCHEMA_MISMATCH", "$.evidenceSchema", `Expected ${EVIDENCE_SCHEMA}.`);
  }
  if (Object.hasOwn(flow.playerSeed || {}, "source")) {
    add(
      "PLAYER_SEED_LEGACY_SOURCE",
      "$.playerSeed.source",
      "Player provenance must use sourceFile/sourceRecord/sourceKind; source cannot mean a kind.",
    );
  } else {
    validateReference(flow.playerSeed, "$.playerSeed");
  }

  visitEvidenceObjects(flow, "$", (evidence, path) => {
    stats.evidenceObjects += 1;
    const legacySource = cleanText(evidence.source);
    if (legacySource.includes("|")) {
      stats.compositeLegacySourceObjects += 1;
      add(
        "COMPOSITE_LEGACY_SOURCE",
        `${path}.source`,
        "Composite source strings must become typed entries in sources[].",
      );
    }
    if (!Array.isArray(evidence.sources)) {
      if (legacySource) stats.legacySingleSourceObjects += 1;
      return;
    }
    stats.canonicalEvidenceObjects += 1;
    stats.canonicalReferences += evidence.sources.length;
    if (Object.hasOwn(evidence, "source") || Object.hasOwn(evidence, "record")) {
      add(
        "MIXED_EVIDENCE_SHAPES",
        path,
        "Canonical sources[] cannot be mixed with legacy source/record fields.",
      );
    }
    if (evidence.sources.length === 0) {
      add("EMPTY_EVIDENCE_SOURCES", `${path}.sources`, "Canonical evidence needs at least one source reference.");
    }
    evidence.sources.forEach((source, index) => {
      validateReference(source, `${path}.sources[${index}]`);
    });
  });
  const visitSourceEvidenceValues = (value, path = "$") => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visitSourceEvidenceValues(entry, `${path}[${index}]`));
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (key === "sourceEvidence" && typeof entry === "string" && entry.includes("|")) {
        stats.compositeSourceEvidenceValues += 1;
        add(
          "COMPOSITE_SOURCE_EVIDENCE",
          childPath,
          "Composite sourceEvidence strings must become a typed source collection.",
        );
      }
      visitSourceEvidenceValues(entry, childPath);
    }
  };
  visitSourceEvidenceValues(flow);

  return {
    $schema: "idlewuxia.evidence_validation_report.v1",
    status: findings.length ? "fail" : "pass",
    summary: {
      findings: findings.length,
      ...stats,
    },
    findings,
  };
}

function referencesFromDelimitedSource(source, record = "", evidenceLevel = "") {
  const files = cleanText(source).split("|").map(cleanText).filter(Boolean);
  const records = cleanText(record).split("|").map(cleanText);
  return files.map((sourceFile, index) => ({
    sourceFile,
    sourceRecord: records.length === files.length ? records[index] : cleanText(record),
    sourceKind: inferEvidenceSourceKind(sourceFile, evidenceLevel),
  }));
}

function migrateEvidenceObjectsUp(value) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(migrateEvidenceObjectsUp);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (key === "sourceEvidence" && typeof entry === "string" && entry.includes("|")) {
      value[key] = {
        sourceRole: "supplemental",
        sources: referencesFromDelimitedSource(entry),
      };
      continue;
    }
    migrateEvidenceObjectsUp(entry);
    if ((key !== "evidence" && key !== "sourceEvidence") || !entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const references = referencesFromDelimitedSource(entry.source, entry.record, entry.level);
    if (references.length <= 1) continue;
    entry.sources = references;
    delete entry.source;
    delete entry.record;
  }
}

function migrateEvidenceObjectsDown(value) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(migrateEvidenceObjectsDown);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (
      key === "sourceEvidence"
      && entry
      && typeof entry === "object"
      && !Array.isArray(entry)
      && entry.sourceRole === "supplemental"
      && Array.isArray(entry.sources)
    ) {
      value[key] = entry.sources.map((source) => cleanText(source?.sourceFile)).filter(Boolean).join("|");
      continue;
    }
    migrateEvidenceObjectsDown(entry);
    if ((key !== "evidence" && key !== "sourceEvidence") || !entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    if (!Array.isArray(entry.sources) || entry.sources.length === 0) continue;
    const references = entry.sources.map(canonicalReference);
    entry.source = references.map((source) => source.sourceFile).join("|");
    const records = references.map((source) => source.sourceRecord);
    entry.record = records.every((record) => record === records[0]) ? records[0] : records.join("|");
    delete entry.sources;
  }
}

export function migrateEvidenceContract(flow, { direction = "up", contract = {} } = {}) {
  const migrated = JSON.parse(JSON.stringify(flow));
  const playerSeedReference = contract.playerSeedReference || {};

  if (direction === "up") {
    migrated.evidenceSchema = EVIDENCE_SCHEMA;
    if (Object.hasOwn(migrated.playerSeed || {}, "source")) {
      Object.assign(migrated.playerSeed, canonicalReference(playerSeedReference));
      delete migrated.playerSeed.source;
    }
    migrateEvidenceObjectsUp(migrated);
    return migrated;
  }

  if (direction !== "down") throw new Error(`Unsupported evidence migration direction: ${direction}`);
  if (migrated.evidenceSchema === EVIDENCE_SCHEMA) delete migrated.evidenceSchema;
  if (
    migrated.playerSeed
    && Object.hasOwn(migrated.playerSeed, "sourceFile")
    && Object.hasOwn(migrated.playerSeed, "sourceKind")
  ) {
    migrated.playerSeed.source = cleanText(playerSeedReference.legacySource) || "recording_observed";
    delete migrated.playerSeed.sourceFile;
    delete migrated.playerSeed.sourceRecord;
    delete migrated.playerSeed.sourceKind;
  }
  migrateEvidenceObjectsDown(migrated);
  return migrated;
}
