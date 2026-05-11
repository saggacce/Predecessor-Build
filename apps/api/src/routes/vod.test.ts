import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { vodRouter } from './vod.js';
import { errorHandler } from '../middleware/error-handler.js';
import { authCookie } from '../test/auth-cookie.js';

vi.mock('../db.js', () => ({
  db: {
    vodLink: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    match: {
      findMany: vi.fn(),
    },
  },
  disconnectDb: vi.fn().mockResolvedValue(undefined),
}));

import { db } from '../db.js';

const mockVodLink = (db as any).vodLink;
const mockMatch = (db as any).match;

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/vod', vodRouter);
app.use(errorHandler);

function vodRecord(overrides = {}) {
  return {
    id: 'vod-1',
    teamId: 'team-1',
    matchId: 'match-1',
    playerId: null,
    type: 'full_match',
    url: 'https://www.youtube.com/watch?v=abc123',
    gameTimeStart: 120,
    gameTimeEnd: null,
    videoTimestampStart: 90,
    videoTimestampEnd: null,
    tags: ['scrim'],
    notes: 'Opening review',
    visibility: 'staff',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVodLink.create.mockResolvedValue(vodRecord());
  mockVodLink.findMany.mockResolvedValue([vodRecord()]);
  mockVodLink.findUnique.mockResolvedValue({ teamId: 'team-1' });
  mockVodLink.update.mockResolvedValue(vodRecord({ notes: 'Updated' }));
  mockVodLink.delete.mockResolvedValue(vodRecord());
  mockMatch.findMany.mockResolvedValue([
    { id: 'match-1', startTime: new Date('2026-01-01T20:00:00.000Z'), gameMode: 'ranked', winningTeam: 'dawn' },
  ]);
});

describe('GET /vod', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/vod?teamId=team-1');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 403 for users without a staff role on the team', async () => {
    const cookie = await authCookie({
      memberships: [{ teamId: 'team-1', role: 'JUGADOR', playerId: 'player-1' }],
    });

    const res = await request(app).get('/vod?teamId=team-1').set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lists VOD links with match metadata for staff users', async () => {
    const cookie = await authCookie({
      memberships: [{ teamId: 'team-1', role: 'COACH', playerId: null }],
    });

    const res = await request(app).get('/vod?teamId=team-1').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.vods[0]).toEqual(expect.objectContaining({
      id: 'vod-1',
      teamId: 'team-1',
      match: expect.objectContaining({ id: 'match-1' }),
    }));
  });
});

describe('POST /vod', () => {
  it('creates a VOD link for a staff user', async () => {
    const cookie = await authCookie({
      memberships: [{ teamId: 'team-1', role: 'ANALISTA', playerId: null }],
    });

    const res = await request(app)
      .post('/vod')
      .set('Cookie', cookie)
      .send({
        teamId: 'team-1',
        matchId: 'match-1',
        type: 'clip',
        url: 'https://www.youtube.com/watch?v=abc123',
        videoTimestampStart: 42,
        tags: ['macro'],
      });

    expect(res.status).toBe(201);
    expect(mockVodLink.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        teamId: 'team-1',
        matchId: 'match-1',
        type: 'clip',
      }),
    }));
  });
});

describe('PATCH /vod/:id', () => {
  it('updates a VOD link after resolving its team', async () => {
    const cookie = await authCookie();

    const res = await request(app)
      .patch('/vod/vod-1')
      .set('Cookie', cookie)
      .send({ notes: 'Updated' });

    expect(res.status).toBe(200);
    expect(mockVodLink.findUnique).toHaveBeenCalledWith({
      where: { id: 'vod-1' },
      select: { teamId: true },
    });
    expect(mockVodLink.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'vod-1' },
      data: expect.objectContaining({ notes: 'Updated' }),
    }));
  });
});

describe('DELETE /vod/:id', () => {
  it('deletes a VOD link after resolving its team', async () => {
    const cookie = await authCookie();

    const res = await request(app).delete('/vod/vod-1').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockVodLink.delete).toHaveBeenCalledWith({ where: { id: 'vod-1' } });
  });
});
