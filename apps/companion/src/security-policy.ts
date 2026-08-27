const PRODUCTION_ORIGIN = 'https://riftline.app';

export function resolvePortalUrl(argv: string[], environment: NodeJS.ProcessEnv): URL {
  const argument = argv.find((value) => value.startsWith('--portal-url='));
  const candidate = argument?.slice('--portal-url='.length)
    ?? environment.RIFTLINE_COMPANION_URL
    ?? `${PRODUCTION_ORIGIN}/academy?companion=1`;
  const url = new URL(candidate);
  if (!isTrustedPortalUrl(url)) {
    throw new Error('RiftLine Companion sólo acepta https://riftline.app o un servidor local explícito.');
  }
  url.pathname = '/academy';
  url.searchParams.set('companion', '1');
  return url;
}

export function isTrustedPortalUrl(url: URL): boolean {
  if (url.origin === PRODUCTION_ORIGIN) return true;
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}

export function isAllowedNavigation(target: string, portal: URL): boolean {
  try {
    return new URL(target).origin === portal.origin;
  } catch {
    return false;
  }
}

export function isPredecessorWindowName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized.includes('predecessor') && !normalized.includes('riftline companion');
}

export function sanitizeAdvice(input: unknown): {
  title: string;
  cue: string;
  reason: string;
  principle: string;
  priority: 'NORMAL' | 'HIGH';
  durationMs: number;
} | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const clean = (field: string, maximum: number) => typeof value[field] === 'string'
    ? String(value[field]).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maximum)
    : '';
  const title = clean('title', 120);
  const cue = clean('cue', 280);
  const reason = clean('reason', 600);
  const principle = clean('principle', 600);
  if (!title || !cue || !reason || !principle) return null;
  const requestedDuration = typeof value.durationMs === 'number' ? value.durationMs : 8_000;
  return {
    title,
    cue,
    reason,
    principle,
    priority: value.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
    durationMs: Math.max(4_000, Math.min(15_000, Math.round(requestedDuration))),
  };
}
