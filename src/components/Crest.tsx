import type { Fighter } from '../sim/engine';

interface Props {
  fighter: Pick<Fighter, 'ticker' | 'hue' | 'pattern' | 'image'>;
  size?: number;
  corner?: 'red' | 'blue';
  dim?: boolean;
}

/** A procedural fight-badge for a coin. Uses the uploaded image when there is one. */
export function Crest({ fighter, size = 64, corner, dim }: Props) {
  const { hue, pattern, ticker, image } = fighter;
  const id = `c${ticker}${hue}${pattern}`.replace(/[^a-z0-9]/gi, '');
  const base = `hsl(${hue} 70% 52%)`;
  const dark = `hsl(${hue} 55% 18%)`;
  const ring = corner === 'red' ? 'var(--red)' : corner === 'blue' ? 'var(--blue)' : 'var(--bone)';
  const letters = ticker.slice(0, ticker.length > 4 ? 2 : 3);

  return (
    <svg
      className={`crest${dim ? ' crest--dim' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`$${ticker} crest`}
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d="M50 4 L92 20 V52 C92 76 72 90 50 97 C28 90 8 76 8 52 V20 Z" />
        </clipPath>
        <pattern id={`${id}-p`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform={`rotate(${[0, 45, -30, 90, 15, 60][pattern]})`}>
          {pattern % 3 === 0 && <rect width="6" height="12" fill={dark} opacity="0.55" />}
          {pattern % 3 === 1 && <circle cx="6" cy="6" r="2.4" fill={dark} opacity="0.6" />}
          {pattern % 3 === 2 && <path d="M0 12 L6 4 L12 12" fill="none" stroke={dark} strokeWidth="2.2" opacity="0.6" />}
        </pattern>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="100" height="100" fill={base} />
        {image ? (
          <image href={image} width="100" height="100" preserveAspectRatio="xMidYMid slice" />
        ) : (
          <>
            <rect width="100" height="100" fill={`url(#${id}-p)`} />
            <rect y="58" width="100" height="42" fill={dark} />
            <text
              x="50"
              y={letters.length > 2 ? 50 : 52}
              textAnchor="middle"
              fontFamily="Anton, Impact, sans-serif"
              fontSize={letters.length > 2 ? 30 : 38}
              fill="#0d0c0b"
            >
              {letters}
            </text>
            <text x="50" y="85" textAnchor="middle" fontFamily="'IBM Plex Mono', monospace" fontSize="10" letterSpacing="1.5" fill={base}>
              ${ticker.slice(0, 8)}
            </text>
          </>
        )}
      </g>
      <path d="M50 4 L92 20 V52 C92 76 72 90 50 97 C28 90 8 76 8 52 V20 Z" fill="none" stroke={ring} strokeWidth="4" />
    </svg>
  );
}
