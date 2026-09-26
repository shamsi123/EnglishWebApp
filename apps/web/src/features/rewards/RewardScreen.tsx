import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { courses, type JourneyNode } from '@/content/course';
import { sfx, speak } from '@/engine/audio';
import type { MasteryResult } from '@/engine/mastery';
import { Button } from '@/ui/Button';
import { Confetti } from '@/ui/Confetti';
import { Mascot } from '@/ui/Mascot';

interface Props {
  node: JourneyNode;
  result: MasteryResult;
  onNext: (() => void) | null;
  onMap: () => void;
}

/** Reward: stars (1–3), sticker reveal for a unit, trophy for a level, confetti and a dancing mascot. */
export function RewardScreen({ node, result, onNext, onMap }: Props) {
  const { t } = useTranslation();
  const course = courses[node.courseId]!;
  useEffect(() => {
    sfx('celebrate');
    speak(t('reward.spoken'));
  }, [t]);

  const heading = node.kind === 'lesson' ? t('reward.mastered') : node.kind === 'checkpoint' ? t('reward.checkpoint') : t('reward.levelTest');
  return (
    <div className="relative flex h-full flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-sun-100 via-cream to-grape-100 px-6 pb-safe pt-safe">
      <Confetti />
      <div className="mt-6 flex flex-col items-center gap-2 text-center">
        <h1 className="text-5xl font-extrabold text-grape-700 animate-pop-in">{t('reward.title')}</h1>
        <p className="text-2xl font-bold">{heading}</p>
      </div>
      <div className="flex gap-2" aria-label={`${result.stars} / 3`}>
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`text-7xl ${n <= result.stars ? 'animate-pop-in drop-shadow-lg' : 'opacity-20 grayscale'}`}
            style={{ animationDelay: `${n * 0.25}s` }}
          >
            ⭐
          </span>
        ))}
      </div>
      {node.kind === 'checkpoint' && (
        <div className="flex flex-col items-center rounded-blob bg-white px-8 py-4 shadow-lg animate-pop-in" style={{ animationDelay: '1s' }}>
          <span className="text-7xl">{node.unit.sticker}</span>
          <span className="text-xl font-extrabold text-grape-600">{t('reward.sticker')}</span>
        </div>
      )}
      {node.kind === 'level_test' && (
        <div className="flex flex-col items-center rounded-blob bg-white px-8 py-4 shadow-lg animate-pop-in" style={{ animationDelay: '1s' }}>
          <span className="text-7xl">{course.levels[0]!.trophy}</span>
          <span className="text-xl font-extrabold text-grape-600">{t('reward.trophy')}</span>
        </div>
      )}
      <Mascot emoji={course.mascot.emoji} size="lg" mood="happy" />
      <div className="flex w-full flex-col gap-3">
        {onNext && (
          <Button block variant="success" onClick={onNext}>
            {t('reward.next')} <span className="rtl:-scale-x-100">➡️</span>
          </Button>
        )}
        <Button block variant="secondary" onClick={onMap}>
          🗺️ {t('reward.map')}
        </Button>
      </div>
    </div>
  );
}
