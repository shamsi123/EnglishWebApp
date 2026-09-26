import fixtures from '@content/fixtures/mastery-cases.json';
import { evaluateMastery, starsForScore } from './mastery';

describe('mastery gate (shared fixtures with KidsLang.Domain)', () => {
  it.each(fixtures.cases)('$name', (c) => {
    const result = evaluateMastery({ newItems: c.newItems, config: c.config, results: c.results, traceAccuracy: c.traceAccuracy });
    expect(result.mastered).toBe(c.expected.mastered);
    expect(result.score).toBeCloseTo(c.expected.score, 4);
    expect(result.stars).toBe(c.expected.stars);
    expect(result.missedItems).toEqual(c.expected.missedItems);
  });

  it('maps score bands to stars', () => {
    expect(starsForScore(0.79)).toBe(0);
    expect(starsForScore(0.8)).toBe(1);
    expect(starsForScore(0.89)).toBe(1);
    expect(starsForScore(0.9)).toBe(2);
    expect(starsForScore(0.99)).toBe(2);
    expect(starsForScore(1)).toBe(3);
  });
});
