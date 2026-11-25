// The SDK client (D-009): init({ sdkKey, config }) → { identify, isEnabled, getVariant }.
// The configuration (C-001) is passed in; fetching it (D-003) comes later.
// Reads never throw: an unknown flag gives false / null, no user yet gives default.

import { evaluate } from './evaluate.js';

export function init({ sdkKey, config }) {
  let user = null;

  function value(flagKey) {
    if (!Object.hasOwn(config.flags, flagKey)) return null;
    const flag = config.flags[flagKey];
    if (user === null) return flag.default;
    return evaluate(flagKey, flag, user);
  }

  return {
    sdkKey,
    identify(userId, attributes = {}) {
      if (typeof userId !== 'string') {
        throw new TypeError('identify: userId must be a string');
      }
      user = { userId, attributes };
    },
    isEnabled: (flagKey) => value(flagKey) === true,
    getVariant: (flagKey) => value(flagKey),
  };
}
