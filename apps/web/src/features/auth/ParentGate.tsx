import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

const HOLD_MS = 3000;
const GATE_TTL_MS = 5 * 60 * 1000;
let passedAt = 0;

export const gatePassed = () => Date.now() - passedAt < GATE_TTL_MS;
export const resetGate = () => {
  passedAt = 0;
};

function makeQuestion() {
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);
  const answer = a * b;
  const wrong = new Set<number>();
  while (wrong.size < 2) {
    const w = answer + (Math.floor(Math.random() * 9) - 4) * (Math.random() < 0.5 ? 1 : b);
    if (w !== answer && w > 0) wrong.add(w);
  }
  const choices = [answer, ...wrong].sort((x, y) => x - y);
  return { a, b, answer, choices };
}

/**
 * Parent gate (FR-04): hold for 3 seconds, then solve a multiplication. Protects settings,
 * the parent dashboard, purchases and external links. Passing it lasts 5 minutes.
 */
export function ParentGate({ children, onCancel }: { children: ReactNode; onCancel: () => void }) {
  const { t } = useTranslation();
  const [passed, setPassed] = useState(gatePassed());
  const [held, setHeld] = useState(false);
  const [progress, setProgress] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [q, setQ] = useState(makeQuestion);
  const timer = useRef<number | null>(null);
  const start = useRef(0);

  const stop = () => {
    if (timer.current) cancelAnimationFrame(timer.current);
    timer.current = null;
    if (!held) setProgress(0);
  };
  const tick = () => {
    const p = Math.min((Date.now() - start.current) / HOLD_MS, 1);
    setProgress(p);
    if (p >= 1) {
      setHeld(true);
      timer.current = null;
    } else timer.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const ring = useMemo(() => `conic-gradient(#7c3aed ${progress * 360}deg, #ede9fe 0deg)`, [progress]);

  if (passed) return <>{children}</>;

  return (
    <Screen title={t('gate.title')} back={onCancel} bg="bg-grape-50">
      <div className="flex flex-col items-center gap-8 pt-10">
        <div className="text-6xl">🔒</div>
        {!held ? (
          <>
            <p className="text-center text-xl font-bold">{t('gate.hold')}</p>
            <button
              type="button"
              aria-label={t('gate.hold')}
              onPointerDown={() => {
                start.current = Date.now();
                timer.current = requestAnimationFrame(tick);
              }}
              onPointerUp={stop}
              onPointerLeave={stop}
              onContextMenu={(e) => e.preventDefault()}
              className="flex h-40 w-40 items-center justify-center rounded-full p-2"
              style={{ background: ring }}
            >
              <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-5xl">✋</span>
            </button>
            <p className="h-6 text-grape-600">{progress > 0 ? t('gate.holding') : ''}</p>
          </>
        ) : (
          <>
            <p className="text-center text-2xl font-extrabold">{t('gate.question', { a: q.a, b: q.b })}</p>
            <div className="grid w-full grid-cols-3 gap-3">
              {q.choices.map((c) => (
                <Button
                  key={c}
                  variant="secondary"
                  onClick={() => {
                    if (c === q.answer) {
                      passedAt = Date.now();
                      setPassed(true);
                    } else {
                      setWrong(true);
                      setQ(makeQuestion());
                    }
                  }}
                >
                  {c}
                </Button>
              ))}
            </div>
            {wrong && <p className="text-coral-500 font-bold">{t('gate.wrong')}</p>}
          </>
        )}
      </div>
    </Screen>
  );
}
