interface Props {
  red: number;
  blue: number;
  target: number;
  big?: boolean;
  winner?: 'red' | 'blue';
}

/**
 * Tug-of-war meter. The knot sits at blue's share of the total raised, so
 * buys on the red side pull it left, and buys on blue pull it right. The red
 * and blue bars under it show how close each coin is to a KO.
 */
export function Rope({ red, blue, target, big, winner }: Props) {
  const total = red + blue;
  const share = total > 0 ? blue / total : 0.5;
  const knot = 6 + share * 88;
  const redPct = Math.min(100, (red / target) * 100);
  const bluePct = Math.min(100, (blue / target) * 100);

  return (
    <div className={`rope${big ? ' rope--big' : ''}${winner ? ` rope--${winner}` : ''}`}>
      <div className="rope__track" aria-hidden>
        <span className="rope__line" />
        <span className="rope__mid" />
        <span className="rope__knot" style={{ left: `${knot}%` }} />
      </div>
      <div className="rope__ko">
        <div className="rope__bar rope__bar--red" title={`Red is ${redPct.toFixed(0)}% of the way to a KO`}>
          <span style={{ width: `${redPct}%` }} />
        </div>
        <div className="rope__bar rope__bar--blue" title={`Blue is ${bluePct.toFixed(0)}% of the way to a KO`}>
          <span style={{ width: `${bluePct}%` }} />
        </div>
      </div>
      <div className="rope__labels mono">
        <span>{redPct.toFixed(0)}% to KO</span>
        <span>{bluePct.toFixed(0)}% to KO</span>
      </div>
    </div>
  );
}
