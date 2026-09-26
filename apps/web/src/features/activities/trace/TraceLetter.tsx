import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getItem } from '@/content/course';
import { sfx, speak } from '@/engine/audio';
import { scoreTrace, type Mask, type Point } from '@/engine/tracing';
import { Button } from '@/ui/Button';
import { Feedback, type FeedbackState } from '../Feedback';
import type { ActivityProps } from '../types';

const SIZE = 300; // CSS px of the drawing square
const GRID = 60; // scoring grid resolution
const FONT = (px: number) => `700 ${px}px "Baloo Bhaijaan 2", "Noto Naskh Arabic", serif`;
const GLYPH_SCALE = 0.62;

/** Renders the glyph into a GRID×GRID boolean mask using the same font as the guide. */
export function glyphMask(glyph: string): Mask {
  const c = document.createElement('canvas');
  c.width = GRID;
  c.height = GRID;
  const g = c.getContext('2d');
  const data = new Array<boolean>(GRID * GRID).fill(false);
  if (!g) return { width: GRID, height: GRID, data };
  g.font = FONT(GRID * GLYPH_SCALE);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.direction = 'rtl';
  g.fillText(glyph, GRID / 2, GRID / 2);
  const px = g.getImageData(0, 0, GRID, GRID).data;
  for (let i = 0; i < GRID * GRID; i++) data[i] = (px[i * 4 + 3] ?? 0) > 110;
  return { width: GRID, height: GRID, data };
}

/** A2 Trace the Letter: follow the letter with a finger; coverage + stray ink are scored. */
export default function TraceLetter({ activity, onDone }: ActivityProps<'trace'>) {
  const { t } = useTranslation();
  const item = getItem(activity.itemId);
  const guideRef = useRef<HTMLCanvasElement>(null);
  const inkRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [tries, setTries] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const [finished, setFinished] = useState(false);

  const drawGuide = useCallback(() => {
    const c = guideRef.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = SIZE * dpr;
    c.height = SIZE * dpr;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, SIZE, SIZE);
    g.font = FONT(SIZE * GLYPH_SCALE);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.fillStyle = '#ede9fe';
    g.fillText(item.glyph, SIZE / 2, SIZE / 2);
    g.setLineDash([6, 8]);
    g.lineWidth = 3;
    g.strokeStyle = '#a78bfa';
    g.strokeText(item.glyph, SIZE / 2, SIZE / 2);
  }, [item.glyph]);

  useEffect(() => {
    drawGuide();
    void document.fonts?.load(FONT(40), item.glyph).then(drawGuide);
    const c = inkRef.current;
    if (c) {
      const dpr = window.devicePixelRatio || 1;
      c.width = SIZE * dpr;
      c.height = SIZE * dpr;
      c.getContext('2d')?.scale(dpr, dpr);
    }
  }, [drawGuide, item.glyph]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIZE, y: ((e.clientY - r.top) / r.height) * SIZE };
  };

  const line = (a: Point, b: Point) => {
    const g = inkRef.current?.getContext('2d');
    if (!g) return;
    g.strokeStyle = '#7c3aed';
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  };

  const clear = () => {
    strokes.current = [];
    setHasInk(false);
    const g = inkRef.current?.getContext('2d');
    g?.clearRect(0, 0, SIZE, SIZE);
  };

  const check = () => {
    const scale = GRID / SIZE;
    const gridStrokes = strokes.current.map((s) => s.map((p) => ({ x: p.x * scale, y: p.y * scale })));
    const { accuracy } = scoreTrace(glyphMask(item.glyph), gridStrokes, 2);
    const pass = accuracy >= activity.minAccuracy;
    const n = tries + 1;
    setTries(n);
    if (pass || activity.phase === 'check' || n >= 3) {
      if (pass) sfx('correct');
      setFeedback(pass ? 'correct' : 'none');
      setFinished(true);
      if (pass) speak(t('act.trace.good'));
      window.setTimeout(() => onDone({ correct: pass, score: accuracy }), 900);
    } else {
      sfx('tryAgain');
      setFeedback('tryAgain');
      speak(t('act.trace.again'));
      clear();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 pt-2">
      <div data-trace-glyph={item.glyph} className="relative rounded-blob bg-white shadow-[0_8px_0_#ddd6fe]" style={{ width: SIZE, height: SIZE }}>
        <canvas ref={guideRef} className="absolute inset-0 h-full w-full" aria-hidden />
        <canvas
          ref={inkRef}
          data-testid="trace-canvas"
          aria-label={t('act.trace.prompt')}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={(e) => {
            if (finished) return;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            drawing.current = true;
            const p = pos(e);
            strokes.current.push([p]);
            line(p, p);
            setHasInk(true);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const s = strokes.current.at(-1);
            const p = pos(e);
            const prev = s?.at(-1);
            if (s && prev) {
              s.push(p);
              line(prev, p);
            }
          }}
          onPointerUp={() => (drawing.current = false)}
          onPointerCancel={() => (drawing.current = false)}
        />
      </div>
      <div className="flex w-full gap-3">
        <Button variant="secondary" className="flex-1 px-3 text-lg" onClick={clear} disabled={!hasInk || finished}>
          🔄 {t('act.trace.clear')}
        </Button>
        <Button variant="success" className="flex-1 px-3 text-lg" onClick={check} disabled={!hasInk || finished}>
          ✅ {t('act.trace.check')}
        </Button>
      </div>
      <Feedback state={feedback} />
    </div>
  );
}
