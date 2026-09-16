import { useMemo, useState } from 'react';
import { CLASSES, fmtClock, fmtEth, fmtUsd, mcapEth, roundOf, type Pit } from '../sim/engine';
import { useArena, useNow } from '../lib/hooks';
import { Crest } from '../components/Crest';
import { Rope } from '../components/Rope';
import { FightCard } from '../components/FightCard';

const FILTERS = ['All live', 'Closest', 'Near KO', 'Bell soon', 'Featherweight', 'Middleweight', 'Heavyweight', 'Results'] as const;
type Filter = (typeof FILTERS)[number];

export function Arena({ onEnter }: { onEnter: () => void }) {
  const s = useArena();
  const now = useNow(250);
  const [filter, setFilter] = useState<Filter>('All live');

  const pits = s.order.map((id) => s.pits[id]).filter(Boolean);
  const live = pits.filter((p) => p.status === 'live');
  const finals = pits.filter((p) => p.status === 'final');

  const heat = (p: Pit) => {
    const r = s.fighters[p.red].raised;
    const b = s.fighters[p.blue].raised;
    return Math.max(r, b) / CLASSES[p.cls].target;
  };
  const closeness = (p: Pit) => {
    const r = s.fighters[p.red].raised;
    const b = s.fighters[p.blue].raised;
    return Math.abs(r - b) / Math.max(r, b, 0.01);
  };

  const main = useMemo(() => {
    const mine = live.find((p) => p.yours);
    return mine ?? [...live].sort((a, b) => heat(b) - heat(a))[0];
  }, [s.order.join(), Math.floor(now / 4000)]);

  const shown = (() => {
    switch (filter) {
      case 'Closest': return [...live].sort((a, b) => closeness(a) - closeness(b));
      case 'Near KO': return [...live].sort((a, b) => heat(b) - heat(a));
      case 'Bell soon': return [...live].sort((a, b) => a.bellAt - b.bellAt);
      case 'Featherweight':
      case 'Middleweight':
      case 'Heavyweight': return live.filter((p) => p.cls === filter);
      case 'Results': return finals.slice(0, 12);
      default: return live;
    }
  })();

  const kos = finals.filter((p) => p.method === 'KO').length;
  const liveVol = live.reduce((a, p) => a + p.volume, 0);

  return (
    <main>
      <section className="hero wrap">
        <div className="hero__copy">
          <p className="eyebrow"><i className="live-dot" /> {live.length} bouts live on the card</p>
          <h1 className="display hero__title">
            Every coin is <span className="red">born</span> in a <span className="blue">fight.</span>
          </h1>
          <p className="hero__lede">
            No coin launches alone. Name your coin, name your rival, and put both on one clock. Buys pull the rope.
            Fill your curve first and it’s a knockout. The loser’s holders get absorbed into the winner.
          </p>
          <div className="hero__cta">
            <a className="btn btn--red btn--lg" href="#/call-out">Call someone out</a>
            {s.purse.entered ? (
              main && <a className="btn btn--ghost btn--lg" href={`#/pit/${main.id}`}>Watch the main event</a>
            ) : (
              <button className="btn btn--ghost btn--lg" onClick={onEnter}>Get 10 practice ETH</button>
            )}
          </div>
        </div>

        {main && <MainEvent pit={main} now={now} />}
      </section>

      <section className="statbar wrap mono">
        <div><span>Live bouts</span><b>{live.length}</b></div>
        <div><span>Knockouts on the card</span><b>{kos}</b></div>
        <div><span>Live volume</span><b>{fmtEth(liveVol, 2)}</b></div>
        <div><span>Champions crowned</span><b>{finals.length}</b></div>
      </section>

      <section className="wrap card-section">
        <div className="section-head">
          <h2 className="display">Tonight’s card</h2>
          <div className="filters" role="tablist">
            {FILTERS.map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>
        {shown.length ? (
          <div className="fc-grid">
            {shown.map((p) => <FightCard key={p.id} pit={p} now={now} />)}
          </div>
        ) : (
          <div className="empty">No bouts in this division right now. <a href="#/call-out">Start one →</a></div>
        )}
      </section>

      <section className="wrap results">
        <div className="section-head">
          <h2 className="display">Results</h2>
          <p className="section-sub">Winners graduate to an open pool. Losers get absorbed.</p>
        </div>
        <div className="table-wrap">
          <table className="table mono">
            <thead>
              <tr><th>Bout</th><th>Winner</th><th>Method</th><th>Beat</th><th>Class</th><th>Final mcap</th><th>Ended</th></tr>
            </thead>
            <tbody>
              {finals.slice(0, 10).map((p) => {
                const w = s.fighters[p[p.winner!]];
                const l = s.fighters[p[p.winner === 'red' ? 'blue' : 'red']];
                if (!w || !l) return null;
                return (
                  <tr key={p.id} onClick={() => (location.hash = `/pit/${p.id}`)}>
                    <td>#{p.bout}</td>
                    <td><span className="cell-fighter"><Crest fighter={w} size={22} />${w.ticker}</span></td>
                    <td><span className={`tag tag--${p.method}`}>{p.method}</span></td>
                    <td className="dim">${l.ticker}</td>
                    <td className="dim">{p.cls}</td>
                    <td>{fmtUsd(mcapEth(w))}</td>
                    <td className="dim">{fmtClock((p.endedAt ?? p.bellAt) - p.startedAt)} in</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="wrap how">
        <h2 className="display">Four rules. That’s the fight.</h2>
        <ol className="how__grid">
          <li><b>01</b><h3>Call out</h3><p>Launch a coin and name its rival, or post an open challenge. Both corners start at zero on the same clock.</p></li>
          <li><b>02</b><h3>Pull the rope</h3><p>Every buy pushes your corner’s curve toward its target. Every sell lets the rope slip back.</p></li>
          <li><b>03</b><h3>KO or decision</h3><p>Fill your curve first and the bout ends there. If nobody fills, the bigger corner wins at the final bell.</p></li>
          <li><b>04</b><h3>Winner takes the crowd</h3><p>The winner graduates to an open pool. Loser holders swap into the winner at 70% of their bag’s value.</p></li>
        </ol>
        <a className="btn btn--ghost" href="#/rulebook">Read the full rulebook</a>
      </section>
    </main>
  );
}

function MainEvent({ pit, now }: { pit: Pit; now: number }) {
  const s = useArena();
  const red = s.fighters[pit.red];
  const blue = s.fighters[pit.blue];
  const target = CLASSES[pit.cls].target;
  const left = pit.bellAt - now;

  return (
    <a href={`#/pit/${pit.id}`} className="main-event">
      <div className="main-event__top mono">
        <span className="bell-tag">{pit.yours ? 'Your bout' : 'Main event'}</span>
        <span>Bout #{pit.bout} · {pit.cls}</span>
        <span className={left < 30_000 ? 'is-hot' : ''}>{pit.overtime ? 'Sudden death' : roundOf(pit, now)} · {fmtClock(left)}</span>
      </div>
      <div className="main-event__face">
        <div className="me-fighter me-fighter--red">
          <Crest fighter={red} size={112} corner="red" />
          <strong className="display">{red.name}</strong>
          <span className="mono">${red.ticker} · {red.raised.toFixed(2)} ETH</span>
        </div>
        <div className="me-vs display">VS</div>
        <div className="me-fighter me-fighter--blue">
          <Crest fighter={blue} size={112} corner="blue" />
          <strong className="display">{blue.name}</strong>
          <span className="mono">${blue.ticker} · {blue.raised.toFixed(2)} ETH</span>
        </div>
      </div>
      <Rope red={red.raised} blue={blue.raised} target={target} big />
      <div className="main-event__foot mono">
        <span>Volume {fmtEth(pit.volume, 2)}</span>
        <span>Winner’s purse {fmtEth(pit.purse, 3)}</span>
        <span className="main-event__go">Enter the pit →</span>
      </div>
    </a>
  );
}
