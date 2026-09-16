import { describe, expect, it } from 'vitest';
import { COMPETENCIES, LEARNING_QUESTIONS, MISSION_TEMPLATES } from './player-learning-catalog.js';
import { recommendMission, selectPlacementQuestions, summarizePlacement } from './player-learning-service.js';
import { PLACEMENT_GENERAL_COUNT, PLACEMENT_QUESTION_COUNT, PLACEMENT_ROLE_COUNT } from './player-placement-catalog.js';

describe('adaptive learning catalog', () => {
  it('provides twenty situations with stable general and role coverage without exposing scores', () => {
    const questions = selectPlacementQuestions('SUPPORT');
    expect(questions).toHaveLength(PLACEMENT_QUESTION_COUNT);
    expect(questions.filter((question) => !question.roles?.length)).toHaveLength(PLACEMENT_GENERAL_COUNT);
    expect(questions.filter((question) => question.roles?.includes('SUPPORT'))).toHaveLength(PLACEMENT_ROLE_COUNT);
    expect(new Set(questions.map((question) => question.competencyKey))).toEqual(new Set(COMPETENCIES.map((item) => item.key)));
    expect(questions[0].options[0]).not.toHaveProperty('score');
    expect(questions[0].options[0]).not.toHaveProperty('evaluation');
  });

  it('builds a complete and distinct questionnaire for every role', () => {
    for (const role of ['SUPPORT', 'CARRY', 'JUNGLE', 'MIDLANE', 'OFFLANE']) {
      const questions = selectPlacementQuestions(role);
      expect(questions).toHaveLength(PLACEMENT_QUESTION_COUNT);
      expect(questions.filter((question) => question.roles?.includes(role))).toHaveLength(PLACEMENT_ROLE_COUNT);
      expect(questions.every((question) => question.key.startsWith('placement-v3-'))).toBe(true);
    }
  });

  it('does not reveal the best answer through a fixed position or noticeably longer copy', () => {
    const adequatePositions = new Set<number>();
    let adequateLongest = 0;
    const selectedQuestions = [...new Map(
      ['SUPPORT', 'CARRY', 'JUNGLE', 'MIDLANE', 'OFFLANE']
        .flatMap((role) => selectPlacementQuestions(role))
        .map((question) => [question.key, question]),
    ).values()];
    for (const question of selectedQuestions) {
      const lengths = question.options.filter((option) => option.id !== 'not_sure').map((option) => option.text.length);
      expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(28);
      expect(question.options.filter((option) => option.id !== 'not_sure').map((option) => option.text.toLowerCase()).join(' ')).not.toMatch(/\b(siempre|nunca|obligatorio|garantiza|cualquier)\b/);
      const source = LEARNING_QUESTIONS.find((item) => item.key === question.key)!;
      const adequateId = source.options.find((option) => option.evaluation === 'ADEQUATE')!.id;
      adequatePositions.add(question.options.findIndex((option) => option.id === adequateId));
      const adequateLength = source.options.find((option) => option.id === adequateId)!.text.length;
      if (adequateLength === Math.max(...lengths)) adequateLongest += 1;
    }
    expect(adequatePositions).toEqual(new Set([0, 1, 2]));
    expect(adequateLongest / selectedQuestions.length).toBeLessThan(0.75);
  });

  it('uses foundation and role gates instead of a raw average alone', () => {
    const questions = selectPlacementQuestions('JUNGLE');
    const attempts = questions.map((question) => ({
      questionKey: question.key,
      competencyKey: question.competencyKey,
      score: question.level === 1 ? 0.2 : 1,
    }));
    const summary = summarizePlacement(attempts, 'JUNGLE');
    expect(summary?.band.key).not.toBe('ADVANCED_KNOWLEDGE');
    expect(summary?.answered).toBe(PLACEMENT_QUESTION_COUNT);
  });

  it('separates novice, intermediate and advanced knowledge profiles for every role', () => {
    for (const role of ['SUPPORT', 'CARRY', 'JUNGLE', 'MIDLANE', 'OFFLANE']) {
      const questions = selectPlacementQuestions(role);
      const attemptsAt = (score: number) => questions.map((question) => ({
        questionKey: question.key,
        competencyKey: question.competencyKey,
        score,
      }));
      expect(summarizePlacement(attemptsAt(0), role)?.band.key).toBe('STARTING');
      expect(summarizePlacement(attemptsAt(0.72), role)?.band.key).toBe('INTERMEDIATE_KNOWLEDGE');
      expect(summarizePlacement(attemptsAt(1), role)?.band.key).toBe('ADVANCED_KNOWLEDGE');
      expect(summarizePlacement(attemptsAt(1).slice(0, -1), role)).toBeNull();
    }
  });

  it('covers every competency with questions and a mission', () => {
    for (const competency of COMPETENCIES) {
      expect(LEARNING_QUESTIONS.some((question) => question.competencyKey === competency.key)).toBe(true);
      expect(MISSION_TEMPLATES.some((mission) => mission.competencyKey === competency.key)).toBe(true);
    }
  });

  it('recommends practice for the weakest competency', () => {
    const mission = recommendMission(COMPETENCIES.map((item, index) => ({ competencyKey: item.key, mastery: index === 3 ? 0.1 : 0.8, level: 1 })));
    expect(mission.competencyKey).toBe(COMPETENCIES[3].key);
  });
});
