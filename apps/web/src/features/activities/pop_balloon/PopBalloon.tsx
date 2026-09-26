import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getItem } from '@/content/course';
import { sfx } from '@/engine/audio';
import { createRng, shuffle } from '@/engine/random';
import { ArabicText } from '@/ui/ArabicText';
import { Feedback } from '../Feedback';
import type { ActivityProps } from '../types';

const COLORS = ['#fb7185', '#38bdf8', '#a78bfa', '#4ade80', '#fbbf24', '#fb923c'];

/** A5 Pop the Balloon: balloons float up; pop the ones with the letter you hear. */
export default function PopBalloon({ activity, onDone }: ActivityProps<'pop_balloon'>) {
  const { t } = useTranslation();
  const balloons = useMemo(() => {
    const rng = createRng(activity.id.length * 31);
    const others = activity.options.filter((o) => o !== activity.itemId);
    const list = [...Array.from({ length: activity.goal + 1 }, () => activity.itemId), ...others, ...others].slice(0, 8);
    return shuffle(list, rng).map((itemId, i) => ({ key: i, itemId, color: COLORS[i % COLORS.length]!, delay: (i * 0.9) % 5, lane: i % 4 }));
  }, [activity]);
  const [popped, setPopped] = useState<number[]>([]);
  const [misses, setMisses] = useState(0);
  const [wobble, setWobble] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'tryAgain'>('none');
  const hits = popped.length;
  const done = hits >= activity.goal;

  const tap = (key: number, itemId: string) => {
    if (done || popped.includes(key)) return;
    if (itemId === activity.itemId) {
      sfx('pop');
      const next = [...popped, key];
      setPopped(next);
      if (next.length >= activity.goal) {
        sfx('correct');
        setFeedback('correct');
        window.setTimeout(() => onDone({ correct: misses === 0 }), 900);
      } else setFeedback('none');
    } else {
      sfx('tryAgain');
      setMisses((m) => m + 1);
      setWobble(key);
      setFeedback('tryAgain');
      window.setTimeout(() => setWobble(null), 500);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-center text-lg font-extrabold text-grape-600">{done ? '🎈🎈🎈' : t('act.pop.left', { count: activity.goal - hits })}</div>
      <div className="relative h-[380px] overflow-hidden rounded-blob bg-gradient-to-b from-sky2-100 to-white" data-testid="sky">
        <span className="absolute start-6 top-6 text-4xl opacity-70">☁️</span>
        <span className="absolute end-10 top-16 text-3xl opacity-60">☁️</span>
        {balloons.map((b) =>
          popped.includes(b.key) ? (
            <span key={b.key} className="absolute text-4xl animate-pop-in" style={{ insetInlineStart: `${b.lane * 24 + 3}%`, bottom: 120 }}>
              💥
            </span>
          ) : (
            <button
              key={b.key}
              type="button"
              data-testid={`balloon-${b.itemId}`}
              aria-label={getItem(b.itemId).name.en}
              onClick={() => tap(b.key, b.itemId)}
              className="absolute bottom-0 flex flex-col items-center"
              style={{
                insetInlineStart: `${b.lane * 24 + 3}%`,
                animation: `balloonUp 7s linear ${b.delay}s infinite`,
              }}
            >
              <span
                className={`flex h-[84px] w-[72px] items-center justify-center rounded-[50%] shadow-inner ${wobble === b.key ? 'animate-shake' : ''}`}
                style={{ background: b.color }}
              >
                <ArabicText className="text-5xl leading-none text-white drop-shadow">{getItem(b.itemId).glyph}</ArabicText>
              </span>
              <span className="h-10 w-px bg-ink/30" />
            </button>
          ),
        )}
      </div>
      <Feedback state={feedback} />
    </div>
  );
}
