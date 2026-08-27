import { describe, expect, it } from 'vitest';
import { COMPETENCIES, LEARNING_QUESTIONS, MISSION_TEMPLATES } from './player-learning-catalog.js';
import { recommendMission, selectPlacementQuestions } from './player-learning-service.js';

describe('adaptive learning catalog', () => {
  it('provides a ten-situation placement test without exposing the scoring rubric', () => {
    const questions = selectPlacementQuestions('SUPPORT');
    expect(questions).toHaveLength(10);
    expect(questions.some((question) => question.roles?.includes('SUPPORT'))).toBe(true);
    expect(new Set(questions.map((question) => question.competencyKey))).toEqual(new Set(COMPETENCIES.map((item) => item.key)));
    expect(questions[0].options[0]).not.toHaveProperty('score');
    expect(questions[0].options[0]).not.toHaveProperty('evaluation');
  });

  it('does not reveal the best answer through a fixed position or noticeably longer copy', () => {
    const questions = selectPlacementQuestions('SUPPORT');
    const adequatePositions = questions.map((question) => {
      const source = LEARNING_QUESTIONS.find((item) => item.key === question.key)!;
      const adequateId = source.options.find((option) => option.evaluation === 'ADEQUATE')!.id;
      return question.options.findIndex((option) => option.id === adequateId);
    });
    expect(new Set(adequatePositions).size).toBeGreaterThanOrEqual(3);
    for (const question of LEARNING_QUESTIONS) {
      const lengths = question.options.filter((option) => option.id !== 'not_sure').map((option) => option.text.length);
      expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(20);
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
