import { useTranslation } from 'react-i18next';
import { getItem } from '@/content/course';
import { ArabicText } from '@/ui/ArabicText';
import { Button } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';

/** Help Loop intro (FR-13): friendly, never "failed". Shows the letters we'll practise together. */
export function HelpIntro({ items, mascot, onStart }: { items: string[]; mascot: string; onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-between gap-6 bg-gradient-to-b from-sky2-100 to-cream px-6 pb-safe pt-safe">
      <h1 className="mt-8 text-center text-4xl font-extrabold text-grape-700">{t('help.title')}</h1>
      <Mascot emoji={mascot} size="lg" says={t('help.body')} speakLang="en" />
      <div dir="rtl" className="flex flex-wrap justify-center gap-3">
        {items.map((id) => (
          <div key={id} className="flex h-24 w-24 items-center justify-center rounded-blob bg-white shadow-[0_6px_0_#bae6fd]">
            <ArabicText className="text-6xl">{getItem(id).glyph}</ArabicText>
          </div>
        ))}
      </div>
      <Button block onClick={onStart}>
        🤝 {t('help.start')}
      </Button>
    </div>
  );
}
