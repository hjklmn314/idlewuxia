function cloneFallback(value, seen) {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);

  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);

  if (Array.isArray(value)) {
    const copy = [];
    seen.set(value, copy);
    for (const item of value) copy.push(cloneFallback(item, seen));
    return copy;
  }

  if (value instanceof Map) {
    const copy = new Map();
    seen.set(value, copy);
    for (const [key, item] of value) {
      copy.set(cloneFallback(key, seen), cloneFallback(item, seen));
    }
    return copy;
  }

  if (value instanceof Set) {
    const copy = new Set();
    seen.set(value, copy);
    for (const item of value) copy.add(cloneFallback(item, seen));
    return copy;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`Unsupported data clone type: ${prototype?.constructor?.name || "unknown"}`);
  }

  const copy = Object.create(prototype);
  seen.set(value, copy);
  for (const key of Object.keys(value)) copy[key] = cloneFallback(value[key], seen);
  return copy;
}

export function cloneData(value) {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return cloneFallback(value, new WeakMap());
}
