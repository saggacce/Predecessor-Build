import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { HeroMeta } from '../api/client';

const ROLE_ICON_SLUG: Record<string, string> = {
  CARRY: 'carry', SUPPORT: 'support', JUNGLE: 'jungle',
  OFFLANE: 'offlane', MIDLANE: 'midlane', MID_LANE: 'midlane',
};

function formatClass(c: string): string {
  return c.charAt(0) + c.slice(1).toLowerCase();
}

function formatRole(r: string): string {
  const labels: Record<string, string> = {
    CARRY: 'Carry', SUPPORT: 'Support', JUNGLE: 'Jungle',
    OFFLANE: 'Offlane', MIDLANE: 'Mid Lane', MID_LANE: 'Mid Lane',
  };
  return labels[r] ?? r;
}

interface Props {
  slug: string | null | undefined;
  name?: string | null;
  imageUrl?: string | null;
  meta?: HeroMeta | null;
  size: number;
  rounded?: number;
}

export function HeroAvatarWithTooltip({ slug, name, imageUrl, meta, size, rounded = 8 }: Props) {
  const [imgErr, setImgErr] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const localSrc = slug ? `/heroes/${slug}.webp` : null;
  const src = !imgErr && localSrc ? localSrc : (imageUrl ?? null);

  const displayName = meta?.displayName ?? name ?? slug ?? 'Hero';
  const initials = displayName.split(/[\s_\-&]+/).filter(Boolean).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();

  function handleMouseEnter() {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTipPos({
        top: rect.top + window.scrollY - 10,
        left: rect.left + rect.width / 2,
      });
    }
    setShowTip(true);
  }

  // Reposition on scroll so tooltip follows
  useEffect(() => {
    if (!showTip) return;
    const update = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTipPos({ top: rect.top + window.scrollY - 10, left: rect.left + rect.width / 2 });
      }
    };
    window.addEventListener('scroll', update, true);
    return () => window.removeEventListener('scroll', update, true);
  }, [showTip]);

  const tooltip = showTip ? createPortal(
    <div style={{
      position: 'absolute',
      top: tipPos.top,
      left: tipPos.left,
      transform: 'translate(-50%, -100%)',
      zIndex: 9999,
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '0.65rem 0.9rem',
      minWidth: '155px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
      pointerEvents: 'none',
    }}>
      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.4rem', whiteSpace: 'nowrap' }}>
        {displayName}
      </div>
      {meta?.classes && meta.classes.length > 0 && (
        <div style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', marginBottom: '0.3rem', fontWeight: 600 }}>
          {meta.classes.map(formatClass).join(' · ')}
        </div>
      )}
      {meta?.roles && meta.roles.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {meta.roles.map((r) => {
            const roleSlug = ROLE_ICON_SLUG[r];
            return (
              <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {roleSlug && <img src={`/icons/roles/${roleSlug}.png`} alt={r} style={{ width: 11, height: 11, objectFit: 'contain' }} />}
                {formatRole(r)}
              </span>
            );
          })}
        </div>
      )}
      {!meta && slug && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{slug}</div>
      )}
    </div>,
    document.body,
  ) : null;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', flexShrink: 0 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTip(false)}
    >
      <div style={{
        width: size, height: size, borderRadius: rounded, overflow: 'hidden',
        background: 'var(--bg-dark)', border: '1px solid var(--border-color)',
      }}>
        {src
          ? <img src={src} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(10, size * 0.28), fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {initials || '?'}
            </div>
        }
      </div>
      {tooltip}
    </div>
  );
}
