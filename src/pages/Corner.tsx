import { ago, fmtEth, fmtTokens, netWorth, pitFor, positionValue, resetPurse, START_PURSE } from '../sim/engine';
import { useArena } from '../lib/hooks';
import { Crest } from '../components/Crest';
import { toast } from '../components/Chrome';

export function Corner({ onEnter }: { onEnter: () => void }) {
  const s = useArena();
  const P = s.purse;

  if (!P.entered) {
    return (
      <main className="wrap page-pad corner-empty">
        <p className="eyebrow">Your corner</p>
        <h1 className="display page-title">Nobody’s in your corner yet</h1>
        <p className="section-sub">Grab a practice purse of {START_PURSE} ETH to back fighters, launch coins and build a fight record. No wallet needed.</p>
        <button className="btn btn--bell btn--lg" onClick={onEnter}>Enter the arena</button>
      </main>
    );
  }

  const worth = netWorth();
  const pnl = worth - START_PURSE;
  const ids = Object.keys(P.positions).filter((id) => s.fighters[id]);
  const mine = Object.values(s.fighters).filter((f) => f.yours);
  const fights = P.wins + P.losses;

  return (
    <main className="wrap page-pad">
      <header className="page-head">
        <p className="eyebrow">Your corner</p>
        <h1 className="display page-title">{fmtEth(worth, 3)}</h1>
        <p className={`section-sub mono ${pnl >= 0 ? 'up' : 'down'}`}>
          {pnl >= 0 ? '+' : ''}{pnl.toFixed(3)} ETH ({((pnl / START_PURSE) * 100).toFixed(1)}%) since you walked in
        </p>
      </header>

      <div className="statbar mono">
        <div><span>Cash in purse</span><b>{fmtEth(P.eth, 3)}</b></div>
        <div><span>Fight record</span><b>{P.wins}–{P.losses}</b></div>
        <div><span>Win rate</span><b>{fights ? `${Math.round((P.wins / fights) * 100)}%` : '—'}</b></div>
        <div><span>Creator fees earned</span><b>{fmtEth(P.creatorFees, 4)}</b></div>
      </div>

      <section className="corner-grid">
        <div className="panel">
          <div className="panel__head mono"><span>Your bags</span><span className="dim">{ids.length} open</span></div>
          {ids.length ? (
            <div className="table-wrap">
              <table className="table mono">
                <thead><tr><th>Coin</th><th>Status</th><th>Tokens</th><th>Worth</th><th>P&amp;L</th></tr></thead>
                <tbody>
                  {ids.map((id) => {
                    const f = s.fighters[id];
                    const pos = P.positions[id];
                    const v = positionValue(id);
                    const d = v - pos.cost;
                    const pit = pitFor(id);
                    return (
                      <tr key={id} onClick={() => (location.hash = f.status === 'champion' ? '/belt' : `/pit/${pit?.id}`)}>
                        <td><span className="cell-fighter"><Crest fighter={f} size={24} />${f.ticker}</span></td>
                        <td>{f.status === 'fighting' ? <span className="tag tag--live">In a fight</span> : <span className="tag tag--KO">Champion</span>}</td>
                        <td>{fmtTokens(pos.tokens)}</td>
                        <td>{fmtEth(v, 3)}</td>
                        <td className={d >= 0 ? 'up' : 'down'}>{d >= 0 ? '+' : ''}{d.toFixed(3)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">No bags. <a href="#/">Pick a corner on tonight’s card →</a></p>
          )}
        </div>

        <div className="panel">
          <div className="panel__head mono"><span>Fight log</span></div>
          <ul className="log">
            {P.log.map((l, i) => (
              <li key={i} className={`log__${l.tone}`}>
                <span>{l.text}</span>
                <em className="mono">{ago(l.t)}</em>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel mine">
        <div className="panel__head mono"><span>Coins you launched</span><a href="#/call-out">Call someone out →</a></div>
        {mine.length ? (
          <div className="mine__grid">
            {mine.map((f) => {
              const pit = pitFor(f.id);
              return (
                <a key={f.id} href={pit ? `#/pit/${pit.id}` : '#/call-out'} className="mine__item">
                  <Crest fighter={f} size={56} corner="red" dim={f.status === 'absorbed'} />
                  <div>
                    <strong>{f.name}</strong>
                    <span className="mono">
                      ${f.ticker} · {f.status === 'waiting' ? 'waiting for a rival' : f.status === 'fighting' ? 'fighting now' : f.status === 'champion' ? 'champion' : 'absorbed'}
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <p className="empty">You haven’t launched anything yet.</p>
        )}
      </section>

      <button
        className="linkish mono reset"
        onClick={() => {
          if (confirm('Reset your practice purse to 10 ETH and clear your record?')) {
            resetPurse();
            toast('Purse reset');
          }
        }}
      >
        Reset practice purse
      </button>
    </main>
  );
}
