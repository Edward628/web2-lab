// An in-memory stand-in for localStorage, and one whose every call throws
// (storage blocked by the browser).
export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

export function blockedStorage() {
  const fail = () => {
    throw new Error('SecurityError: storage is blocked');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}
