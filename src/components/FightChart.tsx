import { useEffect, useRef, useState } from 'react';
import { CLASSES, type Pit } from '../sim/engine';

/** Both corners' ETH raised over the bout, with the KO line on top. */
export function FightChart({ pit }: { pit: Pit }) {
  // Draw at the element's real pixel size so labels never stretch.
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 280 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = size.w;
  const H = size.h;
  const pad = { l: 8, r: 52, t: 18, b: 22 };
  const target = CLASSES[pit.cls].target;
  const t0 = pit.startedAt;
  const t1 = Math.max(pit.bellAt, pit.endedAt ?? 0, t0 + 1);
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / target) * (H - pad.t - pad.b);

  const line = (key: 'red' | 'blue') =>
    pit.series.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(' ');
  const area = (key: 'red' | 'blue') => {
    const last = pit.series[pit.series.length - 1];
    return `${line(key)} L${x(last.t).toFixed(1)} ${y(0)} L${x(t0)} ${y(0)} Z`;
  };

  const rounds = Array.from({ length: pit.rounds - 1 }, (_, i) => t0 + ((i + 1) * (pit.bellAt - t0)) / pit.rounds);
  const last = pit.series[pit.series.length - 1];

  return (
    <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="ETH raised by each corner over time">
      <defs>
        <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--red)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--red)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--blue)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--blue)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={pad.l} x2={W - pad.r} y1={y(target * f)} y2={y(target * f)} className="chart__grid" />
      ))}
      {rounds.map((t, i) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={pad.t} y2={H - pad.b} className="chart__round" />
          <text x={x(t) + 4} y={H - 6} className="chart__label">R{i + 2}</text>
        </g>
      ))}
      <text x={pad.l + 4} y={H - 6} className="chart__label">R1</text>
      <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} className="chart__ko" />
      <text x={W - pad.r + 6} y={y(target) + 4} className="chart__label chart__label--ko">KO</text>
      <text x={W - pad.r + 6} y={y(target / 2) + 4} className="chart__label">{(target / 2).toFixed(1)}</text>
      <text x={W - pad.r + 6} y={y(0)} className="chart__label">0 ETH</text>
      {pit.bellAt > t0 && <line x1={x(pit.bellAt)} x2={x(pit.bellAt)} y1={pad.t} y2={H - pad.b} className="chart__bell" />}
      <path d={area('red')} fill="url(#gRed)" />
      <path d={area('blue')} fill="url(#gBlue)" />
      <path d={line('red')} className="chart__line chart__line--red" />
      <path d={line('blue')} className="chart__line chart__line--blue" />
      {pit.status === 'live' && (
        <>
          <circle cx={x(last.t)} cy={y(last.red)} r="4" className="chart__dot chart__dot--red" />
          <circle cx={x(last.t)} cy={y(last.blue)} r="4" className="chart__dot chart__dot--blue" />
        </>
      )}
    </svg>
  );
}

export function Spark({ values, up }: { values: number[]; up?: boolean }) {
  if (values.length < 2) return <svg className="spark" viewBox="0 0 100 28" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const d = values
    .map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * 100).toFixed(1)} ${(26 - ((v - min) / (max - min || 1)) * 24).toFixed(1)}`)
    .join(' ');
  return (
    <svg className={`spark ${up ?? values[values.length - 1] >= values[0] ? 'spark--up' : 'spark--down'}`} viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden>
      <path d={d} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
