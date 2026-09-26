import { findNode, journeyNodes } from '@/content/course';
import { buildHelpLoop, buildLesson, generateQuiz } from './buildLesson';

const lesson = findNode('ar-l1-u1-l2')!;

describe('lesson builder', () => {
  it('builds Learn and Play activities for a lesson', () => {
    const built = buildLesson(lesson);
    expect(built.learn.map((a) => a.type)).toEqual(['learn_card', 'trace']);
    expect(built.play.map((a) => a.type)).toEqual(['listen_tap', 'match_pairs', 'drag_drop', 'pop_balloon', 'find_letter']);
    for (const a of built.play) if ('options' in a) expect(a.options).toContain('ar-letter-ba');
  });

  it('builds activities for every node in the course without schema errors', () => {
    for (const node of journeyNodes('ar')) {
      expect(() => buildLesson(node)).not.toThrow();
      expect(() => generateQuiz(node, 3)).not.toThrow();
    }
  });
});

describe('quiz generator', () => {
  it('includes every new item, mixes in review items, and ends with tracing', () => {
    const quiz = generateQuiz(lesson, 7);
    expect(quiz).toHaveLength(6);
    expect(quiz.some((q) => q.itemId === 'ar-letter-ba')).toBe(true);
    expect(quiz.some((q) => q.itemId === 'ar-letter-alif')).toBe(true);
    expect(quiz.at(-1)!.type).toBe('trace');
    quiz.filter((q) => q.type === 'listen_tap').forEach((q) => q.type === 'listen_tap' && expect(q.hints).toBe(false));
  });

  it('regenerates a different mix with a new seed', () => {
    const a = JSON.stringify(generateQuiz(lesson, 1));
    const b = JSON.stringify(generateQuiz(lesson, 2));
    expect(a).not.toEqual(b);
  });

  it('checkpoints cover the unit items with the configured size and no tracing', () => {
    const cp = findNode('ar-l1-u1-cp')!;
    const quiz = generateQuiz(cp, 1);
    expect(quiz).toHaveLength(6);
    expect(quiz.every((q) => q.type !== 'trace')).toBe(true);
  });

  it('help loop re-teaches missed items first', () => {
    const help = buildHelpLoop(lesson, ['ar-letter-ba'], 1);
    expect(help[0]!.type).toBe('learn_card');
    expect(help.length).toBeGreaterThanOrEqual(3);
  });
});
