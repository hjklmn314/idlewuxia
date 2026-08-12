import crypto from "node:crypto";

import Ajv2020 from "ajv/dist/2020.js";

export function clone(value) {
  return structuredClone(value);
}

export function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean).map(String))].sort();
}

function duplicateIds(rows, key) {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows || []) {
    const id = String(row?.[key] || "");
    if (!id || seen.has(id)) duplicates.add(id || "<empty>");
    seen.add(id);
  }
  return [...duplicates].sort();
}

export function validateChapterPackage({ chapter, schema, combatContent = null, externalEncounterIds = [] }) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const schemaValid = validate(chapter);
  const schemaErrors = (validate.errors || []).map((error) => ({
    path: error.instancePath || "/",
    keyword: error.keyword,
    message: error.message || "schema validation failed",
  }));
  const findings = [];
  const add = (code, subject, message) => findings.push({ code, subject, message });
  const collections = [
    ["nodes", chapter.nodes, "nodeId"],
    ["rooms", chapter.rooms, "roomId"],
    ["npcs", chapter.npcs, "roleId"],
    ["interactables", chapter.interactables, "interactableId"],
    ["gates", chapter.gates, "gateId"],
    ["rewards", chapter.rewards, "rewardId"],
  ];
  for (const [label, rows, key] of collections) {
    for (const id of duplicateIds(rows, key)) add("DUPLICATE_OR_EMPTY_ID", label, `${key}=${id}`);
  }

  const ids = (rows, key) => new Set((rows || []).map((row) => String(row?.[key] || "")).filter(Boolean));
  const nodeIds = ids(chapter.nodes, "nodeId");
  const roomIds = ids(chapter.rooms, "roomId");
  const npcIds = ids(chapter.npcs, "roleId");
  const interactableIds = ids(chapter.interactables, "interactableId");
  const gateIds = ids(chapter.gates, "gateId");
  const rewardIds = ids(chapter.rewards, "rewardId");
  const resultIds = new Set(Object.keys(chapter.resultLookup || {}));
  const conditionIds = new Set(Object.keys(chapter.conditionLookup || {}));
  const encounterIds = new Set((combatContent?.encounters || []).map((row) => String(row?.encounterId || "")));
  const allowedExternalEncounterIds = new Set((externalEncounterIds || []).map(String));

  const requireKnown = (values, known, subject, kind, allow = new Set()) => {
    for (const value of values || []) {
      const id = typeof value === "object" ? String(value?.roomId || "") : String(value || "");
      if (id && !known.has(id) && !allow.has(id)) add("UNKNOWN_REFERENCE", subject, `${kind}=${id}`);
    }
  };
  for (const [index, node] of (chapter.nodes || []).entries()) {
    requireKnown(node.sourceRooms, roomIds, `nodes[${index}]`, "room");
    requireKnown(node.connections, nodeIds, `nodes[${index}]`, "node");
    requireKnown(node.gates, gateIds, `nodes[${index}]`, "gate");
    requireKnown(node.rewards, rewardIds, `nodes[${index}]`, "reward");
    requireKnown(node.interactables, interactableIds, `nodes[${index}]`, "interactable");
  }
  for (const [index, room] of (chapter.rooms || []).entries()) {
    requireKnown([room.parentNodeId], nodeIds, `rooms[${index}]`, "parentNode");
    requireKnown(room.connections, roomIds, `rooms[${index}]`, "room");
    requireKnown(room.encounterIds, npcIds, `rooms[${index}]`, "npc");
    requireKnown(room.interactableIds, interactableIds, `rooms[${index}]`, "interactable");
    requireKnown(room.rewardIds, rewardIds, `rooms[${index}]`, "reward");
    if (combatContent) requireKnown(room.encounterDefinitions, encounterIds, `rooms[${index}]`, "encounter", allowedExternalEncounterIds);
  }

  const actionTokens = new Set(["talk", "use", "compete", "gift", "kill", "open", "pick_up", "push_in", "extract"]);
  const validateBranches = (owners, label) => {
    for (const [ownerIndex, owner] of (owners || []).entries()) {
      for (const [branchIndex, branch] of (owner.branches || []).entries()) {
        const subject = `${label}[${ownerIndex}].branches[${branchIndex}]`;
        requireKnown(branch.conditionTokens, conditionIds, subject, "condition", actionTokens);
        requireKnown(branch.resultTokens, resultIds, subject, "result");
        requireKnown((branch.resolvedResults || []).map((row) => row.resultId), resultIds, subject, "resolvedResult");
      }
    }
  };
  validateBranches(chapter.npcs, "npcs");
  validateBranches(chapter.interactables, "interactables");

  for (const [id, row] of Object.entries(chapter.resultLookup || {})) {
    if (id !== row?.resultId) add("LOOKUP_ID_DRIFT", `resultLookup.${id}`, `resultId=${row?.resultId || "<empty>"}`);
  }
  for (const [id, row] of Object.entries(chapter.conditionLookup || {})) {
    if (id !== row?.conditionId) add("LOOKUP_ID_DRIFT", `conditionLookup.${id}`, `conditionId=${row?.conditionId || "<empty>"}`);
  }

  return {
    valid: schemaValid && findings.length === 0,
    schemaValid,
    schemaErrors,
    semanticFindings: findings,
  };
}

export function buildChapterPreview(chapter) {
  const branches = [...(chapter.npcs || []), ...(chapter.interactables || [])]
    .flatMap((owner) => owner.branches || []);
  return {
    schema: "idlewuxia.chapter_authoring_preview.v1",
    chapterId: chapter.chapterId,
    schemaVersion: chapter.schemaVersion,
    counts: {
      nodes: (chapter.nodes || []).length,
      gates: (chapter.gates || []).length,
      rewards: (chapter.rewards || []).length,
      rooms: (chapter.rooms || []).length,
      npcs: (chapter.npcs || []).length,
      interactables: (chapter.interactables || []).length,
      branches: branches.length,
      results: Object.keys(chapter.resultLookup || {}).length,
      conditions: Object.keys(chapter.conditionLookup || {}).length,
    },
    encounterIds: sortedUnique([
      ...(chapter.nodes || []).flatMap((row) => row.encounters || []),
      ...(chapter.rooms || []).flatMap((row) => row.encounterDefinitions || []),
    ]),
    resultCategories: sortedUnique(Object.values(chapter.resultLookup || {}).map((row) => row.category)),
    actionTypes: sortedUnique([
      ...(chapter.npcs || []).flatMap((row) => (row.actions || []).map((action) => action.actionType)),
      ...(chapter.interactables || []).flatMap((row) => (row.actions || []).map((action) => action.actionType)),
    ]),
  };
}

export function diffJson(before, after, currentPath = "$") {
  if (Object.is(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const changes = [];
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      changes.push(...diffJson(before[index], after[index], `${currentPath}[${index}]`));
    }
    return changes;
  }
  if (before && after && typeof before === "object" && typeof after === "object") {
    const changes = [];
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      changes.push(...diffJson(before[key], after[key], `${currentPath}.${key}`));
    }
    return changes;
  }
  const kind = before === undefined ? "added" : after === undefined ? "removed" : "changed";
  return [{ path: currentPath, kind, before: before ?? null, after: after ?? null }];
}

export function buildRollbackEvidence(baseline, changed) {
  const restored = clone(baseline);
  const baselineHash = hashJson(baseline);
  return {
    baselineHash,
    changedHash: hashJson(changed),
    rollbackHash: hashJson(restored),
    rollbackVerified: hashJson(restored) === baselineHash,
  };
}
