import { useState } from 'react';

export const RANK_COLORS: Record<string, string> = {
  bronze:   '#cd7f32',
  silver:   '#a8b4be',
  gold:     '#f0b429',
  platinum: '#22d3ee',
  diamond:  '#60a5fa',
  paragon:  '#c084fc',
};

export function getRankTierSlug(rankLabel: string | null): string | null {
  if (!rankLabel) return null;
  const tier = rankLabel.split(/\s+/)[0]?.toLowerCase();
  return tier && tier in RANK_COLORS ? tier : null;
}

export function getRankColor(rankLabel: string | null): string {
  const slug = getRankTierSlug(rankLabel);
  return slug ? RANK_COLORS[slug] : 'var(--text-muted)';
}

interface RankIconProps {
  rankLabel: string | null;
  ratingPoints: number | null;
  size?: number;
}

export function RankIcon({ rankLabel, ratingPoints, size = 80 }: RankIconProps) {
  const [imgErr, setImgErr] = useState(false);
  const slug = getRankTierSlug(rankLabel);
  const color = slug ? RANK_COLORS[slug] : '#888';
  const border = Math.max(3, size * 0.045);
  const innerSize = size - border * 2;

  if (!slug || !rankLabel) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
      {/* Circular frame with rank-colored ring */}
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        border: `${border}px solid ${color}`,
        boxShadow: `0 0 14px ${color}50, inset 0 0 8px rgba(0,0,0,0.4)`,
        background: 'var(--bg-dark)',
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {!imgErr ? (
          <img
            src={`/ranks/${slug}.webp`}
            alt={rankLabel}
            style={{ width: innerSize, height: innerSize, objectFit: 'contain' }}
            onError={() => setImgErr(true)}
          />
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: innerSize * 0.3, color, fontWeight: 700 }}>
            {rankLabel.slice(0, 2).toUpperCase()}
          </span>
        )}

        {/* VP overlay at bottom of circle */}
        {ratingPoints !== null && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.72) 60%)',
            paddingBottom: size * 0.06, paddingTop: size * 0.15,
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: Math.max(10, size * 0.19) + 'px',
            fontWeight: 800, color: 'white',
            textShadow: '0 1px 4px rgba(0,0,0,0.9)',
            lineHeight: 1,
          }}>
            {ratingPoints}
          </div>
        )}
      </div>

      {/* Rank name below circle */}
      <div style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700,
        fontSize: Math.max(10, size * 0.155) + 'px',
        color, whiteSpace: 'nowrap', letterSpacing: '0.01em',
      }}>
        {rankLabel}
      </div>
    </div>
  );
}
