import assert from "node:assert/strict";
import contract from "../config/android_device_acceptance_contract.json" with { type: "json" };
import schema from "../config/android_device_acceptance_contract.schema.json" with { type: "json" };
import {
  auditAndroidDeviceContract,
  evaluatePerformanceBudgets,
  forbiddenTextHits,
  parseAmStartWait,
  parseGfxInfo,
  parseMemoryInfo,
  selectDeviceProfile,
  validateAndroidDeviceContractSchema,
} from "./lib/android-device-acceptance.mjs";

assert.equal(validateAndroidDeviceContractSchema(contract, schema).pass, true);
assert.equal(auditAndroidDeviceContract(contract).pass, true);
assert.equal(auditAndroidDeviceContract(contract).matrix.releaseMatrixReady, false);
assert.equal(selectDeviceProfile(contract, "ldplayer-api28-development").releaseEligible, false);
assert.throws(() => selectDeviceProfile(contract, "physical-low-slot"), /not available/);

const duplicate = structuredClone(contract);
duplicate.matrix.profiles[1].id = duplicate.matrix.profiles[0].id;
assert.equal(auditAndroidDeviceContract(duplicate).findings.some((row) => row.type === "duplicate-profile-id"), true);
const falseRelease = structuredClone(contract);
falseRelease.matrix.profiles[0].releaseEligible = true;
assert.equal(auditAndroidDeviceContract(falseRelease).findings.some((row) => row.type === "emulator-marked-release-eligible"), true);
const noScreenshot = structuredClone(contract);
noScreenshot.requiredScreenshots.pop();
assert.equal(auditAndroidDeviceContract(noScreenshot).findings.some((row) => row.type === "required-screenshot-missing"), true);

assert.deepEqual(parseAmStartWait("Status: ok\nActivity: a/b\nThisTime: 42\nTotalTime: 63\nWaitTime: 70"), {
  status: "ok", activity: "a/b", thisTimeMs: 42, totalTimeMs: 63, waitTimeMs: 70,
  raw: "Status: ok\nActivity: a/b\nThisTime: 42\nTotalTime: 63\nWaitTime: 70",
});
const memory = parseMemoryInfo(" TOTAL  54321  1\n Java Heap: 12345\n Native Heap: 23456");
assert.equal(memory.totalPssKb, 54321);
assert.equal(memory.javaHeapKb, 12345);
const frames = parseGfxInfo("Total frames rendered: 100\nJanky frames: 4 (4.00%)\n95th percentile: 21ms");
assert.equal(frames.jankyFramePercent, 4);
assert.equal(frames.frameP95Ms, 21);
const budget = evaluatePerformanceBudgets({
  coldStart: { totalTimeMs: 1000 }, warmStart: { totalTimeMs: 500 }, memory,
  frames,
}, contract.performanceBudgets.developmentEmulator);
assert.equal(budget.pass, true);
assert.equal(forbiddenTextHits("武学世家", contract.textIntegrityForbiddenPatterns).length, 0);
assert.deepEqual(forbiddenTextHits("姝﹀涓栧", contract.textIntegrityForbiddenPatterns), ["姝﹀涓栧"]);

console.log("android device acceptance contract tests: PASS (schema, matrix honesty, parsers, budgets and mojibake negative paths)");
