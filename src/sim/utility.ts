// Utility coin model for the Token Lab.
//
// A deliberately simple, explainable model — not a forecast.
//
//   spend per active user (USD)  = tokens used per user × launch price
//   utility volume (USD / month) = monthly active users × spend per user
//   utility float (USD)          = utility volume ÷ velocity
//        the value of tokens that must sit in wallets to settle that volume
//   tokens used (per month)      = utility volume ÷ last month's price
//   tokens burned                = tokens used × burn rate
//   circulating                  = unlocked supply − cumulative burn
//   speculative value (USD)      = launch market cap not backed by utility,
//                                  fading by a fixed % each month
//   modeled price                = (utility float + speculative value) ÷ circulating
//   utilization                  = utility float ÷ modeled market cap

export interface LabInputs {
  price0: number;
  supply: number;
  circPct: number; // % of supply circulating at launch
  unlockMonths: number; // months until 100% is unlocked
  users: number;
  adoption: number; // % of users active each month
  tokensPerUser: number;
  velocity: number; // turns per month
  growth: number; // % per month
  burn: number; // % of tokens used
  fade: number; // % per month the speculative premium fades
  months: number;
}

export interface MonthRow {
  m: number;
  users: number;
  mau: number;
  volumeUsd: number;
  tokensUsed: number;
  burned: number;
  burnedCum: number;
  unlocked: number;
  circulating: number;
  floatUsd: number;
  floatTokens: number;
  speculativeUsd: number;
  price: number;
  utilityPrice: number;
  utilization: number;
}

export const DEFAULTS: LabInputs = {
  price0: 0.1,
  supply: 100_000_000,
  circPct: 25,
  unlockMonths: 36,
  users: 100_000,
  adoption: 60,
  tokensPerUser: 50,
  velocity: 4,
  growth: 10,
  burn: 2,
  fade: 3,
  months: 24,
};

export type ScenarioKey = 'bear' | 'base' | 'bull';

export const SCENARIOS: Record<ScenarioKey, { label: string; usage: string; result: string; patch: Partial<LabInputs> }> = {
  bear: { label: 'Bear', usage: 'Low', result: 'Low utility demand', patch: { adoption: 10, tokensPerUser: 20, burn: 0.5, growth: 3 } },
  base: { label: 'Base', usage: 'Medium', result: 'Moderate demand', patch: { adoption: 40, tokensPerUser: 50, burn: 2, growth: 8 } },
  bull: { label: 'Bull', usage: 'High', result: 'High demand', patch: { adoption: 80, tokensPerUser: 120, burn: 5, growth: 15 } },
};

export function simulate(i: LabInputs): MonthRow[] {
  const rows: MonthRow[] = [];
  const spendPerUser = i.tokensPerUser * i.price0;
  const circ0 = Math.min(1, Math.max(0, i.circPct / 100));
  const unlockMonths = Math.max(1, i.unlockMonths);
  let burnedCum = 0;
  let speculative = 0;
  let prevPrice = i.price0;

  for (let m = 0; m <= i.months; m++) {
    const users = i.users * Math.pow(1 + i.growth / 100, m);
    const mau = users * (i.adoption / 100);
    const volumeUsd = mau * spendPerUser;
    const unlocked = i.supply * (circ0 + (1 - circ0) * Math.min(1, m / unlockMonths));

    // Tokens are spent at last month's price, then a share of them is burned.
    const tokensUsed = prevPrice > 0 ? volumeUsd / prevPrice : 0;
    const burned = Math.min(tokensUsed * (i.burn / 100), Math.max(0, unlocked - burnedCum));
    burnedCum += burned;
    const circulating = Math.max(1, unlocked - burnedCum);

    const floatUsd = volumeUsd / Math.max(0.1, i.velocity);
    if (m === 0) speculative = Math.max(0, i.price0 * circulating - floatUsd);
    else speculative *= 1 - i.fade / 100;

    const price = (floatUsd + speculative) / circulating;
    const utilityPrice = floatUsd / circulating;

    rows.push({
      m,
      users,
      mau,
      volumeUsd,
      tokensUsed,
      burned,
      burnedCum,
      unlocked,
      circulating,
      floatUsd,
      floatTokens: price > 0 ? floatUsd / price : 0,
      speculativeUsd: speculative,
      price,
      utilityPrice,
      utilization: floatUsd + speculative > 0 ? floatUsd / (floatUsd + speculative) : 0,
    });
    prevPrice = price;
  }
  return rows;
}

const trim = (n: number, digits: number) => n.toFixed(digits).replace(/\.0+$/, '');

export const compact = (n: number, digits = 1) => {
  const a = Math.abs(n);
  if (a >= 1e12) return `${trim(n / 1e12, digits)}T`;
  if (a >= 1e9) return `${trim(n / 1e9, digits)}B`;
  if (a >= 1e6) return `${trim(n / 1e6, digits)}M`;
  if (a >= 1e3) return `${trim(n / 1e3, digits)}K`;
  return n.toFixed(a < 10 && a !== Math.round(a) ? 2 : 0);
};

export const usd = (n: number) => {
  if (Math.abs(n) >= 1000) return `$${compact(n)}`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  if (n === 0) return '$0';
  const d = Math.min(8, Math.max(2, 2 - Math.floor(Math.log10(Math.abs(n)))));
  return `$${n.toFixed(d)}`;
};
