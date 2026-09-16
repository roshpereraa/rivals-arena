// RIVALS arena simulation.
//
// Every launch is a bout between two coins (red corner vs blue corner). Each
// corner has its own bonding curve. A corner that fills its curve target wins
// by KO; otherwise the corner with more ETH raised at the final bell wins on
// decision. Holders of the losing corner are absorbed into the winner at a 30%
// haircut. Everything here is simulated with practice ETH — no chain calls.

import { address, chance, clamp, normal, pick, rand, randInt, uid } from './rng';
import { ROSTER, type RosterEntry } from './roster';

export type Corner = 'red' | 'blue';
export type WeightClass = 'Featherweight' | 'Middleweight' | 'Heavyweight';
export type Method = 'KO' | 'DEC' | 'SD';

export const CLASSES: Record<WeightClass, { target: number; clip: number; blurb: string }> = {
  Featherweight: { target: 1.5, clip: 0.013, blurb: '1.5 ETH to knock out' },
  Middleweight: { target: 3, clip: 0.026, blurb: '3 ETH to knock out' },
  Heavyweight: { target: 5, clip: 0.043, blurb: '5 ETH to knock out' },
};

export const SUPPLY = 1_000_000_000;
export const ETH_USD = 2404.52; // fixed sim rate
export const FEE = 0.01; // 1% per trade
export const FEE_SPLIT = { creator: 0.5, purse: 0.3, arena: 0.2 };
export const ABSORB_RATE = 0.7; // losers keep 70% of value, converted into the winner
export const LAUNCH_FEE = 0.01;
export const START_PURSE = 10;
export const ROUND_MS = 60_000; // 1 round = 1 minute on the sim clock
export const OVERTIME_MS = 45_000;
export const SPLIT_DECISION_GAP = 0.03;

const VIRT_ETH = 1;
const VIRT_TOK = 1_073_000_000;
const K = VIRT_ETH * VIRT_TOK;

export type FighterStatus = 'waiting' | 'fighting' | 'champion' | 'absorbed';

export interface Fighter {
  id: string;
  name: string;
  ticker: string;
  bio: string;
  hue: number;
  pattern: number;
  image?: string;
  creator: string;
  taxBps: number;
  raised: number;
  holders: number;
  status: FighterStatus;
  yours?: boolean;
  pitId?: string;
  /** Graduated price (ETH per token) once the fighter is a champion or absorbed. */
  finalPrice?: number;
  poolHistory?: number[];
}

export interface Trade {
  id: string;
  t: number;
  corner: Corner;
  kind: 'buy' | 'sell';
  eth: number;
  tokens: number;
  who: string;
  you?: boolean;
  whale?: boolean;
}

export interface Pit {
  id: string;
  bout: number;
  cls: WeightClass;
  red: string;
  blue: string;
  startedAt: number;
  bellAt: number;
  rounds: number;
  overtime: boolean;
  status: 'live' | 'final';
  winner?: Corner;
  method?: Method;
  endedAt?: number;
  series: { t: number; red: number; blue: number }[];
  tape: Trade[];
  purse: number;
  volume: number;
  bias: number;
  yours?: boolean;
}

export interface FeedEvent {
  id: string;
  t: number;
  kind: 'ko' | 'dec' | 'whale' | 'launch' | 'bell' | 'you';
  text: string;
  pitId?: string;
}

export interface Position {
  tokens: number;
  cost: number;
}

export interface Purse {
  entered: boolean;
  eth: number;
  positions: Record<string, Position>;
  wins: number;
  losses: number;
  creatorFees: number;
  log: { t: number; text: string; tone: 'good' | 'bad' | 'neutral' }[];
}

export interface Challenge {
  id: string;
  fighter: string;
  rivalName?: string;
  rivalTicker?: string;
  cls: WeightClass;
  rounds: number;
  acceptAt: number;
  openingEth: number;
}

export interface ArenaState {
  bout: number;
  fighters: Record<string, Fighter>;
  pits: Record<string, Pit>;
  order: string[]; // pit ids, newest first
  feed: FeedEvent[];
  purse: Purse;
  challenges: Challenge[];
  nextSpawnAt: number;
}

// ─── curve math ──────────────────────────────────────────────────────────────

const vEth = (raised: number) => VIRT_ETH + raised;
const vTok = (raised: number) => K / vEth(raised);

export const priceOf = (raised: number) => vEth(raised) / vTok(raised);
export const soldOf = (raised: number) => VIRT_TOK - vTok(raised);

export const quoteBuy = (raised: number, eth: number, taxBps = 0) => {
  const net = eth * (1 - FEE - taxBps / 10_000);
  const tokens = vTok(raised) - K / (vEth(raised) + net);
  const before = priceOf(raised);
  const after = priceOf(raised + net);
  return { tokens, net, impact: after / before - 1 };
};

export const quoteSell = (raised: number, tokens: number, taxBps = 0) => {
  const gross = vEth(raised) - K / (vTok(raised) + tokens);
  const capped = Math.min(gross, raised);
  return { gross: capped, net: capped * (1 - FEE - taxBps / 10_000) };
};

export const fighterPrice = (f: Fighter) => f.finalPrice ?? priceOf(f.raised);
export const mcapEth = (f: Fighter) => fighterPrice(f) * SUPPLY;

// ─── state ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'rivals.arena.v1';

let state: ArenaState;
let version = 0;
const listeners = new Set<() => void>();
let notifyQueued = false;

const notify = () => {
  version++;
  if (notifyQueued) return;
  notifyQueued = true;
  requestAnimationFrame(() => {
    notifyQueued = false;
    listeners.forEach((l) => l());
  });
};

export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const getVersion = () => version;
export const arena = () => state;

// ─── builders ────────────────────────────────────────────────────────────────

const usedTickers = () =>
  new Set(Object.values(state.fighters).filter((f) => f.status !== 'absorbed').map((f) => f.ticker));

const drawRoster = (): RosterEntry => {
  const taken = usedTickers();
  const free = ROSTER.filter((r) => !taken.has(r.ticker));
  return pick(free.length ? free : ROSTER);
};

const makeFighter = (entry: RosterEntry, extra: Partial<Fighter> = {}): Fighter => {
  const f: Fighter = {
    id: uid(),
    name: entry.name,
    ticker: entry.ticker,
    bio: entry.bio,
    hue: randInt(0, 359),
    pattern: randInt(0, 5),
    creator: address(),
    taxBps: pick([0, 0, 50, 100, 150, 200]),
    raised: 0,
    holders: 1,
    status: 'fighting',
    ...extra,
  };
  state.fighters[f.id] = f;
  return f;
};

const pushFeed = (e: Omit<FeedEvent, 'id' | 't'>, t = Date.now()) => {
  state.feed.unshift({ id: uid(), t, ...e });
  state.feed.length = Math.min(state.feed.length, 40);
};

const makePit = (
  red: Fighter,
  blue: Fighter,
  opts: { cls?: WeightClass; rounds?: number; startedAt?: number; yours?: boolean } = {},
): Pit => {
  const startedAt = opts.startedAt ?? Date.now();
  const rounds = opts.rounds ?? pick([3, 4, 5, 6]);
  const pit: Pit = {
    id: uid(),
    bout: ++state.bout,
    cls: opts.cls ?? pick<WeightClass>(['Featherweight', 'Featherweight', 'Middleweight', 'Heavyweight']),
    red: red.id,
    blue: blue.id,
    startedAt,
    bellAt: startedAt + rounds * ROUND_MS,
    rounds,
    overtime: false,
    status: 'live',
    series: [{ t: startedAt, red: 0, blue: 0 }],
    tape: [],
    purse: 0,
    volume: 0,
    bias: rand(-0.6, 0.6),
    yours: opts.yours,
  };
  red.pitId = pit.id;
  blue.pitId = pit.id;
  red.status = blue.status = 'fighting';
  state.pits[pit.id] = pit;
  state.order.unshift(pit.id);
  return pit;
};

// ─── trading core ────────────────────────────────────────────────────────────

const applyBuy = (pit: Pit, corner: Corner, eth: number, who: string, t: number, you = false) => {
  const f = state.fighters[pit[corner]];
  const target = CLASSES[pit.cls].target;
  const room = (target - f.raised) / (1 - FEE - f.taxBps / 10_000);
  const spend = Math.max(0, Math.min(eth, room + 1e-9));
  if (spend <= 0) return null;
  const q = quoteBuy(f.raised, spend, f.taxBps);
  f.raised += q.net;
  const fee = spend * FEE;
  pit.purse += fee * FEE_SPLIT.purse;
  pit.volume += spend;
  if (f.yours && !you) {
    const earned = fee * FEE_SPLIT.creator + (spend * f.taxBps) / 10_000;
    state.purse.creatorFees += earned;
    state.purse.eth += earned;
  }
  if (chance(0.55)) f.holders++;
  const trade: Trade = { id: uid(), t, corner, kind: 'buy', eth: spend, tokens: q.tokens, who, you, whale: spend > CLASSES[pit.cls].clip * 5 };
  pit.tape.unshift(trade);
  pit.tape.length = Math.min(pit.tape.length, 60);
  if (f.raised >= target - 1e-6) {
    f.raised = target;
    finish(pit, corner, 'KO', t);
  }
  return trade;
};

const applySell = (pit: Pit, corner: Corner, tokens: number, who: string, t: number, you = false) => {
  const f = state.fighters[pit[corner]];
  const q = quoteSell(f.raised, tokens, f.taxBps);
  if (q.gross <= 0) return null;
  f.raised = Math.max(0, f.raised - q.gross);
  const fee = q.gross * FEE;
  pit.purse += fee * FEE_SPLIT.purse;
  pit.volume += q.gross;
  if (f.yours && !you) {
    const earned = fee * FEE_SPLIT.creator + (q.gross * f.taxBps) / 10_000;
    state.purse.creatorFees += earned;
    state.purse.eth += earned;
  }
  if (chance(0.3) && f.holders > 1) f.holders--;
  const trade: Trade = { id: uid(), t, corner, kind: 'sell', eth: q.net, tokens, who, you };
  pit.tape.unshift(trade);
  pit.tape.length = Math.min(pit.tape.length, 60);
  return { trade, net: q.net };
};

const log = (text: string, tone: Purse['log'][number]['tone'] = 'neutral') => {
  state.purse.log.unshift({ t: Date.now(), text, tone });
  state.purse.log.length = Math.min(state.purse.log.length, 30);
};

const finish = (pit: Pit, winner: Corner, method: Method, t = Date.now()) => {
  if (pit.status === 'final') return;
  const loser: Corner = winner === 'red' ? 'blue' : 'red';
  const w = state.fighters[pit[winner]];
  const l = state.fighters[pit[loser]];
  pit.status = 'final';
  pit.winner = winner;
  pit.method = method;
  pit.endedAt = t;
  pit.series.push({ t, red: state.fighters[pit.red].raised, blue: state.fighters[pit.blue].raised });

  const wp = priceOf(w.raised);
  const lp = priceOf(l.raised);
  w.status = 'champion';
  w.finalPrice = wp;
  w.poolHistory = [wp];
  l.status = 'absorbed';
  l.finalPrice = lp;

  // Settle the practice purse.
  const P = state.purse;
  const lossPos = P.positions[l.id];
  const winPos = P.positions[w.id];
  if (winPos && winPos.tokens > 0) {
    P.wins++;
    log(`$${w.ticker} won by ${methodLabel(method)} — your bag graduated`, 'good');
  }
  if (lossPos && lossPos.tokens > 0) {
    const value = lossPos.tokens * lp * ABSORB_RATE;
    const absorbed = value / wp;
    const into = P.positions[w.id] ?? { tokens: 0, cost: 0 };
    into.tokens += absorbed;
    into.cost += lossPos.cost;
    P.positions[w.id] = into;
    delete P.positions[l.id];
    P.losses++;
    log(`$${l.ticker} lost — absorbed into ${fmtTokens(absorbed)} $${w.ticker} at 70%`, 'bad');
  }
  if (w.yours) log(`Your coin $${w.ticker} took the belt by ${methodLabel(method)}`, 'good');
  if (l.yours) log(`Your coin $${l.ticker} went down against $${w.ticker}`, 'bad');

  pushFeed(
    method === 'KO'
      ? { kind: 'ko', text: `KO — $${w.ticker} knocked out $${l.ticker}`, pitId: pit.id }
      : { kind: 'dec', text: `${method === 'SD' ? 'Split decision' : 'Decision'} — $${w.ticker} beat $${l.ticker}`, pitId: pit.id },
    t,
  );
  state.nextSpawnAt = Math.min(state.nextSpawnAt, Date.now() + 5000);
  notify();
};

export const methodLabel = (m?: Method) => (m === 'KO' ? 'knockout' : m === 'SD' ? 'split decision' : 'decision');

// ─── bots ────────────────────────────────────────────────────────────────────

const botTrade = (pit: Pit, now: number, capShare = 1) => {
  const cls = CLASSES[pit.cls];
  const red = state.fighters[pit.red];
  const blue = state.fighters[pit.blue];
  pit.bias = clamp(pit.bias + normal() * 0.06, -0.9, 0.9);

  // Late in the fight the trailing corner gets a little comeback energy.
  const remaining = (pit.bellAt - now) / (pit.rounds * ROUND_MS);
  const gap = (red.raised - blue.raised) / cls.target;
  const comeback = remaining < 0.35 ? -gap * 0.5 : 0;
  const pRed = clamp(0.5 + pit.bias * 0.28 + comeback, 0.1, 0.9);
  const corner: Corner = Math.random() < pRed ? 'red' : 'blue';
  const f = corner === 'red' ? red : blue;

  if (f.raised > cls.target * 0.04 && (chance(0.24) || f.raised > cls.target * capShare)) {
    const eth = cls.clip * Math.exp(normal() * 0.7);
    const tokens = Math.min(soldOf(f.raised) * 0.2, eth / priceOf(f.raised));
    applySell(pit, corner, tokens, address(), now);
    return;
  }
  const whale = chance(0.025);
  const maxEth = capShare < 1 ? Math.max(0.002, cls.target * capShare - f.raised) : cls.target * 0.35;
  const eth = clamp(cls.clip * Math.exp(normal() * 0.75) * (whale ? 6 : 1), 0.002, Math.min(maxEth, cls.target * 0.35));
  const trade = applyBuy(pit, corner, eth, address(), now);
  if (trade?.whale && whale && pit.status === 'live' && now > Date.now() - 2000 && chance(0.4)) {
    pushFeed({ kind: 'whale', text: `Haymaker — ${eth.toFixed(2)} ETH into $${f.ticker}`, pitId: pit.id }, now);
  }
};

// ─── lifecycle ───────────────────────────────────────────────────────────────

const spawnHouseBout = (startedAt = Date.now()) => {
  const a = makeFighter(drawRoster());
  const b = makeFighter(drawRoster());
  const pit = makePit(a, b, { startedAt });
  pushFeed({ kind: 'launch', text: `Bout #${pit.bout} — $${a.ticker} vs $${b.ticker}`, pitId: pit.id }, startedAt);
  return pit;
};

const livePits = () => state.order.map((id) => state.pits[id]).filter((p) => p.status === 'live');

const tick = () => {
  const now = Date.now();

  for (const pit of livePits()) {
    const trades = Math.random() < 0.38 ? (chance(0.12) ? 2 : 1) : 0;
    for (let i = 0; i < trades && pit.status === 'live'; i++) botTrade(pit, now);
    if (pit.status !== 'live') continue;

    const last = pit.series[pit.series.length - 1];
    if (now - last.t > 1500) {
      pit.series.push({ t: now, red: state.fighters[pit.red].raised, blue: state.fighters[pit.blue].raised });
      if (pit.series.length > 400) pit.series.splice(1, 1);
    }

    if (now >= pit.bellAt) {
      const r = state.fighters[pit.red].raised;
      const b = state.fighters[pit.blue].raised;
      const gap = Math.abs(r - b) / Math.max(r, b, 1e-9);
      if (gap < SPLIT_DECISION_GAP && !pit.overtime) {
        pit.overtime = true;
        pit.bellAt = now + OVERTIME_MS;
        pushFeed({ kind: 'bell', text: `Sudden death — bout #${pit.bout} is too close to call`, pitId: pit.id }, now);
      } else {
        finish(pit, r >= b ? 'red' : 'blue', pit.overtime ? 'SD' : 'DEC', now);
      }
    }
  }

  // Champions keep trading in their graduated pool.
  for (const f of Object.values(state.fighters)) {
    if (f.status !== 'champion' || !f.finalPrice) continue;
    f.finalPrice *= Math.exp(normal() * 0.012 + 0.0004);
    const h = (f.poolHistory ??= []);
    if (chance(0.25)) {
      h.push(f.finalPrice);
      if (h.length > 90) h.shift();
    }
  }

  // Challenges waiting for a rival.
  for (const c of [...state.challenges]) {
    if (now < c.acceptAt) continue;
    state.challenges = state.challenges.filter((x) => x.id !== c.id);
    const mine = state.fighters[c.fighter];
    const entry = c.rivalName
      ? { name: c.rivalName, ticker: c.rivalTicker || c.rivalName.replace(/[^a-z]/gi, '').slice(0, 6).toUpperCase(), bio: `Called out by $${mine.ticker}. Showed up anyway.` }
      : drawRoster();
    const rival = makeFighter(entry);
    const pit = makePit(mine, rival, { cls: c.cls, rounds: c.rounds, yours: true });
    pit.bias = 0;
    pushFeed({ kind: 'you', text: `Your call-out was answered — $${mine.ticker} vs $${rival.ticker}`, pitId: pit.id }, now);
    log(`$${rival.ticker} answered your call-out. Bout #${pit.bout} is live.`, 'neutral');
    if (c.openingEth > 0) buy(pit.id, 'red', c.openingEth);
  }

  if (livePits().length < 6 && now >= state.nextSpawnAt) {
    spawnHouseBout(now);
    state.nextSpawnAt = now + rand(9000, 20000);
  }

  // Keep history bounded: drop the oldest finished bouts and anything nobody holds.
  const finals = state.order.filter((id) => state.pits[id].status === 'final');
  for (const id of finals.slice(40)) {
    const p = state.pits[id];
    for (const fid of [p.red, p.blue]) {
      const f = state.fighters[fid];
      if (f && !f.yours && !state.purse.positions[fid] && (f.status === 'absorbed' || finals.indexOf(id) > 60)) delete state.fighters[fid];
    }
    delete state.pits[id];
    state.order = state.order.filter((x) => x !== id);
  }

  notify();
};

// ─── seeding ─────────────────────────────────────────────────────────────────

const seed = () => {
  state = {
    bout: 212,
    fighters: {},
    pits: {},
    order: [],
    feed: [],
    purse: { entered: false, eth: START_PURSE, positions: {}, wins: 0, losses: 0, creatorFees: 0, log: [] },
    challenges: [],
    nextSpawnAt: Date.now() + 15000,
  };

  const now = Date.now();

  // A card of finished bouts for history, champions and the belt.
  for (let i = 0; i < 12; i++) {
    const startedAt = now - (14 - i) * 6 * 60_000;
    const pit = spawnHouseBout(startedAt);
    const cls = CLASSES[pit.cls];
    let t = startedAt;
    let guard = 0;
    while (pit.status === 'live' && guard++ < 2000) {
      t += 450;
      if (t >= pit.bellAt) break;
      if (chance(0.42)) botTrade(pit, t);
      if (guard % 4 === 0) pit.series.push({ t, red: state.fighters[pit.red].raised, blue: state.fighters[pit.blue].raised });
      if (Math.max(state.fighters[pit.red].raised, state.fighters[pit.blue].raised) > cls.target * 0.99) break;
    }
    if (pit.status === 'live') {
      const r = state.fighters[pit.red].raised;
      const b = state.fighters[pit.blue].raised;
      finish(pit, r >= b ? 'red' : 'blue', Math.abs(r - b) / Math.max(r, b) < 0.06 ? 'SD' : 'DEC', Math.min(t, pit.bellAt));
    }
    const champ = state.fighters[pit[pit.winner!]];
    for (let j = 0; j < 60; j++) {
      champ.finalPrice! *= Math.exp(normal() * 0.03 + 0.002);
      champ.poolHistory!.push(champ.finalPrice!);
    }
  }

  // Live bouts at different stages.
  for (let i = 0; i < 6; i++) {
    const elapsed = rand(0.05, 0.8);
    const rounds = pick([4, 5, 6]);
    const startedAt = now - elapsed * rounds * ROUND_MS;
    const a = makeFighter(drawRoster());
    const b = makeFighter(drawRoster());
    const pit = makePit(a, b, { startedAt, rounds });
    const steps = Math.floor((now - startedAt) / 450);
    for (let s = 1; s <= steps; s++) {
      const t = startedAt + s * 450;
      // Keep seeded bouts short of a KO so visitors catch the finish.
      if (chance(0.42)) botTrade(pit, t, 0.7);
      if (s % 4 === 0) pit.series.push({ t, red: a.raised, blue: b.raised });
    }
  }
  state.feed.sort((x, y) => y.t - x.t);
};

// ─── persistence ─────────────────────────────────────────────────────────────

const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
  } catch {
    /* storage unavailable — the arena still runs in memory */
  }
};

const load = (): boolean => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { savedAt, state: s } = JSON.parse(raw) as { savedAt: number; state: ArenaState };
    const away = Date.now() - savedAt;
    if (away > 6 * 3600_000) {
      // Too long away: fresh card, but keep the purse history of wins/losses.
      seed();
      state.purse = { ...s.purse, positions: {} };
      log('The arena reset while you were away. Open positions were closed.', 'neutral');
      return true;
    }
    // Pause the clock while the tab was closed.
    for (const p of Object.values(s.pits)) {
      p.startedAt += away;
      p.bellAt += away;
      if (p.endedAt) p.endedAt += away;
      p.series.forEach((pt) => (pt.t += away));
      p.tape.forEach((tr) => (tr.t += away));
    }
    s.feed.forEach((e) => (e.t += away));
    s.challenges.forEach((c) => (c.acceptAt += away));
    s.nextSpawnAt += away;
    state = s;
    return true;
  } catch {
    return false;
  }
};

let started = false;
export const startArena = () => {
  if (started) return;
  started = true;
  if (!load()) seed();
  setInterval(tick, 450);
  setInterval(save, 4000);
  window.addEventListener('pagehide', save);
};

// ─── player actions ──────────────────────────────────────────────────────────

export const enterArena = () => {
  state.purse.entered = true;
  if (!state.purse.log.length) log(`Practice purse loaded with ${START_PURSE} ETH. Nothing here is real money.`, 'neutral');
  notify();
};

export const resetPurse = () => {
  state.purse = { entered: true, eth: START_PURSE, positions: {}, wins: 0, losses: 0, creatorFees: 0, log: [] };
  log(`Purse reset to ${START_PURSE} practice ETH.`, 'neutral');
  notify();
};

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

export const buy = (pitId: string, corner: Corner, eth: number): ActionResult => {
  const pit = state.pits[pitId];
  const P = state.purse;
  if (!pit || pit.status !== 'live') return { ok: false, message: 'This bout is over.' };
  if (!(eth > 0)) return { ok: false, message: 'Enter an amount.' };
  if (eth > P.eth + 1e-9) return { ok: false, message: 'Not enough practice ETH in your purse.' };
  const f = state.fighters[pit[corner]];
  const trade = applyBuy(pit, corner, eth, 'you', Date.now(), true);
  if (!trade) return { ok: false, message: 'That corner’s curve is already full.' };
  P.eth -= trade.eth;
  const pos = P.positions[f.id] ?? { tokens: 0, cost: 0 };
  pos.tokens += trade.tokens;
  pos.cost += trade.eth;
  P.positions[f.id] = pos;
  log(`Backed $${f.ticker} with ${trade.eth.toFixed(3)} ETH`, 'neutral');
  notify();
  return { ok: true, message: `You’re in $${f.ticker}’s corner: ${fmtTokens(trade.tokens)} tokens` };
};

export const sell = (pitId: string, corner: Corner, fraction: number): ActionResult => {
  const pit = state.pits[pitId];
  const P = state.purse;
  if (!pit || pit.status !== 'live') return { ok: false, message: 'This bout is over.' };
  const f = state.fighters[pit[corner]];
  const pos = P.positions[f.id];
  if (!pos || pos.tokens <= 0) return { ok: false, message: `You don’t hold $${f.ticker}.` };
  const tokens = pos.tokens * clamp(fraction, 0, 1);
  const res = applySell(pit, corner, tokens, 'you', Date.now(), true);
  if (!res) return { ok: false, message: 'Nothing to sell.' };
  P.eth += res.net;
  const costOut = pos.cost * (tokens / pos.tokens);
  pos.tokens -= tokens;
  pos.cost -= costOut;
  if (pos.tokens < 1) delete P.positions[f.id];
  const pnl = res.net - costOut;
  log(`Sold $${f.ticker} for ${res.net.toFixed(3)} ETH (${pnl >= 0 ? '+' : ''}${pnl.toFixed(3)})`, pnl >= 0 ? 'good' : 'bad');
  notify();
  return { ok: true, message: `Sold for ${res.net.toFixed(3)} ETH` };
};

/** Trade a graduated champion in its open pool (flat 1% fee, no curve). */
export const tradeChampion = (fighterId: string, side: 'buy' | 'sell', amount: number): ActionResult => {
  const f = state.fighters[fighterId];
  const P = state.purse;
  if (!f || f.status !== 'champion' || !f.finalPrice) return { ok: false, message: 'Not tradable.' };
  if (side === 'buy') {
    if (!(amount > 0) || amount > P.eth + 1e-9) return { ok: false, message: 'Not enough practice ETH.' };
    const tokens = (amount * (1 - FEE)) / f.finalPrice;
    P.eth -= amount;
    const pos = P.positions[f.id] ?? { tokens: 0, cost: 0 };
    pos.tokens += tokens;
    pos.cost += amount;
    P.positions[f.id] = pos;
    log(`Bought ${fmtTokens(tokens)} $${f.ticker} in the champion pool`, 'neutral');
  } else {
    const pos = P.positions[f.id];
    if (!pos) return { ok: false, message: `You don’t hold $${f.ticker}.` };
    const tokens = pos.tokens * clamp(amount, 0, 1);
    const net = tokens * f.finalPrice * (1 - FEE);
    const costOut = pos.cost * (tokens / pos.tokens);
    P.eth += net;
    pos.tokens -= tokens;
    pos.cost -= costOut;
    if (pos.tokens < 1) delete P.positions[f.id];
    log(`Sold $${f.ticker} for ${net.toFixed(3)} ETH (${net - costOut >= 0 ? '+' : ''}${(net - costOut).toFixed(3)})`, net >= costOut ? 'good' : 'bad');
  }
  notify();
  return { ok: true, message: 'Done.' };
};

export interface CallOutInput {
  name: string;
  ticker: string;
  bio: string;
  hue: number;
  pattern: number;
  image?: string;
  taxBps: number;
  cls: WeightClass;
  rounds: number;
  rivalName?: string;
  rivalTicker?: string;
  openingEth: number;
}

export const callOut = (input: CallOutInput): ActionResult => {
  const P = state.purse;
  const cost = LAUNCH_FEE + input.openingEth;
  if (cost > P.eth + 1e-9) return { ok: false, message: 'Not enough practice ETH for the launch fee and opening punch.' };
  if (usedTickers().has(input.ticker)) return { ok: false, message: `$${input.ticker} is already in the arena. Pick another ticker.` };
  P.eth -= LAUNCH_FEE;
  const f = makeFighter(
    { name: input.name, ticker: input.ticker, bio: input.bio || 'New in the arena.' },
    { hue: input.hue, pattern: input.pattern, image: input.image, taxBps: input.taxBps, creator: 'you', yours: true, status: 'waiting' },
  );
  state.challenges.push({
    id: uid(),
    fighter: f.id,
    rivalName: input.rivalName || undefined,
    rivalTicker: input.rivalTicker || undefined,
    cls: input.cls,
    rounds: input.rounds,
    acceptAt: Date.now() + rand(3500, 6000),
    openingEth: input.openingEth,
  });
  log(`Launched $${f.ticker}. Waiting for ${input.rivalName ? input.rivalName : 'a challenger'} to step in.`, 'neutral');
  pushFeed({ kind: 'you', text: input.rivalName ? `$${f.ticker} called out ${input.rivalName}` : `$${f.ticker} posted an open challenge` });
  notify();
  return { ok: true, message: f.id };
};

// ─── selectors & formatting ──────────────────────────────────────────────────

export const pitFor = (fighterId: string) => {
  const f = state.fighters[fighterId];
  return f?.pitId ? state.pits[f.pitId] : undefined;
};

export const positionValue = (fighterId: string) => {
  const pos = state.purse.positions[fighterId];
  const f = state.fighters[fighterId];
  if (!pos || !f) return 0;
  if (f.status === 'fighting') return quoteSell(f.raised, pos.tokens, f.taxBps).net;
  return pos.tokens * fighterPrice(f) * (1 - FEE);
};

export const netWorth = () =>
  state.purse.eth + Object.keys(state.purse.positions).reduce((s, id) => s + positionValue(id), 0);

export const fmtEth = (n: number, d = 3) => `${n.toFixed(d)} ETH`;
export const fmtUsd = (eth: number) => {
  const usd = eth * ETH_USD;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
};
export const fmtTokens = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};
export const shortAddr = (a: string) => (a === 'you' ? 'you' : `${a.slice(0, 6)}…${a.slice(-4)}`);
export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const ago = (t: number) => {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

export const roundOf = (pit: Pit, now = Date.now()) => {
  if (pit.overtime) return 'OT';
  const r = Math.floor((Math.min(now, pit.bellAt - 1) - pit.startedAt) / ROUND_MS) + 1;
  return `R${clamp(r, 1, pit.rounds)}`;
};
