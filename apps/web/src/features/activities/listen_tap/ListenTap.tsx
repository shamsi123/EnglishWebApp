import { getItem } from '@/content/course';
import { ArabicText } from '@/ui/ArabicText';
import { Feedback } from '../Feedback';
import type { ActivityProps } from '../types';
import { useAnswer } from '../useAnswer';
import { useState } from 'react';

/** A1 Listen & Tap: hear a sound, tap the matching letter among 2–4 options. */
export default function ListenTap({ activity, onDone }: ActivityProps<'listen_tap'>) {
  const { feedback, answer, showHint, finished, isCheck } = useAnswer(activity, onDone);
  const [picked, setPicked] = useState<string | null>(null);
  const [shake, setShake] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div dir="rtl" className={`grid gap-4 ${activity.options.length === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {activity.options.map((id) => {
          const item = getItem(id);
          const isTarget = id === activity.itemId;
          const state =
            picked === id && isTarget
              ? 'bg-leaf-400 text-white shadow-[0_6px_0_#16a34a]'
              : (showHint || (finished && isCheck)) && isTarget
                ? 'bg-sun-300 ring-4 ring-sun-400 animate-bob'
                : 'bg-white shadow-[0_6px_0_#ddd6fe]';
          return (
            <button
              key={id}
              type="button"
              data-testid={`option-${id}`}
              aria-label={item.name.en}
              disabled={finished}
              onClick={() => {
                setPicked(id);
                if (!isTarget) {
                  setShake(id);
                  window.setTimeout(() => setShake(null), 400);
                }
                answer(isTarget);
              }}
              className={`flex aspect-square items-center justify-center rounded-blob transition-all active:translate-y-1 ${state} ${shake === id ? 'animate-shake' : ''}`}
            >
              <ArabicText className="text-7xl leading-none">{item.glyph}</ArabicText>
            </button>
          );
        })}
      </div>
      <Feedback state={feedback} />
    </div>
  );
}
