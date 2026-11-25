// Checks a configuration against C-001 before the SDK uses it.
// Pure, so the server can run the same check before it serves one.

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function isValidFlag(flag) {
  return (
    isObject(flag) &&
    Array.isArray(flag.rules) &&
    Array.isArray(flag.variants) &&
    flag.rules.every(isObject) &&
    flag.variants.every((v) => isObject(v) && Number.isFinite(v.from) && Number.isFinite(v.to))
  );
}

// True only when the whole configuration is usable; one bad flag rejects it all.
export function isValidConfig(config) {
  return (
    isObject(config) &&
    Number.isFinite(config.version) &&
    isObject(config.flags) &&
    Object.values(config.flags).every(isValidFlag)
  );
}
