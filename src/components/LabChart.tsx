import { useEffect, useRef, useState } from 'react';

export interface Series {
  key: string;
  values: number[];
  color: string;
  label: string;
  dashed?: boolean;
  fill?: boolean;
}

interface Props {
  series: Series[];
  cursor: number;
  onCursor?: (i: number) => void;
  format: (n: number) => string;
  height?: number;
  compact?: boolean;
}

/** Month-indexed line chart that draws at its real pixel size and supports scrubbing. */
export function LabChart({ series, cursor, onCursor, format, compact }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 600, h: compact ? 90 : 280 });
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

  const { w: W, h: H } = size;
  const pad = compact ? { l: 2, r: 2, t: 6, b: 4 } : { l: 8, r: 64, t: 14, b: 24 };
  const n = Math.max(...series.map((s) => s.values.length));
  const all = series.flatMap((s) => s.values);
  const max = Math.max(...all, 0) * 1.08 || 1;
  const x = (i: number) => pad.l + (n > 1 ? i / (n - 1) : 0) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);

  const scrub = (clientX: number) => {
    if (!onCursor || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const t = (clientX - r.left - pad.l) / (r.width - pad.l - pad.r);
    onCursor(Math.round(Math.min(1, Math.max(0, t)) * (n - 1)));
  };

  const ticks = [0.25, 0.5, 0.75, 1].map((f) => max * f / 1.08);
  const monthTicks = n > 1 ? [0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round((3 * (n - 1)) / 4), n - 1] : [0];

  return (
    <svg
      ref={ref}
      className={`labchart${compact ? ' labchart--compact' : ''}`}
      viewBox={`0 0 ${W} ${H}`}
      onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); scrub(e.clientX); }}
      onPointerMove={(e) => e.buttons && scrub(e.clientX)}
      role="img"
      aria-label={series.map((s) => s.label).join(', ')}
    >
      {!compact &&
        ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="labchart__grid" />
            <text x={W - pad.r + 6} y={y(t) + 4} className="labchart__label">{format(t)}</text>
          </g>
        ))}
      {!compact &&
        monthTicks.map((m) => (
          <text key={m} x={x(m)} y={H - 6} className="labchart__label" textAnchor={m === 0 ? 'start' : m === n - 1 ? 'end' : 'middle'}>
            M{m}
          </text>
        ))}
      {series.map((s) => {
        const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
        return (
          <g key={s.key}>
            {s.fill && <path d={`${d} L${x(s.values.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={s.color} opacity={0.14} />}
            <path d={d} fill="none" stroke={s.color} strokeWidth={compact ? 2 : 2.5} strokeDasharray={s.dashed ? '6 5' : undefined} />
          </g>
        );
      })}
      <line x1={x(cursor)} x2={x(cursor)} y1={pad.t} y2={H - pad.b} className="labchart__cursor" />
      {series.map((s) => s.values[cursor] !== undefined && (
        <circle key={s.key} cx={x(cursor)} cy={y(s.values[cursor])} r={compact ? 3.5 : 5} fill={s.color} stroke="var(--ink)" strokeWidth="2" />
      ))}
    </svg>
  );
}
