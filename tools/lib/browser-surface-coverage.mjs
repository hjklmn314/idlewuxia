export function observedSurfacePairs(runs = []) {
  return new Set(runs.flatMap((run) => (run.observedScreens || []).map((screenId) => `${screenId}__${run.viewportId}`)));
}

export function findSurfaceCoverageGaps(activeScreens = [], viewports = [], runs = []) {
  const observed = observedSurfacePairs(runs);
  return activeScreens.flatMap((screen) => viewports
    .filter((viewport) => !observed.has(`${screen.id}__${viewport.id}`))
    .map((viewport) => ({
      caseId: `${screen.id}__${viewport.id}`,
      screenId: screen.id,
      viewportId: viewport.id,
      reason: "screen_viewport_pair_not_observed",
    })));
}
