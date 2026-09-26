import { useMemo, useState } from 'react';
import { getItem } from '@/content/course';
import { sfx, speak } from '@/engine/audio';
import { createRng, shuffle } from '@/engine/random';
import { ArabicText } from '@/ui/ArabicText';
import { Feedback, type FeedbackState } from '../Feedback';
import type { ActivityProps } from '../types';

type Pick = { side: 'letter' | 'picture'; id: string } | null;

/** A3 Match Pairs: tap a letter, then the picture whose word starts with it (or the other way round). */
export default function MatchPairs({ activity, onDone }: ActivityProps<'match_pairs'>) {
  const pictures = useMemo(() => shuffle(activity.pairs, createRng(activity.pairs.join('').length)), [activity.pairs]);
  const [pick, setPick] = useState<Pick>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const [shake, setShake] = useState<string | null>(null);

  const choose = (side: 'letter' | 'picture', id: string) => {
    if (matched.includes(id)) return;
    const item = getItem(id);
    speak(side === 'letter' ? item.name.ar : item.example.word, 'ar');
    if (!pick || pick.side === side) {
      setPick({ side, id });
      return;
    }
    if (pick.id === id) {
      const next = [...matched, id];
      setMatched(next);
      setPick(null);
      sfx('correct');
      setFeedback(next.length === activity.pairs.length ? 'correct' : 'none');
      if (next.length === activity.pairs.length) window.setTimeout(() => onDone({ correct: misses === 0 }), 900);
    } else {
      sfx('tryAgain');
      setMisses((m) => m + 1);
      setShake(`${side}-${id}`);
      window.setTimeout(() => setShake(null), 400);
      setFeedback('tryAgain');
      setPick(null);
    }
  };

  const cls = (side: 'letter' | 'picture', id: string) => {
    if (matched.includes(id)) return 'bg-leaf-100 ring-4 ring-leaf-400 opacity-80';
    if (pick?.side === side && pick.id === id) return 'bg-grape-100 ring-4 ring-grape-500 -translate-y-1';
    return 'bg-white shadow-[0_6px_0_#ddd6fe]';
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4" dir="rtl">
        <div className="flex flex-col gap-4">
          {activity.pairs.map((id) => (
            <button
              key={id}
              type="button"
              data-testid={`letter-${id}`}
              aria-label={getItem(id).name.en}
              onClick={() => choose('letter', id)}
              className={`flex h-24 items-center justify-center rounded-blob transition-all ${cls('letter', id)} ${shake === `letter-${id}` ? 'animate-shake' : ''}`}
            >
              <ArabicText className="text-6xl leading-none">{getItem(id).glyph}</ArabicText>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {pictures.map((id) => (
            <button
              key={id}
              type="button"
              data-testid={`picture-${id}`}
              aria-label={getItem(id).example.meaning}
              onClick={() => choose('picture', id)}
              className={`flex h-24 items-center justify-center rounded-blob text-6xl transition-all ${cls('picture', id)} ${shake === `picture-${id}` ? 'animate-shake' : ''}`}
            >
              {matched.includes(id) ? '✅' : getItem(id).example.emoji}
            </button>
          ))}
        </div>
      </div>
      <Feedback state={feedback} />
    </div>
  );
}
