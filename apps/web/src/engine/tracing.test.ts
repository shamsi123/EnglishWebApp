import { densify, scoreTrace, type Mask } from './tracing';

/** 20x20 mask with a vertical bar at x = 9..10, y = 2..17 (like an alif). */
function barMask(): Mask {
  const width = 20;
  const height = 20;
  const data = new Array<boolean>(width * height).fill(false);
  for (let y = 2; y <= 17; y++) for (let x = 9; x <= 10; x++) data[y * width + x] = true;
  return { width, height, data };
}

describe('tracing scorer', () => {
  it('scores a faithful trace highly', () => {
    const s = scoreTrace(barMask(), [[{ x: 9.5, y: 2 }, { x: 9.5, y: 17 }]]);
    expect(s.coverage).toBeGreaterThan(0.95);
    expect(s.precision).toBeGreaterThan(0.95);
    expect(s.accuracy).toBeGreaterThanOrEqual(0.9);
  });

  it('scores a half trace below the 0.7 threshold', () => {
    const s = scoreTrace(barMask(), [[{ x: 9.5, y: 2 }, { x: 9.5, y: 7 }]]);
    expect(s.accuracy).toBeLessThan(0.7);
  });

  it('penalises scribbles far from the letter', () => {
    const s = scoreTrace(barMask(), [[{ x: 9.5, y: 2 }, { x: 9.5, y: 17 }], [{ x: 0, y: 0 }, { x: 0, y: 19 }, { x: 19, y: 19 }]]);
    expect(s.precision).toBeLessThan(0.6);
  });

  it('returns zero for no ink', () => {
    expect(scoreTrace(barMask(), []).accuracy).toBe(0);
  });

  it('densifies fast strokes', () => {
    expect(densify([{ x: 0, y: 0 }, { x: 10, y: 0 }]).length).toBeGreaterThanOrEqual(10);
  });
});
