import fixtures from '@content/fixtures/leitner-cases.json';
import { dueItems, isWeak, LEITNER_INTERVALS_DAYS, review } from './leitner';

describe('Leitner scheduler (shared fixtures with KidsLang.Domain)', () => {
  it('uses the BRD intervals', () => {
    expect([...LEITNER_INTERVALS_DAYS]).toEqual(fixtures.intervalsDays);
  });

  it.each(fixtures.cases)('$name', (c) => {
    const entry =
      c.box === null
        ? undefined
        : { box: c.box, correctCount: 0, wrongCount: 0, nextReviewAt: c.previousNextReviewAt ?? c.now, lastReviewedAt: c.lastReviewedAt };
    const out = review(entry, c.correct, new Date(c.now));
    expect(out.box).toBe(c.expected.box);
    expect(out.nextReviewAt).toBe(new Date(c.expected.nextReviewAt).toISOString());
  });

  it('lists due items, lowest box first', () => {
    const now = new Date('2026-09-26T10:00:00Z');
    const items = {
      a: { box: 3, correctCount: 3, wrongCount: 0, nextReviewAt: '2026-09-25T00:00:00Z' },
      b: { box: 1, correctCount: 0, wrongCount: 1, nextReviewAt: '2026-09-26T09:00:00Z' },
      c: { box: 2, correctCount: 1, wrongCount: 0, nextReviewAt: '2026-09-30T00:00:00Z' },
    };
    expect(dueItems(items, now)).toEqual(['b', 'a']);
  });

  it('flags weak items', () => {
    expect(isWeak({ box: 1, correctCount: 1, wrongCount: 3, nextReviewAt: '' })).toBe(true);
    expect(isWeak({ box: 3, correctCount: 5, wrongCount: 2, nextReviewAt: '' })).toBe(false);
  });
});
