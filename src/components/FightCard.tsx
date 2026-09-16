import { CLASSES, fmtClock, fmtEth, roundOf, type Pit } from '../sim/engine';
import { useArena } from '../lib/hooks';
import { Crest } from './Crest';
import { Rope } from './Rope';

export function FightCard({ pit, now }: { pit: Pit; now: number }) {
  const s = useArena();
  const red = s.fighters[pit.red];
  const blue = s.fighters[pit.blue];
  if (!red || !blue) return null;
  const target = CLASSES[pit.cls].target;
  const live = pit.status === 'live';
  const left = pit.bellAt - now;
  const held = s.purse.positions[red.id] || s.purse.positions[blue.id];

  const row = (f: typeof red, corner: 'red' | 'blue') => {
    const won = pit.winner === corner;
    const lost = pit.status === 'final' && !won;
    return (
      <div className={`fc__row fc__row--${corner}${lost ? ' is-lost' : ''}`}>
        <Crest fighter={f} size={40} corner={corner} dim={lost} />
        <div className="fc__who">
          <strong>{f.name}</strong>
          <span className="mono">${f.ticker}{f.yours ? ' · yours' : ''}</span>
        </div>
        <div className="fc__num mono">
          <b>{f.raised.toFixed(2)}</b>
          <span>/ {target} ETH</span>
        </div>
        {won && <span className="fc__win mono">W</span>}
      </div>
    );
  };

  return (
    <a href={`#/pit/${pit.id}`} className={`fc${live ? '' : ' fc--final'}${pit.yours ? ' fc--yours' : ''}`}>
      <div className="fc__top mono">
        <span>Bout #{pit.bout} · {pit.cls}</span>
        {live ? (
          <span className={`fc__clock${left < 30_000 ? ' is-hot' : ''}`}>
            <i className="live-dot" />
            {roundOf(pit, now)} · {fmtClock(left)}
          </span>
        ) : (
          <span className="fc__method">{pit.method}</span>
        )}
      </div>
      {row(red, 'red')}
      <div className="fc__vs mono">vs</div>
      {row(blue, 'blue')}
      <Rope red={red.raised} blue={blue.raised} target={target} winner={pit.winner} />
      <div className="fc__foot mono">
        <span>Vol {fmtEth(pit.volume, 2)}</span>
        <span>{red.holders + blue.holders} in the crowd</span>
        {held && <span className="fc__held">You’re in</span>}
      </div>
      {pit.status === 'final' && <span className={`stamp stamp--${pit.method}`}>{pit.method === 'KO' ? 'KO' : pit.method === 'SD' ? 'SPLIT' : 'DECISION'}</span>}
    </a>
  );
}
