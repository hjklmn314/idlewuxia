function valueAtPath(source, path = "") {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function configuredValue(definition = {}, player = {}) {
  if (definition.path) {
    const value = valueAtPath(player, definition.path);
    if (value !== undefined && value !== null && String(value).trim()) return String(value);
  }
  if (definition.selectorPath) {
    const selector = valueAtPath(player, definition.selectorPath);
    const selected = definition.selectorMap?.[String(selector ?? "")];
    if (selected !== undefined && selected !== null && String(selected).trim()) return String(selected);
  }
  return String(definition.fallback || "");
}

export function interpolateRuntimeText(value, { policy = {}, player = {} } = {}) {
  const tokens = policy.tokens || {};
  const values = policy.values || {};
  const replacements = Object.entries(tokens)
    .map(([semanticId, token]) => [String(token || ""), configuredValue(values[semanticId] || {}, player)])
    .filter(([token]) => token)
    .sort(([left], [right]) => right.length - left.length);
  return replacements.reduce(
    (text, [token, replacement]) => text.split(token).join(replacement),
    String(value ?? ""),
  );
}

export function interpolateRuntimeTextLines(lines = [], context = {}) {
  return (lines || []).map((line) => interpolateRuntimeText(line, context));
}

export function configuredRuntimeTextTokens(policy = {}) {
  return Object.values(policy.tokens || {}).map(String).filter(Boolean);
}
