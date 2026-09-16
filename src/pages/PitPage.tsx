import { useState } from 'react';
import {
  ABSORB_RATE,
  CLASSES,
  buy,
  fmtClock,
  fmtEth,
  fmtTokens,
  fmtUsd,
  mcapEth,
  methodLabel,
  positionValue,
  quoteBuy,
  roundOf,
  sell,
  shortAddr,
  type Corner,
  type Fighter,
  type Pit,
} from '../sim/engine';
import { useArena, useNow } from '../lib/hooks';
import { Crest } from '../components/Crest';
import { Rope } from '../components/Rope';
import { FightChart } from '../components/FightChart';
import { toast } from '../components/Chrome';

export function PitPage({ id, onEnter }: { id: string; onEnter: () => void }) {
  const s = useArena();
  const now = useNow(250);
  const pit = s.pits[id];

  if (!pit) {
    return (
      <main className="wrap page-pad">
        <h1 className="display page-title">This bout has left the building</h1>
        <p className="section-sub">Old results get cleared from the card. <a href="#/">Back to the arena →</a></p>
      </main>
    );
  }

  const red = s.fighters[pit.red];
  const blue = s.fighters[pit.blue];
  const target = CLASSES[pit.cls].target;
  const left = pit.bellAt - now;
  const live = pit.status === 'live';
  const winner = pit.winner ? s.fighters[pit[pit.winner]] : undefined;
  const loser = pit.winner ? s.fighters[pit[pit.winner === 'red' ? 'blue' : 'red']] : undefined;

  return (
    <main className="pit">
      <div className="wrap">
        <div className="pit__bar mono">
          <a href="#/">← Card</a>
          <span>Bout #{pit.bout}</span>
          <span>{pit.cls} · {CLASSES[pit.cls].blurb}</span>
          <span>{pit.rounds} rounds</span>
          {live ? (
            <span className={`pit__clock${left < 30_000 ? ' is-hot' : ''}`}>
              <i className="live-dot" /> {pit.overtime ? 'SUDDEN DEATH' : roundOf(pit, now)} · {fmtClock(left)} to the bell
            </span>
          ) : (
            <span className="pit__clock is-final">Final · {pit.method}</span>
          )}
        </div>

        {!live && winner && loser && (
          <div className={`verdict verdict--${pit.winner}`}>
            <span className="display">{pit.method === 'KO' ? 'KNOCKOUT' : pit.method === 'SD' ? 'SPLIT DECISION' : 'DECISION'}</span>
            <p>
              <b>${winner.ticker}</b> beat <b>${loser.ticker}</b> by {methodLabel(pit.method)} after {fmtClock((pit.endedAt ?? pit.bellAt) - pit.startedAt)}.
              ${winner.ticker} graduated to an open pool at {fmtUsd(mcapEth(winner))}. ${loser.ticker} holders were absorbed into ${winner.ticker} at {ABSORB_RATE * 100}% of their bag’s value.
            </p>
          </div>
        )}

        <section className="face">
          <FighterPanel f={red} corner="red" pit={pit} />
          <div className="face__mid">
            <span className="display face__vs">VS</span>
            <span className="mono face__purse">Purse<br /><b>{fmtEth(pit.purse, 3)}</b></span>
          </div>
          <FighterPanel f={blue} corner="blue" pit={pit} />
        </section>

        <Rope red={red.raised} blue={blue.raised} target={target} big winner={pit.winner} />

        <section className="pit__grid">
          <div className="panel pit__chart">
            <div className="panel__head mono">
              <span>ETH raised by corner</span>
              <span className="legend"><i className="lg-red" />${red.ticker} <i className="lg-blue" />${blue.ticker} <i className="lg-ko" />KO line</span>
            </div>
            <FightChart pit={pit} />
          </div>
          <TradePanel pit={pit} red={red} blue={blue} onEnter={onEnter} />
        </section>

        <section className="pit__grid pit__grid--low">
          <Tape pit={pit} red={red} blue={blue} />
          <Scorecard pit={pit} red={red} blue={blue} />
        </section>
      </div>
    </main>
  );
}

function FighterPanel({ f, corner, pit }: { f: Fighter; corner: Corner; pit: Pit }) {
  const lost = pit.status === 'final' && pit.winner !== corner;
  const won = pit.winner === corner;
  return (
    <div className={`fp fp--${corner}${lost ? ' is-lost' : ''}${won ? ' is-won' : ''}`}>
      <div className="fp__corner mono">{corner} corner{f.yours ? ' · your coin' : ''}</div>
      <Crest fighter={f} size={96} corner={corner} dim={lost} />
      <h2 className="display">{f.name}</h2>
      <p className="mono fp__ticker">${f.ticker}</p>
      <p className="fp__bio">“{f.bio}”</p>
      <dl className="fp__stats mono">
        <div><dt>Raised</dt><dd>{f.raised.toFixed(3)} ETH</dd></div>
        <div><dt>Mcap</dt><dd>{fmtUsd(mcapEth(f))}</dd></div>
        <div><dt>Crowd</dt><dd>{f.holders}</dd></div>
        <div><dt>Creator tax</dt><dd>{(f.taxBps / 100).toFixed(1)}%</dd></div>
        <div><dt>Trainer</dt><dd>{shortAddr(f.creator)}</dd></div>
      </dl>
      {won && <span className="stamp stamp--KO fp__stamp">{pit.method === 'KO' ? 'KO' : 'WIN'}</span>}
    </div>
  );
}

const PRESETS = [0.05, 0.1, 0.25, 0.5, 1];

function TradePanel({ pit, red, blue, onEnter }: { pit: Pit; red: Fighter; blue: Fighter; onEnter: () => void }) {
  const s = useArena();
  const [corner, setCorner] = useState<Corner>('red');
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('0.1');
  const f = corner === 'red' ? red : blue;
  const other = corner === 'red' ? blue : red;
  const pos = s.purse.positions[f.id];
  const eth = parseFloat(amount) || 0;
  const q = quoteBuy(f.raised, eth, f.taxBps);
  const live = pit.status === 'live';

  const submit = () => {
    if (!s.purse.entered) return onEnter();
    const res = mode === 'buy' ? buy(pit.id, corner, eth) : sell(pit.id, corner, parseFloat(amount) / 100);
    toast(res.message, res.ok);
  };

  const heldHere = [red, blue].filter((x) => s.purse.positions[x.id]);

  return (
    <div className={`panel trade trade--${corner}`}>
      <div className="trade__corners">
        {(['red', 'blue'] as Corner[]).map((c) => {
          const cf = c === 'red' ? red : blue;
          return (
            <button key={c} className={`trade__corner trade__corner--${c}${corner === c ? ' is-on' : ''}`} onClick={() => setCorner(c)}>
              <Crest fighter={cf} size={28} corner={c} />
              <span>Back ${cf.ticker}</span>
            </button>
          );
        })}
      </div>

      {live ? (
        <>
          <div className="seg mono">
            <button className={mode === 'buy' ? 'is-on' : ''} onClick={() => { setMode('buy'); setAmount('0.1'); }}>Buy</button>
            <button className={mode === 'sell' ? 'is-on' : ''} onClick={() => { setMode('sell'); setAmount('100'); }}>Sell</button>
          </div>

          <label className="field">
            <span className="mono">{mode === 'buy' ? 'Amount (practice ETH)' : 'Sell % of your bag'}</span>
            <div className="field__input">
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
              <em className="mono">{mode === 'buy' ? 'ETH' : '%'}</em>
            </div>
          </label>
          <div className="presets mono">
            {(mode === 'buy' ? PRESETS : [25, 50, 100]).map((p) => (
              <button key={p} onClick={() => setAmount(String(p))}>{mode === 'buy' ? p : `${p}%`}</button>
            ))}
          </div>

          {mode === 'buy' ? (
            <dl className="quote mono">
              <div><dt>You get</dt><dd>{fmtTokens(q.tokens)} ${f.ticker}</dd></div>
              <div><dt>Price impact</dt><dd>{(q.impact * 100).toFixed(2)}%</dd></div>
              <div><dt>Rope pull</dt><dd>+{((q.net / CLASSES[pit.cls].target) * 100).toFixed(1)}% toward KO</dd></div>
              <div><dt>If ${f.ticker} loses</dt><dd>Absorbed into ${other.ticker} at 70%</dd></div>
            </dl>
          ) : (
            <dl className="quote mono">
              <div><dt>Your bag</dt><dd>{pos ? `${fmtTokens(pos.tokens)} $${f.ticker}` : 'none'}</dd></div>
              <div><dt>Worth now</dt><dd>{pos ? fmtEth(positionValue(f.id) * ((parseFloat(amount) || 0) / 100), 4) : '—'}</dd></div>
            </dl>
          )}

          <button className={`btn btn--${corner} btn--block btn--lg`} onClick={submit} disabled={s.purse.entered && mode === 'sell' && !pos}>
            {!s.purse.entered ? 'Enter the arena to trade' : mode === 'buy' ? `Pull for $${f.ticker}` : `Sell $${f.ticker}`}
          </button>
          {s.purse.entered && <p className="trade__bal mono">Purse: {fmtEth(s.purse.eth, 3)}</p>}
        </>
      ) : (
        <div className="trade__closed">
          <p>The bell has rung. Curve trading is closed for this bout.</p>
          {pit.winner && <a className="btn btn--ghost btn--block" href="#/belt">Trade ${s.fighters[pit[pit.winner]].ticker} on The Belt</a>}
        </div>
      )}

      {heldHere.length > 0 && (
        <div className="trade__pos mono">
          {heldHere.map((x) => {
            const p = s.purse.positions[x.id];
            const v = positionValue(x.id);
            const pnl = v - p.cost;
            return (
              <div key={x.id}>
                <span>${x.ticker}</span>
                <span>{fmtTokens(p.tokens)}</span>
                <span>{fmtEth(v, 3)}</span>
                <b className={pnl >= 0 ? 'up' : 'down'}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(3)}</b>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tape({ pit, red, blue }: { pit: Pit; red: Fighter; blue: Fighter }) {
  return (
    <div className="panel tape">
      <div className="panel__head mono"><span>Ringside tape</span><span className="dim">simulated flow</span></div>
      <ul className="mono">
        {pit.tape.slice(0, 18).map((t) => {
          const f = t.corner === 'red' ? red : blue;
          return (
            <li key={t.id} className={`tape__row tape__row--${t.corner}${t.you ? ' is-you' : ''}${t.whale ? ' is-whale' : ''}`}>
              <span className="tape__kind">{t.kind === 'buy' ? 'PULL' : 'SLIP'}</span>
              <span>${f.ticker}</span>
              <span>{t.eth.toFixed(3)} ETH</span>
              <span className="dim">{shortAddr(t.who)}</span>
            </li>
          );
        })}
        {!pit.tape.length && <li className="dim">Waiting for the first punch…</li>}
      </ul>
    </div>
  );
}

function Scorecard({ pit, red, blue }: { pit: Pit; red: Fighter; blue: Fighter }) {
  const perRound = Array.from({ length: pit.rounds }, (_, i) => {
    const a = pit.startedAt + i * ((pit.bellAt - pit.startedAt) / pit.rounds);
    const b = a + (pit.bellAt - pit.startedAt) / pit.rounds;
    const inRound = pit.series.filter((p) => p.t >= a && p.t <= b);
    const before = [...pit.series].reverse().find((p) => p.t < a) ?? pit.series[0];
    const end = inRound[inRound.length - 1];
    if (!end || end.t <= a) return null;
    return { r: end.red - before.red, b: end.blue - before.blue };
  });
  return (
    <div className="panel score">
      <div className="panel__head mono"><span>Judges’ scorecard</span><span className="dim">net ETH per round</span></div>
      <table className="table mono">
        <thead>
          <tr><th>Round</th><th className="red">${red.ticker}</th><th className="blue">${blue.ticker}</th><th>Round to</th></tr>
        </thead>
        <tbody>
          {perRound.map((r, i) => (
            <tr key={i}>
              <td>R{i + 1}</td>
              <td>{r ? `${r.r >= 0 ? '+' : ''}${r.r.toFixed(2)}` : '—'}</td>
              <td>{r ? `${r.b >= 0 ? '+' : ''}${r.b.toFixed(2)}` : '—'}</td>
              <td>{r ? (Math.abs(r.r - r.b) < 0.005 ? 'Even' : r.r > r.b ? <span className="red">RED</span> : <span className="blue">BLUE</span>) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="score__note">Rounds are for show. The bout is decided by total ETH raised at the bell, or a KO before it.</p>
    </div>
  );
}
