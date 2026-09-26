import { emptyChildData, nodeStatuses, touchStreak } from './progress';

describe('journey states', () => {
  it('opens only the first lesson for a new child', () => {
    const s = nodeStatuses('ar', emptyChildData());
    expect(s['ar-l1-u1-l1']).toBe('available');
    expect(s['ar-l1-u1-l2']).toBe('locked');
    expect(s['ar-l1-u1-cp']).toBe('locked');
  });

  it('unlocks the next lesson after mastery, and the next unit only after the checkpoint', () => {
    const data = emptyChildData();
    for (const id of ['ar-l1-u1-l1', 'ar-l1-u1-l2', 'ar-l1-u1-l3', 'ar-l1-u1-l4'])
      data.lessons[id] = { status: 'mastered', bestScore: 1, stars: 3, attempts: 1 };
    let s = nodeStatuses('ar', data);
    expect(s['ar-l1-u1-cp']).toBe('available');
    expect(s['ar-l1-u2-l1']).toBe('locked');
    data.lessons['ar-l1-u1-cp'] = { status: 'mastered', bestScore: 1, stars: 3, attempts: 1 };
    s = nodeStatuses('ar', data);
    expect(s['ar-l1-u2-l1']).toBe('available');
  });

  it('honours a parent override unlock', () => {
    const data = emptyChildData();
    data.lessons['ar-l1-u3-l1'] = { status: 'in_progress', bestScore: 0, stars: 0, attempts: 0, unlockedByParent: true };
    expect(nodeStatuses('ar', data)['ar-l1-u3-l1']).toBe('in_progress');
  });
});

describe('streak', () => {
  const base = { current: 3, longest: 5, lastActiveDate: '2026-09-25', freezes: 1 };
  it('continues on the next day', () => {
    expect(touchStreak(base, new Date(2026, 8, 26, 9)).current).toBe(4);
  });
  it('is unchanged on the same day', () => {
    expect(touchStreak(base, new Date(2026, 8, 25, 20))).toEqual(base);
  });
  it('uses a freeze after one missed day', () => {
    const s = touchStreak(base, new Date(2026, 8, 27, 9));
    expect(s.current).toBe(4);
    expect(s.freezes).toBe(0);
  });
  it('restarts after a longer gap', () => {
    expect(touchStreak(base, new Date(2026, 9, 5, 9)).current).toBe(1);
  });
});
