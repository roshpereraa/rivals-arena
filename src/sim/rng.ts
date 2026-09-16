// Small seeded-free randomness helpers for the arena simulation.

export const rand = (min = 0, max = 1) => min + Math.random() * (max - min);
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number) => Math.random() < p;

/** Standard normal via Box–Muller. */
export const normal = () => {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const HEX = '0123456789abcdef';
export const address = () => {
  let s = '0x';
  for (let i = 0; i < 40; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
};

export const uid = () => Math.random().toString(36).slice(2, 10);
