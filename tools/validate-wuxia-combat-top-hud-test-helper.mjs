export function validateCombatTopHudContract(contract) {
  const required = ["$schema", "contractId", "version", "screenId", "maxHeightRatio", "referenceHeightDp", "zones", "turnOrder", "sideSemantics", "stateLabels", "contextLabels", "fallbackPolicy"];
  const findings = required.filter((key) => !(key in (contract || {}))).map((key) => ({ code: "COMBAT_TOP_HUD_REQUIRED", path: `$.${key}`, message: `missing ${key}` }));
  if (contract?.screenId !== "UI_EarlyCombat") findings.push({ code: "COMBAT_TOP_HUD_SCREEN", path: "$.screenId", message: "must bind UI_EarlyCombat" });
  if (!(Number(contract?.maxHeightRatio) > 0 && Number(contract?.maxHeightRatio) <= 0.18)) findings.push({ code: "COMBAT_TOP_HUD_HEIGHT", path: "$.maxHeightRatio", message: "must be within (0, 0.18]" });
  return { valid: findings.length === 0, findings };
}
