import { useTranslation } from 'react-i18next';
import { getItem } from '@/content/course';
import { speak } from '@/engine/audio';
import { positionForms } from '@/lib/arabic';
import { ArabicText } from '@/ui/ArabicText';
import { Button } from '@/ui/Button';
import type { ActivityProps } from '../types';

/** Learn: sound, name, shape, position forms and an example word with a picture (BRD §5.2). */
export default function LearnCard({ activity, onDone }: ActivityProps<'learn_card'>) {
  const { t } = useTranslation();
  const item = getItem(activity.itemId);
  const forms = positionForms(item.glyph);
  const order = ['isolated', 'initial', 'medial', 'final'] as const;

  return (
    <div data-testid="learn-card" className="flex flex-col items-center gap-4 pb-4">
      <button
        type="button"
        aria-label={item.name.en}
        onClick={() => speak(item.name.ar, 'ar')}
        className="flex h-44 w-44 items-center justify-center rounded-full bg-white shadow-[0_8px_0_#ddd6fe] animate-pop-in active:translate-y-1"
      >
        <ArabicText className="text-[7rem] leading-none text-grape-700">{item.glyph}</ArabicText>
      </button>
      <div className="text-center">
        <ArabicText className="text-4xl font-bold">{item.name.ar}</ArabicText>
        <div className="text-lg font-bold text-grape-600">
          {item.name.en} · /{item.translit}/
        </div>
      </div>

      <button
        type="button"
        onClick={() => speak(item.example.word, 'ar')}
        className="flex w-full items-center justify-between gap-3 rounded-blob bg-sun-100 px-5 py-3 active:scale-95"
      >
        <span className="text-6xl">{item.example.emoji}</span>
        <span className="flex flex-col items-end">
          <ArabicText className="text-5xl font-bold">{item.example.word}</ArabicText>
          <span className="text-base font-bold text-ink/60">{t('act.learn.word', { name: item.name.en, meaning: item.example.meaning })}</span>
        </span>
      </button>

      <div className="w-full">
        <p className="mb-2 text-center text-sm font-bold uppercase tracking-wide text-ink/50">{t('act.learn.forms')}</p>
        <div dir="rtl" className="grid grid-cols-4 gap-2">
          {order.map((k) => (
            <div key={k} className="flex flex-col items-center rounded-2xl bg-white py-2 shadow-sm">
              <ArabicText className="text-4xl leading-tight">{forms[k]}</ArabicText>
              <span className="text-xs font-bold text-ink/50">{t(`act.learn.${k}`)}</span>
            </div>
          ))}
        </div>
      </div>

      <Button block onClick={() => onDone({ correct: true })}>
        {t('common.next')} <span className="rtl:-scale-x-100">➡️</span>
      </Button>
    </div>
  );
}
