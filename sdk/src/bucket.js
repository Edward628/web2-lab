// Deterministic bucketing (D-004): bucket = murmur3_32(utf8(flag_key + ":" + user_id), 0) % 100.
// The same code runs in the browser and in Node; the reference vectors in
// sdk/test/bucket.test.js fix the formula.

const encoder = new TextEncoder();

// MurmurHash3 x86 32-bit over a byte array. Returns an unsigned 32-bit integer.
export function murmur3_32(bytes, seed = 0) {
  const c1 = 0xcc9e2d51;
  const c2 = 0x1b873593;
  const len = bytes.length;
  const tail = len & ~3;
  let h = seed >>> 0;

  for (let i = 0; i < tail; i += 4) {
    let k = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
    k = Math.imul(k, c1);
    k = (k << 15) | (k >>> 17);
    k = Math.imul(k, c2);
    h ^= k;
    h = (h << 13) | (h >>> 19);
    h = (Math.imul(h, 5) + 0xe6546b64) | 0;
  }

  let k = 0;
  switch (len & 3) {
    case 3: k ^= bytes[tail + 2] << 16; // falls through
    case 2: k ^= bytes[tail + 1] << 8; // falls through
    case 1:
      k ^= bytes[tail];
      k = Math.imul(k, c1);
      k = (k << 15) | (k >>> 17);
      k = Math.imul(k, c2);
      h ^= k;
  }

  h ^= len;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

// The user's bucket for a flag: an integer in 0..99.
export function bucket(flagKey, userId) {
  if (typeof flagKey !== 'string' || typeof userId !== 'string') {
    throw new TypeError('bucket: flagKey and userId must be strings');
  }
  return murmur3_32(encoder.encode(flagKey + ':' + userId), 0) % 100;
}

// Rollout N% covers buckets 0..N-1, so raising N keeps everyone already included.
export function isInRollout(userBucket, percent) {
  return userBucket < percent;
}
