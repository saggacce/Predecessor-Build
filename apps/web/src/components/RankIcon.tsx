import { useState } from 'react';

const RANK_SLUGS: Record<string, string> = {
  bronze: 'bronze',
  silver: 'silver',
  gold: 'gold',
  platinum: 'platinum',
  diamond: 'diamond',
  paragon: 'paragon',
};

function getRankSlug(rankLabel: string | null): string | null {
  if (!rankLabel) return null;
  const tier = rankLabel.split(/\s+/)[0]?.toLowerCase();
  return tier ? (RANK_SLUGS[tier] ?? null) : null;
}

interface Props {
  rankLabel: string | null;
  ratingPoints: number | null;
  size?: number;
}

export function RankIcon({ rankLabel, ratingPoints, size = 64 }: Props) {
  const [imgErr, setImgErr] = useState(false);
  const slug = getRankSlug(rankLabel);

  if (!slug || !rankLabel) return null;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {!imgErr ? (
        <img
          src={`/ranks/${slug}.webp`}
          alt={rankLabel}
          title={rankLabel}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          onError={() => setImgErr(true)}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)',
          border: '1px solid var(--border-color)', borderRadius: '50%',
        }}>
          {rankLabel.slice(0, 2).toUpperCase()}
        </div>
      )}
      {ratingPoints !== null && (
        <div style={{
          position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)', fontSize: Math.max(9, size * 0.155) + 'px',
          fontWeight: 700, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          whiteSpace: 'nowrap', lineHeight: 1,
        }}>
          {ratingPoints}
        </div>
      )}
    </div>
  );
}

export { getRankSlug };
