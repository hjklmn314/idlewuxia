import { cloneData } from "./dataClone.js";

export function isAllowedEvidenceHost(hostname, contract = {}) {
  const allowed = contract?.hostPolicy?.allowedHostnames || [];
  return contract?.runtimeScope === "browser_evidence_only" && allowed.includes(String(hostname || ""));
}

export function resolveBrowserEvidenceRoute(contract, { hostname = "", routeId = "" } = {}) {
  if (!routeId || !isAllowedEvidenceHost(hostname, contract)) return null;
  return (contract.routes || []).find((route) => route.routeId === routeId) || null;
}

export function applyEvidencePlayerPatch(playerSeed, route) {
  const merged = cloneData(playerSeed || {});
  const patch = route?.initialPlayerPatch || {};
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      merged[key] = { ...(merged[key] || {}), ...cloneData(value) };
    } else {
      merged[key] = cloneData(value);
    }
  }
  return merged;
}

export function routeIntentArguments(step = {}) {
  const allowed = {
    dispatchAction: ["actionId"],
    selectNode: ["nodeId"],
    selectRoom: ["roomId"],
    selectNpc: ["roleId"],
    interactNpc: ["roleId", "actionType"],
  }[step.type];
  if (!allowed) return null;
  const args = { type: step.type };
  for (const field of allowed) {
    if (typeof step[field] !== "string" || !step[field].trim()) return null;
    args[field] = step[field];
  }
  return args;
}
