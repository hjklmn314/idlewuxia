import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultFlowPath = path.join(root, "config", "wuxia_first_session_flow.json");
const defaultPolicyPath = path.join(
  root,
  "config",
  "wuxia_fb01_entity_reachability_policy.json",
);
const defaultOutputDir = path.join(root, "outputs", "t03_00_entity_reachability");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function entityId(entity) {
  return entity.roleId ?? entity.interactableId ?? "";
}

function splitResultList(value) {
  return String(value ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectResultListArgNames(value, output = new Set()) {
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (
      typeof child === "string" &&
      /(?:resultListArg|successResultListArg|failureResultListArg)$/u.test(key) &&
      /^Arg[2-7]$/u.test(child)
    ) {
      output.add(child);
    } else if (child && typeof child === "object") {
      collectResultListArgNames(child, output);
    }
  }
  return output;
}

function buildResultTraversalPolicies(flow) {
  const policies = [];
  const configured = flow.chapterSystem?.resultEffectPolicies ?? {};
  for (const [policyId, policy] of Object.entries(configured)) {
    if (policy.enabledInFirstSession === false) continue;
    const actionNames = [
      policy.actionName,
      ...(Array.isArray(policy.actionNames) ? policy.actionNames : []),
    ].filter(Boolean);
    const argNames = [...collectResultListArgNames(policy)];
    if (actionNames.length > 0 && argNames.length > 0) {
      policies.push({ policyId, actionNames, argNames });
    }
  }
  return policies;
}

function buildResultExpander(chapter, traversalPolicies) {
  const policyByAction = new Map();
  for (const policy of traversalPolicies) {
    for (const actionName of policy.actionNames) {
      const current = policyByAction.get(actionName) ?? new Set();
      for (const argName of policy.argNames) current.add(argName);
      policyByAction.set(actionName, current);
    }
  }

  return function expandResultIds(seedIds) {
    const expanded = [];
    const queue = [...seedIds];
    const visited = new Set();
    while (queue.length > 0) {
      const resultId = queue.shift();
      if (!resultId || visited.has(resultId)) continue;
      visited.add(resultId);
      const result = chapter.resultLookup?.[resultId];
      if (!result) continue;
      expanded.push({ resultId, ...result });
      for (const argName of policyByAction.get(result.action) ?? []) {
        queue.push(...splitResultList(result.args?.[argName]));
      }
    }
    return expanded;
  };
}

function makeCsv(rows) {
  const headers = [
    "entityId",
    "kind",
    "name",
    "actionCount",
    "reachable",
    "reachableRooms",
    "decision",
    "moduleId",
    "reason",
  ];
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) =>
          escape(
            header === "reachableRooms"
              ? row.reachableRooms.map((item) => item.roomId).join("|")
              : row[header],
          ),
        )
        .join(","),
    ),
  ].join("\n");
}

function makeMarkdown(report) {
  const lines = [
    "# T03-00 FB01 Entity Reachability Audit",
    "",
    `- Verdict: **${report.verdict.toUpperCase()}**`,
    `- Source commit: \`${report.sourceCommit}\``,
    `- Entities: ${report.summary.entities}`,
    `- Reachable: ${report.summary.reachableEntities}`,
    `- Intentional dormant: ${report.summary.intentionalDormantEntities}`,
    `- Unclassified unreachable: ${report.summary.unclassifiedUnreachableEntities}`,
    `- Reachable actions: ${report.summary.reachableActions}`,
    `- Dormant actions: ${report.summary.intentionalDormantActions}`,
    "",
    "## Decisions",
    "",
    "| Entity | Name | Actions | Decision | Module | Reason |",
    "| --- | --- | ---: | --- | --- | --- |",
  ];
  for (const row of report.rows.filter((row) => !row.reachable)) {
    lines.push(
      `| ${row.entityId} | ${row.name} | ${row.actionCount} | ${row.decision || "UNCLASSIFIED"} | ${row.moduleId || ""} | ${(row.reason || "").replaceAll("|", "\\|")} |`,
    );
  }
  lines.push("", "## Findings", "");
  if (report.findings.length === 0) {
    lines.push("- None.");
  } else {
    for (const finding of report.findings) {
      lines.push(`- **${finding.code}** ${finding.message}`);
    }
  }
  lines.push(
    "",
    "## Method",
    "",
    "- Seed entity rooms from `encounterIds` and `interactableIds`.",
    "- Traverse branch result tokens recursively through enabled result-effect policy argument declarations.",
    "- Propagate `换人` and `添加人物` effects to a fixed point.",
    "- Require every remaining unreachable entity to have a valid, non-stale disposition.",
    "",
  );
  return lines.join("\n");
}

export function auditReachability({
  flow = readJson(defaultFlowPath),
  policy = readJson(defaultPolicyPath),
  writeOutputs = false,
  outputDir = defaultOutputDir,
  sourceCommit,
} = {}) {
  const chapter = flow.chapter1 ?? {};
  const entities = [
    ...(chapter.npcs ?? []).map((entity) => ({ kind: "npc", entity })),
    ...(chapter.interactables ?? []).map((entity) => ({
      kind: "interactable",
      entity,
    })),
  ];
  const entityById = new Map(
    entities.map((row) => [entityId(row.entity), row]),
  );
  const reachableRooms = new Map();
  const proofs = new Map();
  const addReachability = (id, roomId, proof) => {
    if (!id || !roomId || !entityById.has(id)) return false;
    const rooms = reachableRooms.get(id) ?? new Set();
    if (rooms.has(roomId)) return false;
    rooms.add(roomId);
    reachableRooms.set(id, rooms);
    const entityProofs = proofs.get(id) ?? [];
    entityProofs.push({ roomId, ...proof });
    proofs.set(id, entityProofs);
    return true;
  };

  for (const room of chapter.rooms ?? []) {
    for (const id of [
      ...(room.encounterIds ?? []),
      ...(room.interactableIds ?? []),
    ]) {
      addReachability(id, room.roomId, {
        type: "room_seed",
        sourceId: room.roomId,
      });
    }
  }

  const traversalPolicies = buildResultTraversalPolicies(flow);
  const expandResultIds = buildResultExpander(chapter, traversalPolicies);
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 100) {
    changed = false;
    iterations += 1;
    for (const { entity } of entities) {
      const ownerId = entityId(entity);
      const ownerRooms = [...(reachableRooms.get(ownerId) ?? [])];
      if (ownerRooms.length === 0) continue;
      for (const branch of entity.branches ?? []) {
        const seeds = [
          ...(branch.resultTokens ?? []),
          ...(branch.resolvedResults ?? []).map((row) => row.resultId),
        ];
        for (const result of expandResultIds(seeds)) {
          if (result.action === "换人") {
            const fromId = result.args?.Arg2 || ownerId;
            const fromRooms = [
              ...(reachableRooms.get(fromId) ?? ownerRooms),
            ];
            const targetRooms = result.args?.Arg4
              ? [result.args.Arg4]
              : fromRooms;
            for (const roomId of targetRooms) {
              changed =
                addReachability(result.args?.Arg3, roomId, {
                  type: "entity_swap",
                  sourceId: ownerId,
                  fromId,
                  resultId: result.resultId,
                }) || changed;
            }
          } else if (result.action === "添加人物") {
            const targetRooms = result.args?.Arg4
              ? [result.args.Arg4]
              : ownerRooms;
            for (const roomId of targetRooms) {
              changed =
                addReachability(result.args?.Arg2, roomId, {
                  type: "entity_add",
                  sourceId: ownerId,
                  resultId: result.resultId,
                }) || changed;
            }
          }
        }
      }
    }
  }

  const findings = [];
  const allowedDecisions = new Set(policy.allowedDecisions ?? []);
  const modules = new Map(
    (policy.dormantModules ?? []).map((module) => [module.moduleId, module]),
  );
  const decisions = new Map();
  for (const decision of policy.decisions ?? []) {
    if (decisions.has(decision.entityId)) {
      findings.push({
        code: "DUPLICATE_DECISION",
        message: `Duplicate decision for ${decision.entityId}.`,
      });
    }
    decisions.set(decision.entityId, decision);
  }

  const rows = entities.map(({ kind, entity }) => {
    const id = entityId(entity);
    const reachable = (reachableRooms.get(id)?.size ?? 0) > 0;
    const decision = decisions.get(id);
    return {
      entityId: id,
      kind,
      name: entity.name ?? entity.displayName?.zhCN ?? "",
      actionCount: (entity.actions ?? []).length,
      reachable,
      reachableRooms: proofs.get(id) ?? [],
      decision: decision?.decision ?? "",
      moduleId: decision?.moduleId ?? "",
      reason: decision?.reason ?? "",
      evidence: entity.evidence ?? {},
    };
  });

  for (const row of rows) {
    const decision = decisions.get(row.entityId);
    if (row.reachable && decision) {
      findings.push({
        code: "STALE_REACHABLE_DECISION",
        message: `${row.entityId} is reachable but still has ${decision.decision}.`,
      });
      continue;
    }
    if (row.reachable) continue;
    if (!decision) {
      findings.push({
        code: "UNCLASSIFIED_UNREACHABLE",
        message: `${row.entityId} has ${row.actionCount} unreachable action(s) without a decision.`,
      });
      continue;
    }
    if (!allowedDecisions.has(decision.decision)) {
      findings.push({
        code: "INVALID_DECISION",
        message: `${row.entityId} uses unsupported decision ${decision.decision}.`,
      });
    } else if (decision.decision === "repair") {
      findings.push({
        code: "REPAIR_NOT_EFFECTIVE",
        message: `${row.entityId} is still unreachable after a repair decision.`,
      });
    } else if (decision.decision === "remove-from-active-config") {
      findings.push({
        code: "REMOVE_NOT_EFFECTIVE",
        message: `${row.entityId} still exists in active chapter configuration.`,
      });
    } else if (decision.decision === "intentional_dormant") {
      const module = modules.get(decision.moduleId);
      if (!module) {
        findings.push({
          code: "UNKNOWN_DORMANT_MODULE",
          message: `${row.entityId} references missing module ${decision.moduleId}.`,
        });
      } else {
        if (module.enabledInFirstSession !== false) {
          findings.push({
            code: "DORMANT_MODULE_ENABLED",
            message: `${decision.moduleId} must be disabled in normal first session.`,
          });
        }
        if (
          !module.activationOwner ||
          !module.activationPolicy ||
          !(module.activationSources?.length > 0)
        ) {
          findings.push({
            code: "INCOMPLETE_DORMANT_CONTRACT",
            message: `${decision.moduleId} lacks activation owner, policy, or source evidence.`,
          });
        }
      }
    }
  }

  for (const decision of policy.decisions ?? []) {
    if (!entityById.has(decision.entityId)) {
      findings.push({
        code: "UNKNOWN_DECISION_ENTITY",
        message: `${decision.entityId} is not present in active chapter data.`,
      });
    }
  }

  const unreachableRows = rows.filter((row) => !row.reachable);
  const dormantRows = unreachableRows.filter(
    (row) => row.decision === "intentional_dormant",
  );
  const resolvedCommit =
    sourceCommit ??
    (() => {
      try {
        return execFileSync("git", ["rev-parse", "HEAD"], {
          cwd: root,
          encoding: "utf8",
        }).trim();
      } catch {
        return "unknown";
      }
    })();
  const report = {
    schema: "idlewuxia.entity_reachability_audit.v2",
    taskId: "T03-00",
    generatedAt: new Date().toISOString(),
    sourceCommit: resolvedCommit,
    verdict: findings.length === 0 ? "pass" : "fail",
    method:
      "Fixed-point room reachability plus configuration-declared nested result traversal and mandatory disposition validation.",
    traversalPolicies,
    summary: {
      entities: rows.length,
      reachableEntities: rows.filter((row) => row.reachable).length,
      unreachableEntities: unreachableRows.length,
      intentionalDormantEntities: dormantRows.length,
      unclassifiedUnreachableEntities: unreachableRows.filter(
        (row) => !row.decision,
      ).length,
      reachableActions: rows
        .filter((row) => row.reachable)
        .reduce((sum, row) => sum + row.actionCount, 0),
      unreachableActions: unreachableRows.reduce(
        (sum, row) => sum + row.actionCount,
        0,
      ),
      intentionalDormantActions: dormantRows.reduce(
        (sum, row) => sum + row.actionCount,
        0,
      ),
      iterations,
    },
    findings,
    rows,
  };

  if (writeOutputs) {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, "entity_reachability_audit.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(outputDir, "entity_reachability_audit.csv"),
      `${makeCsv(rows)}\n`,
      "utf8",
    );
    fs.writeFileSync(
      path.join(outputDir, "entity_reachability_audit.md"),
      `${makeMarkdown(report)}\n`,
      "utf8",
    );
  }
  return report;
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const report = auditReachability({ writeOutputs: true });
  process.stdout.write(
    `${JSON.stringify(
      {
        outputDir: path.relative(root, defaultOutputDir).replaceAll("\\", "/"),
        verdict: report.verdict,
        ...report.summary,
        findings: report.findings,
      },
      null,
      2,
    )}\n`,
  );
  if (report.verdict !== "pass") process.exitCode = 1;
}
