// P1's one variant read (D-013): wait at most 5 s for the first refresh(). On time,
// read the variant once (this queues the exposure); otherwise show the control
// without reading it, so no exposure, even if the configuration arrives later.

import { variantOf } from './reservation.js';

const WAIT_MS = 5000;

export async function firstVariant(ff, flagKey) {
  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => resolve(true), WAIT_MS);
  });
  const late = await Promise.race([ff.refresh().then(() => false), timedOut]);
  clearTimeout(timer);
  return late ? 'blue' : variantOf(ff.getVariant(flagKey));
}
