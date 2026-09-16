import { fmtClock, fmtEth, fmtTokens, fmtUsd, mcapEth, positionValue, tradeChampion, type Pit } from '../sim/engine';
import { useArena } from '../lib/hooks';
import { Crest } from '../components/Crest';
import { Spark } from '../components/FightChart';
import { toast } from '../components/Chrome';

export function Belt({ onEnter }: { onEnter: () => void }) {
  const s = useArena();
  const finals = s.order.map((id) => s.pits[id]).filter((p): p is Pit => !!p && p.status === 'final');
  const champs = Object.values(s.fighters)
    .filter((f) => f.status === 'champion')
    .sort((a, b) => mcapEth(b) - mcapEth(a));

  const fastest = finals.filter((p) => p.method === 'KO').sort((a, b) => a.endedAt! - a.startedAt - (b.endedAt! - b.startedAt))[0];
  const closest = finals
    .filter((p) => p.method !== 'KO')
    .sort((a, b) => {
      const g = (p: Pit) => Math.abs(s.fighters[p.red]?.raised - s.fighters[p.blue]?.raised) || 99;
      return g(a) - g(b);
    })[0];

  const beatBy = (fid: string) => {
    const p = finals.find((x) => x[x.winner!] === fid);
    if (!p) return null;
    const l = s.fighters[p[p.winner === 'red' ? 'blue' : 'red']];
    return { pit: p, loser: l };
  };

  const act = (id: string, side: 'buy' | 'sell') => {
    if (!s.purse.entered) return onEnter();
    const r = tradeChampion(id, side, side === 'buy' ? 0.1 : 1);
    toast(side === 'buy' ? (r.ok ? 'Bought 0.1 ETH of the champion' : r.message) : r.ok ? 'Sold your whole bag' : r.message, r.ok);
  };

  return (
    <main className="wrap page-pad">
      <header className="page-head">
        <p className="eyebrow">Graduated pools</p>
        <h1 className="display page-title">The <span className="bell">Belt</span></h1>
        <p className="section-sub">Every coin that won its fight, ranked by market cap. Champions trade in an open pool with a flat 1% fee.</p>
      </header>

      <div className="awards">
        {fastest && (
          <a className="award" href={`#/pit/${fastest.id}`}>
            <span className="mono eyebrow">Fastest knockout</span>
            <strong className="display">${s.fighters[fastest[fastest.winner!]]?.ticker}</strong>
            <span className="mono">Finished in {fmtClock(fastest.endedAt! - fastest.startedAt)}</span>
          </a>
        )}
        {closest && (
          <a className="award" href={`#/pit/${closest.id}`}>
            <span className="mono eyebrow">Fight of the night</span>
            <strong className="display">${s.fighters[closest.red]?.ticker} × ${s.fighters[closest.blue]?.ticker}</strong>
            <span className="mono">
              Decided by {Math.abs((s.fighters[closest.red]?.raised ?? 0) - (s.fighters[closest.blue]?.raised ?? 0)).toFixed(3)} ETH
            </span>
          </a>
        )}
        {champs[0] && (
          <div className="award award--gold">
            <span className="mono eyebrow">Heaviest belt</span>
            <strong className="display">${champs[0].ticker}</strong>
            <span className="mono">{fmtUsd(mcapEth(champs[0]))} market cap</span>
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table className="table table--belt mono">
          <thead>
            <tr><th>#</th><th>Champion</th><th>Won by</th><th>Mcap</th><th>Since the bell</th><th></th><th>Your bag</th><th></th></tr>
          </thead>
          <tbody>
            {champs.map((f, i) => {
              const h = f.poolHistory ?? [];
              const chg = h.length > 1 ? h[h.length - 1] / h[0] - 1 : 0;
              const b = beatBy(f.id);
              const pos = s.purse.positions[f.id];
              return (
                <tr key={f.id}>
                  <td className="rank">{String(i + 1).padStart(2, '0')}</td>
                  <td>
                    <span className="cell-fighter">
                      <Crest fighter={f} size={30} />
                      <span><b>{f.name}</b><br /><span className="dim">${f.ticker}</span></span>
                    </span>
                  </td>
                  <td className="dim">
                    {b ? <a href={`#/pit/${b.pit.id}`}>{b.pit.method} over ${b.loser?.ticker ?? '—'}</a> : '—'}
                  </td>
                  <td>{fmtUsd(mcapEth(f))}</td>
                  <td className={chg >= 0 ? 'up' : 'down'}>{chg >= 0 ? '+' : ''}{(chg * 100).toFixed(1)}%</td>
                  <td className="spark-cell"><Spark values={h} /></td>
                  <td>{pos ? `${fmtTokens(pos.tokens)} · ${fmtEth(positionValue(f.id), 3)}` : <span className="dim">—</span>}</td>
                  <td className="actions">
                    <button className="btn btn--sm btn--ghost" onClick={() => act(f.id, 'buy')}>Buy 0.1</button>
                    {pos && <button className="btn btn--sm btn--ghost" onClick={() => act(f.id, 'sell')}>Sell all</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
