export function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function replaceAllText(value, search, replacement) {
  return String(value).split(search).join(replacement);
}

export function lastItem(values) {
  return Array.isArray(values) && values.length ? values[values.length - 1] : undefined;
}
