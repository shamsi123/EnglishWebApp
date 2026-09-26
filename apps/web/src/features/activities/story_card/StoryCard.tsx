import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getItem } from '@/content/course';
import { speak } from '@/engine/audio';
import { ArabicText } from '@/ui/ArabicText';
import { Button } from '@/ui/Button';
import type { ActivityProps } from '../types';

/** A8 Story Card: a short scene of this unit's letters so far. Tap an object to hear its word. */
export default function StoryCard({ activity, onDone }: ActivityProps<'story_card'>) {
  const { t } = useTranslation();
  const [heard, setHeard] = useState<string[]>([]);

  return (
    <div data-testid="story-card" className="flex flex-col items-center gap-6 pb-4 pt-2">
      <div dir="rtl" className="grid w-full grid-cols-2 gap-4 rounded-blob bg-sky2-100 p-5">
        {activity.items.map((id) => {
          const item = getItem(id);
          return (
            <button
              key={id}
              type="button"
              data-testid={`story-item-${id}`}
              aria-label={item.example.meaning}
              onClick={() => {
                speak(item.example.word, 'ar');
                setHeard((h) => (h.includes(id) ? h : [...h, id]));
              }}
              className={`flex flex-col items-center gap-2 rounded-3xl bg-white p-4 shadow-[0_5px_0_#bae6fd] transition-transform active:translate-y-1 ${
                heard.includes(id) ? 'ring-4 ring-sky2-400' : ''
              }`}
            >
              <span className="text-6xl">{item.example.emoji}</span>
              <ArabicText className="text-2xl font-bold">{item.example.word}</ArabicText>
            </button>
          );
        })}
      </div>
      <Button block onClick={() => onDone({ correct: true })}>
        {t('common.continue')} <span className="rtl:-scale-x-100">➡️</span>
      </Button>
    </div>
  );
}
