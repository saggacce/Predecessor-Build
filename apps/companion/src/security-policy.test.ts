import { describe, expect, it } from 'vitest';
import {
  isAllowedNavigation,
  isPredecessorWindowName,
  isTrustedPortalUrl,
  resolvePortalUrl,
  sanitizeAdvice,
} from './security-policy.js';

describe('companion security policy', () => {
  it('only accepts the production portal or explicit localhost development URLs', () => {
    expect(isTrustedPortalUrl(new URL('https://riftline.app/academy'))).toBe(true);
    expect(isTrustedPortalUrl(new URL('http://localhost:8080/academy'))).toBe(true);
    expect(isTrustedPortalUrl(new URL('https://evil.example/academy'))).toBe(false);
    expect(isTrustedPortalUrl(new URL('http://riftline.app/academy'))).toBe(false);
  });

  it('normalizes the companion route and limits navigation to its configured origin', () => {
    const portal = resolvePortalUrl(['electron', '.', '--portal-url=http://localhost:8080/anything'], {});
    expect(portal.href).toBe('http://localhost:8080/academy?companion=1');
    expect(isAllowedNavigation('http://localhost:8080/login', portal)).toBe(true);
    expect(isAllowedNavigation('https://riftline.app/academy', portal)).toBe(false);
  });

  it('opens the local staging portal by default in the private 0.1 build', () => {
    expect(resolvePortalUrl(['electron', '.'], {}).href).toBe('http://localhost:8080/academy?companion=1');
  });

  it('matches only Predecessor game windows', () => {
    expect(isPredecessorWindowName('Predecessor')).toBe(true);
    expect(isPredecessorWindowName('PredecessorClient-Win64-Shipping')).toBe(true);
    expect(isPredecessorWindowName('RiftLine Companion - Predecessor')).toBe(false);
  });

  it('sanitizes the narrow advice payload exposed to remote content', () => {
    expect(sanitizeAdvice({ title: 'Compra', cue: 'Vuelve a base', reason: 'Tienes suficiente oro.', principle: 'Convierte el oro antes del objetivo.', priority: 'HIGH', durationMs: 99_000 })).toEqual({
      title: 'Compra', cue: 'Vuelve a base', reason: 'Tienes suficiente oro.', principle: 'Convierte el oro antes del objetivo.', priority: 'HIGH', durationMs: 15_000,
    });
    expect(sanitizeAdvice({ title: 'incompleto' })).toBeNull();
  });
});
