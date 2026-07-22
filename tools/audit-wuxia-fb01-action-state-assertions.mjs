import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createChapterSession } from "../src/chapterSession.js";
import { auditReachability } from "./audit-wuxia-fb01-entity-reachability.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const policyPath = path.join(root, "config", "wuxia_fb01_action_state_assertion_policy.json");
const outputDir = path.join(root, "outputs", "t03_01_action_state_assertions");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function semanticSnapshot(snapshot, ignoredFields = []) {
  const result = clone(snapshot);
  for (const field of ignoredFields) delete result[field];
  return result;
}

function entityId(entity) {
  return entity.roleId || entity.interactableId || "";
}

function entityKind(entity) {
  return entity.roleId ? "npc" : "interactable";
}

function addFixtureEntity(fixture, entity, room) {
  const id = entityId(entity);
  if (entityKind(entity) === "npc") {
    if (!(room.encounterIds || []).includes(id)) {
      room.encounterIds = [...(room.encounterIds || []), id];
      room.encounterNames = [...(room.encounterNames || []), entity.name || entity.displayName?.zhCN || id];
    }
  } else {
    if (!(room.interactableIds || []).includes(id)) {
      room.interactableIds = [...(room.interactableIds || []), id];
      room.interactableNames = [...(room.interactableNames || []), entity.name || entity.displayName?.zhCN || id];
    }
  }
  return fixture;
}

function createFixture(flow, entity, roomId, policy) {
  const fixture = clone(flow);
  const room = (fixture.chapter1.rooms || []).find((candidate) => candidate.roomId === roomId)
    || fixture.chapter1.rooms?.[0];
  if (!room) throw new Error("FB01 action assertion fixture has no room");
  addFixtureEntity(fixture, entity, room);
  return {
    flow: fixture,
    room,
    options: {
      initialState: policy.fixturePolicy.initialState,
      initialFlags: policy.fixturePolicy.initialFlags,
    },
  };
}

function selectEntity(session, entity, room, flow) {
  const nodeId = room.parentNodeId
    || (flow.chapter1?.nodes || []).find((node) => (node.sourceRooms || []).includes(room.roomId))?.nodeId
    || flow.chapter1?.nodes?.[0]?.nodeId
    || "";
  const nodeResult = session.selectChapterNode(nodeId);
  if (!nodeResult.accepted) return { accepted: false, step: "selectNode", result: nodeResult };
  const roomResult = session.selectChapterRoom(room.roomId);
  if (!roomResult.accepted) return { accepted: false, step: "selectRoom", result: roomResult };
  const id = entityId(entity);
  const entityResult = entityKind(entity) === "npc"
    ? session.selectChapterNpc(id)
    : session.selectChapterInteractable(id);
  return entityResult.accepted
    ? { accepted: true, result: entityResult }
    : { accepted: false, step: "selectEntity", result: entityResult };
}

function availabilityFor(snapshot, entity, actionType) {
  const list = entityKind(entity) === "npc"
    ? snapshot.chapter.selectedNpcActionAvailability
    : snapshot.chapter.selectedInteractableActionAvailability;
  return (list || []).find((entry) => entry.actionType === actionType) || null;
}

function invoke(session, entity, actionType) {
  const id = entityId(entity);
  return entityKind(entity) === "npc"
    ? session.interactWithChapterNpc(id, actionType)
    : session.interactWithChapterInteractable(id, actionType);
}

function expectedRoomFor(row) {
  return row.reachableRooms?.[0]?.roomId || "";
}

function allActionRows(flow, reachability) {
  const rows = [];
  const reachabilityById = new Map(reachability.rows.map((row) => [row.entityId, row]));
  for (const entity of [
    ...(flow.chapter1?.npcs || []),
    ...(flow.chapter1?.interactables || []),
  ]) {
    const id = entityId(entity);
    const reachabilityRow = reachabilityById.get(id);
    for (const action of entity.actions || []) {
      rows.push({
        kind: entityKind(entity),
        entityId: id,
        entityName: entity.name || entity.displayName?.zhCN || id,
        actionType: action.actionType || "",
        actionLabel: action.label || "",
        reachable: Boolean(reachabilityRow?.reachable),
        reachableRoomId: expectedRoomFor(reachabilityRow || {}),
        entity,
      });
    }
  }
  return rows;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeOutputs(report) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "action_state_assertions.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const columns = [
    "kind", "entityId", "actionType", "reachable", "roomId", "available",
    "accepted", "semanticChanged", "declaredOutcome", "selectionStep", "failureCode",
  ];
  const lines = [columns.join(",")];
  for (const row of report.rows) lines.push(columns.map((column) => csvCell(row[column])).join(","));
  fs.writeFileSync(path.join(outputDir, "action_state_assertions.csv"), `${lines.join("\n")}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "summary.json"), `${JSON.stringify({
    schema: report.schema,
    taskId: report.taskId,
    sourceCommit: report.sourceCommit,
    verdict: report.verdict,
    summary: report.summary,
    findings: report.findings,
  }, null, 2)}\n`, "utf8");
}

export function runActionStateAssertions({
  flow = readJson(flowPath),
  policy = readJson(policyPath),
  writeOutputs: shouldWriteOutputs = false,
  sourceCommit,
} = {}) {
  const reachability = auditReachability({ flow, sourceCommit: sourceCommit || "test" });
  const actions = allActionRows(flow, reachability);
  const findings = [];
  const rows = [];
  const ignoredFields = policy.ignoredSnapshotFields || ["events"];

  for (const row of actions) {
    const roomId = row.reachable ? row.reachableRoomId : (flow.chapter1.rooms?.[0]?.roomId || "");
    let fixture = createFixture(flow, row.entity, roomId, policy);
    if (!fixture.room) {
      findings.push({ code: "NO_FIXTURE_ROOM", entityId: row.entityId, actionType: row.actionType });
      rows.push({ ...row, roomId, failureCode: "NO_FIXTURE_ROOM" });
      continue;
    }
    const session = createChapterSession(fixture.flow, fixture.options || {});
    const selected = selectEntity(session, row.entity, fixture.room, fixture.flow);
    if (!selected.accepted) {
      const code = `SELECTION_${selected.step || "UNKNOWN"}`;
      findings.push({ code, entityId: row.entityId, actionType: row.actionType, reason: selected.result?.event?.reason || selected.result?.reason || "" });
      rows.push({ ...row, roomId, failureCode: code, selectionStep: selected.step || "" });
      continue;
    }
    const before = semanticSnapshot(session.snapshot(), ignoredFields);
    const availability = availabilityFor(session.snapshot(), row.entity, row.actionType);
    const result = invoke(session, row.entity, row.actionType);
    const after = semanticSnapshot(session.snapshot(), ignoredFields);
    const semanticChanged = canonical(before) !== canonical(after);
    const event = result?.event || {};
    const accepted = Boolean(result?.accepted);
    const available = Boolean(availability?.available);
    const declaredOutcome = semanticChanged
      || Boolean((event.feedbackLines || []).length)
      || Boolean(event.feedback)
      || Boolean((event.sideEffects || []).length)
      || Boolean(after.pendingCombat)
      || Boolean(after.pendingChoice);
    const rowReport = {
      kind: row.kind,
      entityId: row.entityId,
      entityName: row.entityName,
      actionType: row.actionType,
      actionLabel: row.actionLabel,
      reachable: row.reachable,
      roomId,
      available,
      accepted,
      semanticChanged,
      declaredOutcome,
      selectionStep: "",
      failureCode: "",
      availabilityReason: availability?.reason || "",
      eventType: event.type || "",
      eventFeedback: event.feedback || "",
      sideEffectCount: (event.sideEffects || []).length,
    };
    if (!availability) {
      rowReport.failureCode = "MISSING_AVAILABILITY";
      findings.push({ code: rowReport.failureCode, entityId: row.entityId, actionType: row.actionType });
    } else if (accepted !== available) {
      rowReport.failureCode = "AVAILABILITY_DISPATCH_MISMATCH";
      findings.push({ code: rowReport.failureCode, entityId: row.entityId, actionType: row.actionType, available, accepted, reason: event.reason || "" });
    } else if (!accepted && semanticChanged) {
      rowReport.failureCode = "REJECTED_MUTATED_STATE";
      findings.push({ code: rowReport.failureCode, entityId: row.entityId, actionType: row.actionType });
    } else if (accepted && !declaredOutcome) {
      rowReport.failureCode = "ACCEPTED_WITHOUT_DECLARED_OUTCOME";
      findings.push({ code: rowReport.failureCode, entityId: row.entityId, actionType: row.actionType });
    }
    rows.push(rowReport);
  }

  const rejectedRows = rows.filter((row) => row.accepted === false && !row.failureCode);
  const acceptedRows = rows.filter((row) => row.accepted === true && !row.failureCode);
  const report = {
    schema: "idlewuxia.fb01_action_state_assertion_report.v1",
    taskId: "T03-01",
    sourceCommit: sourceCommit || (() => {
      try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); } catch { return "unknown"; }
    })(),
    method: "One isolated ChapterSession fixture per configured action; availability, dispatch result and semantic before/after snapshot are asserted through public session commands.",
    verdict: findings.length ? "fail" : "pass",
    summary: {
      actions: actions.length,
      assertedActions: rows.length,
      reachableActions: actions.filter((row) => row.reachable).length,
      dormantFixtureActions: actions.filter((row) => !row.reachable).length,
      acceptedActions: rows.filter((row) => row.accepted === true).length,
      rejectedActions: rows.filter((row) => row.accepted === false).length,
      rejectedZeroMutation: rejectedRows.filter((row) => !row.semanticChanged).length,
      acceptedWithDeclaredOutcome: acceptedRows.filter((row) => row.declaredOutcome).length,
      selectionFailures: rows.filter((row) => row.failureCode?.startsWith("SELECTION_")).length,
    },
    findings,
    rows,
  };
  if (shouldWriteOutputs) writeOutputs(report);
  return report;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const report = runActionStateAssertions({ writeOutputs: true });
  process.stdout.write(`${JSON.stringify({ outputDir: path.relative(root, outputDir).replaceAll("\\", "/"), ...report.summary, verdict: report.verdict, findings: report.findings }, null, 2)}\n`);
  if (report.verdict !== "pass") process.exitCode = 1;
}
