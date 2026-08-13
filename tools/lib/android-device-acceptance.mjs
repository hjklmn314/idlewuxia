import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

export const REQUIRED_SCREENSHOTS = [
  "00_cold_start.png",
  "01_player_action.png",
  "02_background_foreground.png",
  "03_lock_unlock.png",
  "04_offline_restore.png",
  "05_android_back_relaunch.png",
  "06_force_stop_relaunch.png",
];

export function validateAndroidDeviceContractSchema(contract, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  return {
    pass: validate(contract),
    errors: validate.errors || [],
  };
}

export function auditAndroidDeviceContract(contract) {
  const findings = [];
  const profiles = contract.matrix?.profiles || [];
  const ids = new Set();
  const classes = new Map();
  for (const profile of profiles) {
    if (ids.has(profile.id)) findings.push({ type: "duplicate-profile-id", profileId: profile.id });
    ids.add(profile.id);
    classes.set(profile.environmentClass, (classes.get(profile.environmentClass) || 0) + 1);
    if (profile.kind === "emulator" && profile.releaseEligible) {
      findings.push({ type: "emulator-marked-release-eligible", profileId: profile.id });
    }
    if (profile.environmentClass === "emulator-development" && profile.kind !== "emulator") {
      findings.push({ type: "environment-kind-mismatch", profileId: profile.id });
    }
    if (profile.environmentClass.startsWith("physical-") && profile.kind !== "physical") {
      findings.push({ type: "environment-kind-mismatch", profileId: profile.id });
    }
    if (profile.availability === "available") {
      for (const field of ["serialHint", "expectedApiLevel", "expectedResolution", "networkIsolationCapabilities", "performanceBudgetClass"]) {
        if (profile[field] === undefined || profile[field] === "") findings.push({ type: "available-profile-proof-field-missing", profileId: profile.id, field });
      }
    }
    if (profile.minimumApiLevel && profile.maximumApiLevel && profile.minimumApiLevel > profile.maximumApiLevel) {
      findings.push({ type: "profile-api-range-invalid", profileId: profile.id });
    }
    if (profile.kind === "emulator" && profile.performanceBudgetClass !== "developmentEmulator") findings.push({ type: "emulator-budget-class-invalid", profileId: profile.id });
    if (profile.kind === "physical" && profile.performanceBudgetClass !== "releasePhysical") findings.push({ type: "physical-budget-class-invalid", profileId: profile.id });
  }
  for (const requiredClass of contract.matrix?.requiredEnvironmentClasses || []) {
    if (!classes.has(requiredClass)) findings.push({ type: "required-environment-class-missing", environmentClass: requiredClass });
  }
  const physicalProfiles = profiles.filter((profile) => profile.kind === "physical");
  if (physicalProfiles.length < (contract.matrix?.minimumPhysicalDevices || 0)) {
    findings.push({ type: "physical-profile-count-insufficient", actual: physicalProfiles.length, required: contract.matrix.minimumPhysicalDevices });
  }
  const actualScreenshots = contract.requiredScreenshots || [];
  for (const expected of REQUIRED_SCREENSHOTS) {
    if (!actualScreenshots.includes(expected)) findings.push({ type: "required-screenshot-missing", file: expected });
  }
  for (const unexpected of actualScreenshots.filter((file) => !REQUIRED_SCREENSHOTS.includes(file))) {
    findings.push({ type: "required-screenshot-unknown", file: unexpected });
  }
  if (contract.playerAction?.label !== contract.playerAction?.locator?.exactText || contract.playerAction?.label !== contract.playerAction?.expectedOrigin) {
    findings.push({ type: "player-action-label-chain-mismatch" });
  }
  if (!(contract.textIntegrityForbiddenPatterns || []).includes("�")) findings.push({ type: "unicode-replacement-character-not-blocked" });
  return {
    pass: findings.length === 0,
    findings,
    matrix: {
      profileCount: profiles.length,
      physicalProfileCount: physicalProfiles.length,
      availablePhysicalDeviceCount: physicalProfiles.filter((profile) => profile.availability === "available").length,
      releaseMatrixReady: physicalProfiles.filter((profile) => profile.availability === "available").length >= contract.matrix.minimumPhysicalDevices,
    },
  };
}

export function selectDeviceProfile(contract, profileId) {
  const profile = contract.matrix.profiles.find((candidate) => candidate.id === profileId);
  if (!profile) throw new Error(`Unknown device profile: ${profileId}`);
  if (profile.availability !== "available") throw new Error(`Device profile is not available: ${profileId}`);
  return profile;
}

export function parseAmStartWait(text) {
  const number = (label) => Number(text.match(new RegExp(`^${label}:\\s*(\\d+)$`, "m"))?.[1] || NaN);
  return {
    status: text.match(/^Status:\s*(.+)$/m)?.[1]?.trim() || "",
    activity: text.match(/^Activity:\s*(.+)$/m)?.[1]?.trim() || "",
    thisTimeMs: number("ThisTime"),
    totalTimeMs: number("TotalTime"),
    waitTimeMs: number("WaitTime"),
    raw: text,
  };
}

export function parseMemoryInfo(text) {
  const value = (pattern) => Number(text.match(pattern)?.[1] || NaN);
  return {
    totalPssKb: value(/^\s*TOTAL\s+(\d+)/m),
    javaHeapKb: value(/^\s*Java Heap:\s+(\d+)/m),
    nativeHeapKb: value(/^\s*Native Heap:\s+(\d+)/m),
    raw: text,
  };
}

export function parseGfxInfo(text) {
  const frames = [...text.matchAll(/Total frames rendered:\s*(\d+)/g)].map((match) => Number(match[1]));
  const janky = [...text.matchAll(/Janky frames:\s*(\d+)\s*\(([\d.]+)%\)/g)].map((match) => ({ count: Number(match[1]), percent: Number(match[2]) }));
  const p95 = [...text.matchAll(/95th percentile:\s*(\d+)ms/g)].map((match) => Number(match[1]));
  const totalFrames = frames.reduce((sum, value) => sum + value, 0);
  const totalJanky = janky.reduce((sum, value) => sum + value.count, 0);
  return {
    totalFrames,
    jankyFrames: totalJanky,
    jankyFramePercent: totalFrames ? (totalJanky / totalFrames) * 100 : NaN,
    frameP95Ms: p95.length ? Math.max(...p95) : NaN,
    raw: text,
  };
}

export function evaluatePerformanceBudgets({ coldStart, warmStart, memory, frames }, budgets) {
  const checks = [
    { id: "cold-start", actual: coldStart.totalTimeMs, maximum: budgets.coldStartTotalMs },
    { id: "warm-start", actual: warmStart.totalTimeMs, maximum: budgets.warmStartTotalMs },
    { id: "total-pss", actual: memory.totalPssKb, maximum: budgets.totalPssKb },
    { id: "java-heap", actual: memory.javaHeapKb, maximum: budgets.javaHeapKb },
    { id: "janky-frame-percent", actual: frames.jankyFramePercent, maximum: budgets.jankyFramePercent },
    { id: "frame-p95", actual: frames.frameP95Ms, maximum: budgets.frameP95Ms },
    { id: "measured-frames", actual: frames.totalFrames, minimum: budgets.minimumMeasuredFrames },
  ].map((check) => ({
    ...check,
    status: Number.isFinite(check.actual) && (check.maximum === undefined || check.actual <= check.maximum) && (check.minimum === undefined || check.actual >= check.minimum) ? "pass" : "fail",
  }));
  return { pass: checks.every((check) => check.status === "pass"), checks };
}

export function forbiddenTextHits(text, patterns) {
  return patterns.filter((pattern) => text.includes(pattern));
}

export function assertFreshOutputDirectory(root, outputDir, outputRoot) {
  const resolvedRoot = path.resolve(root);
  const allowedRoot = path.resolve(root, outputRoot);
  const resolvedOutput = path.resolve(outputDir);
  const relative = path.relative(allowedRoot, resolvedOutput);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Output must be a new child of ${allowedRoot}`);
  if (fs.existsSync(resolvedOutput)) throw new Error(`Output already exists and will not be deleted: ${resolvedOutput}`);
  if (!allowedRoot.startsWith(resolvedRoot)) throw new Error("Configured output root escapes the project.");
  fs.mkdirSync(allowedRoot, { recursive: true });
  fs.mkdirSync(resolvedOutput, { recursive: false });
  return resolvedOutput;
}
