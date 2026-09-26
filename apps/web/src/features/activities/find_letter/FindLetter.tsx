import { useMemo, useState } from 'react';
import { courseItems, getItem } from '@/content/course';
import { joinedSegments, sameLetter } from '@/lib/arabic';
import { ArabicText } from '@/ui/ArabicText';
import { Feedback } from '../Feedback';
import type { ActivityProps } from '../types';
import { useAnswer } from '../useAnswer';

/** A6 Find the Letter: spot the target inside a real, joined word (any position form). */
export default function FindLetter({ activity, onDone }: ActivityProps<'find_letter'>) {
  const target = getItem(activity.itemId);
  const { feedback, answer, showHint, finished } = useAnswer(activity, onDone);
  const [hit, setHit] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const segments = useMemo(() => joinedSegments(activity.word), [activity.word]);
  const picture = useMemo(() => courseItems('ar').find((i) => i.example.plain === activity.word), [activity.word]);

  return (
    <div className="flex flex-col items-center gap-6 pt-2">
      {picture && <div className="text-7xl">{picture.example.emoji}</div>}
      <div className="flex items-center gap-3 rounded-blob bg-white px-6 py-4 shadow-[0_6px_0_#ddd6fe]">
        <ArabicText className="text-4xl text-grape-600">{target.glyph}</ArabicText>
        <span className="text-2xl">🔍</span>
      </div>
      <div dir="rtl" lang="ar" className="ar flex flex-row rounded-blob bg-sun-100 px-4 py-6" data-testid="word">
        {segments.map((seg) => {
          const isTarget = sameLetter(seg.char, target.glyph);
          const color =
            hit === seg.index ? 'text-leaf-500' : showHint && isTarget ? 'text-sun-500 underline decoration-4' : shake === seg.index ? 'text-coral-400' : 'text-ink';
          return (
            <button
              key={seg.index}
              type="button"
              data-testid={`seg-${seg.index}`}
              disabled={finished}
              onClick={() => {
                if (isTarget) setHit(seg.index);
                else {
                  setShake(seg.index);
                  window.setTimeout(() => setShake(null), 400);
                }
                answer(isTarget);
              }}
              className={`p-0 text-[5.5rem] leading-[1.4] transition-colors ${color} ${shake === seg.index ? 'animate-shake' : ''}`}
            >
              {seg.display}
            </button>
          );
        })}
      </div>
      <Feedback state={feedback} />
    </div>
  );
}
