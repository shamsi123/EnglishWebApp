/**
 * Tracing scorer (FR-16). Pure: works on a boolean glyph mask and the child's stroke points,
 * both on the same grid. Accuracy is coverage (how much of the letter was traced), scaled down
 * by stray ink (precision: how much of the ink stayed on the letter).
 */
export interface Point {
  x: number;
  y: number;
}

export interface Mask {
  width: number;
  height: number;
  /** row-major, true where the glyph is */
  data: boolean[];
}

export interface TraceScore {
  coverage: number;
  precision: number;
  accuracy: number;
}

export function dilate(mask: Mask, radius: number): Mask {
  const { width, height, data } = mask;
  const out = new Array<boolean>(width * height).fill(false);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!data[y * width + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && dx * dx + dy * dy <= radius * radius) {
            out[ny * width + nx] = true;
          }
        }
      }
    }
  }
  return { width, height, data: out };
}

/** Interpolates consecutive stroke points so fast finger moves still paint a continuous line. */
export function densify(stroke: Point[], step = 1): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < stroke.length; i++) {
    const p = stroke[i]!;
    const prev = stroke[i - 1];
    if (prev) {
      const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
      const n = Math.floor(dist / step);
      for (let k = 1; k < n; k++) {
        out.push({ x: prev.x + ((p.x - prev.x) * k) / n, y: prev.y + ((p.y - prev.y) * k) / n });
      }
    }
    out.push(p);
  }
  return out;
}

export function scoreTrace(glyph: Mask, strokes: Point[][], tolerance = 2): TraceScore {
  const { width, height } = glyph;
  const glyphCells = glyph.data.filter(Boolean).length;
  if (glyphCells === 0) return { coverage: 0, precision: 0, accuracy: 0 };

  const ink = new Array<boolean>(width * height).fill(false);
  for (const stroke of strokes) {
    for (const p of densify(stroke)) {
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (x >= 0 && y >= 0 && x < width && y < height) ink[y * width + x] = true;
    }
  }
  const inkCells = ink.filter(Boolean).length;
  if (inkCells === 0) return { coverage: 0, precision: 0, accuracy: 0 };

  const nearGlyph = dilate(glyph, tolerance);
  const nearInk = dilate({ width, height, data: ink }, tolerance + 1);

  let covered = 0;
  let onGlyph = 0;
  for (let i = 0; i < width * height; i++) {
    if (glyph.data[i] && nearInk.data[i]) covered++;
    if (ink[i] && nearGlyph.data[i]) onGlyph++;
  }
  const coverage = covered / glyphCells;
  const precision = onGlyph / inkCells;
  // Coverage is the main signal; stray ink scales it down (a full scribble cannot pass).
  const accuracy = Math.round(coverage * (0.5 + 0.5 * precision) * 100) / 100;
  return { coverage, precision, accuracy };
}
