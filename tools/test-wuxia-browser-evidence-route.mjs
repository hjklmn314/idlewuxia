import assert from "node:assert/strict";
import fs from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { applyEvidencePlayerPatch, isAllowedEvidenceHost, resolveBrowserEvidenceRoute, routeIntentArguments } from "../src/browserEvidenceRoute.js";
import { createFirstSessionRuntime } from "../src/wuxiaFirstSessionFlow.js";

const flow = JSON.parse(fs.readFileSync(new URL("../config/wuxia_first_session_flow.json", import.meta.url), "utf8"));
const combatContent = JSON.parse(fs.readFileSync(new URL("../config/wuxia_combat_content.json", import.meta.url), "utf8"));
const contract = JSON.parse(fs.readFileSync(new URL("../config/wuxia_browser_evidence_routes.json", import.meta.url), "utf8"));
const schema = JSON.parse(fs.readFileSync(new URL("../config/wuxia_browser_evidence_routes.schema.json", import.meta.url), "utf8"));
const validateContract = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
assert.equal(validateContract(contract), true, JSON.stringify(validateContract.errors));
const route = resolveBrowserEvidenceRoute(contract, { hostname: "127.0.0.1", routeId: "tmnpc01d-choice-result" });
assert.ok(route, "configured tmnpc01d route must resolve on localhost");
assert.equal(resolveBrowserEvidenceRoute(contract, { hostname: "example.com", routeId: route.routeId }), null, "evidence route must not resolve on a non-localhost host");
assert.equal(isAllowedEvidenceHost("localhost", contract), true);

const patchedPlayer = applyEvidencePlayerPatch(flow.playerSeed, route);
assert.equal(patchedPlayer.sectId, "tangmen");
assert.equal(patchedPlayer.inheritableMarkers["唐门内功进修"], "0");
assert.equal(flow.playerSeed.sectId, undefined, "evidence patch must not mutate the production player seed");

const runtime = createFirstSessionRuntime(flow, { initialPlayer: patchedPlayer });
for (const step of route.steps) {
  const intent = routeIntentArguments(step);
  assert.ok(intent, `route step must be a valid UI intent: ${JSON.stringify(step)}`);
  const result = runtime[
    intent.type === "dispatchAction" ? "dispatch"
      : intent.type === "selectNode" ? "selectChapterNode"
        : intent.type === "selectRoom" ? "selectChapterRoom"
          : intent.type === "selectNpc" ? "selectChapterNpc"
            : "interactWithChapterNpc"
  ](...Object.entries(intent).filter(([key]) => key !== "type").map(([, value]) => value));
  assert.equal(result.accepted, true, `configured route step must execute: ${JSON.stringify({ step, event: result.event })}`);
}
const snapshot = runtime.snapshot();
assert.equal(snapshot.chapter.selectedRoomId, route.expected.roomId);
assert.equal(snapshot.chapter.selectedNpcId, route.expected.roleId);
assert.equal(snapshot.pendingChoice?.choiceId, route.expected.choiceId);
assert.equal(snapshot.chapter.replacementEntityById.tmnpc01a, "tmnpc01d");
assert.equal(snapshot.chapter.replacementEntityById.tmnpc01b, "tmnpc01d");
assert.equal(snapshot.chapter.replacementEntityById.tmnpc01c, "tmnpc01d");
assert.deepEqual(snapshot.chapter.dynamicEntityIdsByRoom.fb01_15, ["tmnpc01d"]);
assert.deepEqual(
  route.expected.replacementChain,
  [["tmnpc01a", "tmnpc01b"], ["tmnpc01b", "tmnpc01c"], ["tmnpc01c", "tmnpc01d"]],
);

const defaultRuntime = createFirstSessionRuntime(flow);
defaultRuntime.selectChapterNode("NODE_FB01_TRAINING_FIELDS");
defaultRuntime.selectChapterRoom("fb01_15");
const rejected = defaultRuntime.selectChapterNpc("tmnpc01d");
assert.equal(rejected.accepted, false, "the default player must not bypass the dynamic NPC replacement chain");
assert.equal(rejected.event.reason, "npc is not in selected room");

const captureRoute = resolveBrowserEvidenceRoute(contract, { hostname: "localhost", routeId: "fb01-capture-combat-result" });
assert.ok(captureRoute, "configured capture-combat route must resolve on localhost");
const capturePlayer = applyEvidencePlayerPatch(flow.playerSeed, captureRoute);
assert.equal(capturePlayer.inventory.xuan1, 1);
const captureRuntime = createFirstSessionRuntime(flow, { initialPlayer: capturePlayer, combatContent });
for (const step of captureRoute.steps) {
  const intent = routeIntentArguments(step);
  assert.ok(intent, `capture route step must be a valid UI intent: ${JSON.stringify(step)}`);
  const result = captureRuntime[
    intent.type === "dispatchAction" ? "dispatch"
      : intent.type === "selectNode" ? "selectChapterNode"
        : intent.type === "selectRoom" ? "selectChapterRoom"
          : intent.type === "selectNpc" ? "selectChapterNpc"
            : "interactWithChapterNpc"
  ](...Object.entries(intent).filter(([key]) => key !== "type").map(([, value]) => value));
  assert.equal(result.accepted, true, `capture route step must execute: ${JSON.stringify({ step, event: result.event })}`);
}
assert.equal(captureRuntime.snapshot().pendingCombat?.triggerResultId, captureRoute.expected.triggerResultId);
assert.equal(captureRuntime.snapshot().pendingCombat?.encounterId, captureRoute.expected.encounterId);

process.stdout.write(`${JSON.stringify({
  schema: "idlewuxia.browser_evidence_route_test.v1",
  status: "pass",
  routeId: route.routeId,
  positiveSteps: route.steps.length,
  captureCombatSteps: captureRoute.steps.length,
  negativeReason: rejected.event.reason,
}, null, 2)}\n`);
