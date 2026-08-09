export function resolveConfiguredCombatResultAuditBinding({
  flow = {},
  combatContent = {},
  sourceId = "",
  actionType = "",
  resultId = "",
} = {}) {
  const policy = flow.chapterSystem?.combatResultPolicies?.[resultId];
  if (!policy) return { accepted: false, reason: "missing_policy", policy: null };
  if (policy.resultId !== resultId) return { accepted: false, reason: "result_id_mismatch", policy };
  if (!(policy.allowedSourceIds || []).includes(sourceId)) return { accepted: false, reason: "source_disallowed", policy };
  if (!(policy.allowedActionTypes || []).includes(actionType)) return { accepted: false, reason: "action_disallowed", policy };
  if (policy.runtimeMode !== "manual_player_turns") return { accepted: false, reason: "runtime_mode_not_manual", policy };
  if (policy.autoResolveOnFinish !== true) return { accepted: false, reason: "terminal_resolution_disabled", policy };
  if (policy.resolutionPolicy !== "terminal_combat_result_then_configured_outcome_dispatch") {
    return { accepted: false, reason: "resolution_policy_mismatch", policy };
  }
  const encounterExists = (combatContent.encounters || []).some((encounter) => encounter.encounterId === policy.encounterId);
  if (!encounterExists) return { accepted: false, reason: "unknown_encounter", policy };
  return { accepted: true, reason: "configured_real_combat_session", policy };
}
