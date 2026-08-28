import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ completionCreate: vi.fn() }));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mocks.completionCreate } };
  },
}));
vi.mock('../db.js', () => ({
  db: {
    matchPlayer: { findMany: vi.fn() },
    syncLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock('./player-coach-knowledge-service.js', () => ({
  getPlayerCoachKnowledge: vi.fn().mockResolvedValue([{
    id: 'K1', kind: 'fundamental', label: 'Visión e información', value: 'Un ward debe habilitar una decisión.',
    source: 'Currículo RiftLine revisado · fundamentos MOBA v1', patch: null,
  }]),
}));
vi.mock('./llm-service.js', () => ({
  getLlmConfig: vi.fn().mockResolvedValue({ enabled: true, apiKey: 'key', baseUrl: 'https://llm.test', model: 'test-model', maxTokens: 400 }),
}));
vi.mock('./player-match-enrichment-service.js', () => ({
  getPlayerMatchEnrichmentCoverage: vi.fn().mockResolvedValue({ windowDays: 30, totalMatches: 8, fullyEnriched: 8, coveragePercent: 100, failed: 0 }),
}));
vi.mock('./player-weekly-report-service.js', () => ({
  generatePlayerWeeklyReport: vi.fn().mockResolvedValue({
    roleCoach: { label: 'Support', matches: 4, confidence: 'medium', metrics: [{ label: 'Participación', value: 35, baseline: 40 }] },
    focusOfWeek: { title: 'Aumenta impacto', rationale: 'Participación por debajo de referencia.', action: 'Prioriza peleas de objetivo.' },
    championPool: { currentPatch: '1.16.1', mainHero: 'dekker', alternativeHero: 'muriel', heroes: [{ heroSlug: 'dekker', matches30d: 4, winRate30d: 50, trend: 'stable' }] },
  }),
}));
vi.mock('./weekly-goal-evaluation-service.js', () => ({
  evaluateWeeklyGoals: vi.fn().mockResolvedValue([]),
}));

import { db } from '../db.js';
import { getLlmConfig } from './llm-service.js';
import { getPlayerCoachKnowledge } from './player-coach-knowledge-service.js';
import { answerPlayerCoachQuestion } from './player-coach-chat-service.js';

describe('player coach chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLlmConfig).mockResolvedValue({ enabled: true, apiKey: 'key', baseUrl: 'https://llm.test', model: 'test-model', maxTokens: 400 });
    (db.matchPlayer.findMany as any).mockResolvedValue([{
      heroSlug: 'dekker', role: 'SUPPORT', team: 'DAWN', kills: 1, deaths: 3, assists: 8,
      heroDamage: 8_000, gold: 9_000, wardsPlaced: 10, laneMinionsKilled: 50,
      match: { predggUuid: 'match-1', startTime: new Date(), winningTeam: 'DAWN', duration: 1_800 },
    }]);
    mocks.completionCreate.mockResolvedValue({ choices: [{ message: { content: 'Prioriza estar presente en objetivos [E2] y usa la visión para decidir [K1].' } }] });
  });

  it('returns only evidence cited by the model and exposes sample coverage', async () => {
    const response = await answerPlayerCoachQuestion('player-1', 'user-1', '¿Qué debo mejorar?');

    expect(response.answer).toContain('[E2]');
    expect(response.evidence.map((item) => item.id)).toEqual(['E2']);
    expect(response.knowledge.map((item) => item.id)).toEqual(['K1']);
    expect(response.coverage).toEqual({ complete: 8, total: 8, percent: 100 });
    expect(mocks.completionCreate).toHaveBeenCalledWith(expect.objectContaining({ temperature: 0.2 }));
    expect(getPlayerCoachKnowledge).toHaveBeenCalledWith('¿Qué debo mejorar?', expect.any(Array));
    const request = mocks.completionCreate.mock.calls[0][0];
    const context = JSON.parse(request.messages.at(-1).content);
    expect(context.matchEvidence[0].id).toBe('E1');
    expect(context.gameKnowledge[0].id).toBe('K1');
  });

  it('fails clearly without an enabled provider instead of fabricating an answer', async () => {
    vi.mocked(getLlmConfig).mockResolvedValue({ enabled: false, apiKey: '', baseUrl: '', model: 'none', maxTokens: 400 });

    await expect(answerPlayerCoachQuestion('player-1', 'user-1', '¿Qué debo mejorar?'))
      .rejects.toMatchObject({ status: 503, code: 'LLM_DISABLED' });
    expect(mocks.completionCreate).not.toHaveBeenCalled();
  });
});
