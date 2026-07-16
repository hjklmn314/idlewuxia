import {
  createCombatPresentationAudit,
  recordCombatPresentationEvent,
  summarizeCombatPresentationAudit,
} from "./combatPresentationAudit.js";
import {
  buildFirstSessionCombatFlow,
  validateFirstSessionCombatFlow,
} from "./firstSessionCombatFlow.js";

const MATCH_KEYS = ["source", "phase", "deathKind", "semanticTheme", "effect"];

function roundTime(value) {
  return Math.round(Math.max(0, value) * 1000) / 1000;
}

function matches(actual, expected) {
  if (actual.type !== expected.type) return false;
  return MATCH_KEYS.every((key) => !expected[key] || actual[key] === expected[key]);
}

function compareSteps(stream, expectedSequence) {
  const steps = [];
  let cursor = 0;

  for (const expected of expectedSequence.filter((event) => event.required !== false)) {
    const actualIndex = stream.findIndex((event, index) => index >= cursor && matches(event, expected));
    const actual = actualIndex >= 0 ? stream[actualIndex] : null;
    steps.push({
      stage: expected.stage,
      status: actual ? "pass" : "missing",
      expectedIndex: steps.length,
      actualIndex,
      expected: {
        t: expected.t,
        type: expected.type,
        source: expected.source || "",
        phase: expected.phase || "",
        deathKind: expected.deathKind || "",
        semanticTheme: expected.semanticTheme || "",
        effect: expected.effect || "",
      },
      actual,
      deltaSeconds: actual ? roundTime(actual.t - expected.t) : null,
    });
    if (actual) cursor = actualIndex + 1;
  }

  return steps;
}

function replayStreamToAudit(stream, maxEvents = 512) {
  const audit = createCombatPresentationAudit({ maxEvents });
  for (const event of stream || []) {
    recordCombatPresentationEvent(audit, {
      ...event,
      at: Number.isFinite(Number(event.at)) ? Number(event.at) : Number(event.t || 0) * 1000,
    });
  }
  return audit;
}

export function compareRuntimeCombatAuditCapture(capture, options = {}) {
  const parsed = typeof capture === "string" ? JSON.parse(capture) : capture || {};
  const demoId = options.demoId || parsed.demoId || parsed.expected?.demoId || "blackhole10";
  const flow = options.flow || buildFirstSessionCombatFlow(options.config || {}, { demoId });
  const stream = Array.isArray(parsed.stream) ? parsed.stream : [];
  const audit = replayStreamToAudit(stream, options.maxEvents || 512);
  const validation = validateFirstSessionCombatFlow(audit, flow);
  const steps = compareSteps(stream, flow.sequence);
  const timingToleranceSeconds = Number.isFinite(Number(options.timingToleranceSeconds))
    ? Number(options.timingToleranceSeconds)
    : 0.45;
  const stepFindings = [];

  for (const step of steps) {
    if (step.status !== "pass") {
      stepFindings.push({
        severity: "error",
        type: "runtime-step-missing",
        stage: step.stage,
        expected: step.expected,
      });
      continue;
    }
    if (Math.abs(step.deltaSeconds) > timingToleranceSeconds) {
      stepFindings.push({
        severity: "error",
        type: "runtime-step-timing-drift",
        stage: step.stage,
        deltaSeconds: step.deltaSeconds,
        toleranceSeconds: timingToleranceSeconds,
        expected: step.expected,
        actual: step.actual,
      });
    }
  }

  if (parsed.demoId && parsed.demoId !== demoId) {
    stepFindings.push({
      severity: "error",
      type: "runtime-demo-id-mismatch",
      expected: demoId,
      actual: parsed.demoId,
    });
  }
  if (stream.length < flow.sequence.length) {
    stepFindings.push({
      severity: "error",
      type: "runtime-stream-too-short",
      expectedAtLeast: flow.sequence.length,
      actual: stream.length,
    });
  }

  const findings = [...validation.findings, ...stepFindings];
  return {
    schemaVersion: 1,
    passed: findings.length === 0,
    demoId,
    sessionId: parsed.sessionId || "",
    capturedStreamCount: stream.length,
    timingToleranceSeconds,
    expected: {
      demoId: flow.demoId,
      semanticTheme: flow.semanticTheme,
      rewardText: flow.rewardText,
      orderedStages: flow.sequence.map((event) => event.stage),
    },
    steps,
    summary: validation.summary,
    findings,
  };
}

export function createRuntimeCombatAudit(options = {}) {
  const now = options.now || (() => performance.now());
  const demoId = options.demoId || "blackhole10";
  const flow = buildFirstSessionCombatFlow(options.config || {}, { demoId });
  let audit = createCombatPresentationAudit({ maxEvents: options.maxEvents || 512 });
  let stream = [];
  let startedAt = now();
  let sessionId = `${demoId}-${Math.round(startedAt)}`;

  function start(startOptions = {}) {
    startedAt = Number.isFinite(Number(startOptions.startedAt)) ? Number(startOptions.startedAt) : now();
    sessionId = String(startOptions.sessionId || `${demoId}-${Math.round(startedAt)}`);
    audit = createCombatPresentationAudit({ maxEvents: options.maxEvents || 512 });
    stream = [];
    return snapshot();
  }

  function record(event = {}) {
    const at = Math.max(0, now() - startedAt);
    const normalized = recordCombatPresentationEvent(audit, { ...event, at });
    const runtimeEvent = {
      ...normalized,
      index: stream.length,
      t: roundTime(at / 1000),
    };
    stream.push(runtimeEvent);
    return runtimeEvent;
  }

  function compare() {
    return compareRuntimeCombatAuditCapture(snapshot(), {
      flow,
      demoId,
      timingToleranceSeconds: options.timingToleranceSeconds,
      maxEvents: options.maxEvents || 512,
    });
  }

  function snapshot() {
    return {
      schemaVersion: 1,
      demoId,
      sessionId,
      startedAt,
      expected: flow,
      summary: summarizeCombatPresentationAudit(audit),
      stream: stream.map((event) => ({ ...event })),
    };
  }

  function exportJson() {
    return JSON.stringify(
      {
        ...snapshot(),
        comparison: compare(),
      },
      null,
      2,
    );
  }

  return {
    start,
    record,
    compare,
    snapshot,
    exportJson,
  };
}

export function installRuntimeCombatAuditBridge(target, runtimeAudit) {
  if (!target || !runtimeAudit) return null;

  const bridge = Object.freeze({
    snapshot: () => runtimeAudit.snapshot(),
    compare: () => runtimeAudit.compare(),
    exportJson: () => runtimeAudit.exportJson(),
    download(filename = "novalite-runtime-combat-audit.json") {
      const json = runtimeAudit.exportJson();
      const documentRef = target.document;
      const urlRef = target.URL;
      if (!documentRef?.createElement || !urlRef?.createObjectURL) {
        return { filename, json, downloaded: false };
      }
      const blob = new Blob([json], { type: "application/json" });
      const href = urlRef.createObjectURL(blob);
      const anchor = documentRef.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      anchor.click();
      urlRef.revokeObjectURL(href);
      return { filename, downloaded: true };
    },
  });

  target.__NOVALITE_AUDIT__ = bridge;
  return bridge;
}

export function publishRuntimeCombatAudit(element, runtimeAudit) {
  if (!element || !runtimeAudit) return false;
  element.textContent = runtimeAudit.exportJson();
  return true;
}
