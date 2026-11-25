// The anonymous user id (D-006): 128 random bits as 32 hex digits, created on the
// first visit and kept in localStorage. When storage is blocked, each page load
// gets a new id.

const KEY = 'p1.userId';

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getUserId(storage) {
  try {
    const stored = storage?.getItem(KEY);
    if (stored) return stored;
  } catch {
    // storage blocked: fall through to a per-page-load id
  }
  const id = newId();
  try {
    storage?.setItem(KEY, id);
  } catch {
    // not kept; the id lasts for this page load
  }
  return id;
}
