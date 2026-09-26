import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dueItems } from '@/engine/leitner';
import { sfx, speak } from '@/engine/audio';
import { ActivityHost } from '@/features/lesson/ActivityHost';
import { buildReview } from '@/features/lesson/buildLesson';
import type { ActivityOutcome } from '@/features/activities/types';
import { localDate } from '@/lib/progress';
import { useActiveChild, useStore } from '@/lib/store';
import { BottomNav } from '@/ui/BottomNav';
import { Button, IconButton } from '@/ui/Button';
import { Confetti } from '@/ui/Confetti';
import { Mascot } from '@/ui/Mascot';

const FLOWERS = ['🌷', '🌻', '🌼', '🌸', '🌺', '🪻'];

/** Screen 10 — Practice Garden (FR-17): due Leitner items; finishing a review waters the garden. */
export default function GardenScreen() {
  const { t } = useTranslation();
  const { data } = useActiveChild();
  const recordAnswer = useStore((s) => s.recordAnswer);
  const water = useStore((s) => s.waterGarden);
  const [index, setIndex] = useState<number | null>(null);
  const [justWatered, setJustWatered] = useState(false);

  const due = useMemo(() => [...new Set([...data.extraReview, ...dueItems(data.items, new Date())])], [data.extraReview, data.items]);
  const [session] = useState(() => buildReview(due, 'ar', Date.now() % 1e6));
  const wateredToday = data.gardenWaterings.includes(localDate(new Date()));
  // One flower per watering, plus one per letter the child has learned (moved past box 1).
  const flowers = data.gardenWaterings.length + Object.values(data.items).filter((m) => m.box >= 2).length;

  if (index !== null && session[index]) {
    const activity = session[index]!;
    const onDone = (o: ActivityOutcome) => {
      recordAnswer(activity.id, activity.itemId, o.correct, true);
      if (index + 1 >= session.length) {
        water();
        sfx('celebrate');
        setJustWatered(true);
        setIndex(null);
      } else setIndex(index + 1);
    };
    return (
      <div className="flex h-full flex-col bg-leaf-100">
        <header className="pt-safe flex items-center gap-3 px-4">
          <IconButton label={t('common.close')} onClick={() => setIndex(null)}>
            ✖️
          </IconButton>
          <div className="flex flex-1 gap-1">
            {session.map((a, i) => (
              <span key={a.id} className={`h-4 flex-1 rounded-full ${i < index ? 'bg-leaf-500' : 'bg-white'}`} />
            ))}
          </div>
          <IconButton label={t('lesson.replay')} onClick={() => speak(t('act.listenTap.prompt'))}>
            🔊
          </IconButton>
        </header>
        <p className="px-4 pt-4 text-lg font-bold">{t('act.listenTap.prompt')}</p>
        <main className="flex-1 overflow-y-auto px-4">
          <ActivityHost activity={activity} onDone={onDone} />
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-sky2-100 to-leaf-100">
      {justWatered && <Confetti pieces={24} />}
      <header className="pt-safe px-4 pb-2">
        <h1 className="text-3xl font-extrabold">🌻 {t('garden.title')}</h1>
      </header>
      <main className="flex flex-1 flex-col items-center gap-5 overflow-y-auto px-4">
        <Mascot size="sm" says={justWatered ? t('garden.watered') : due.length > 0 && !wateredToday ? t('garden.due', { count: due.length }) : t('garden.none')} />
        <div className="relative w-full rounded-blob bg-gradient-to-b from-transparent to-leaf-300 px-4 pb-4 pt-10">
          <span className="absolute end-6 top-2 text-5xl">☀️</span>
          {wateredToday && <span className="absolute start-6 top-2 text-4xl">🌈</span>}
          <div className="grid min-h-[180px] grid-cols-5 items-end gap-2" aria-label={t('garden.flowers', { count: flowers })}>
            {Array.from({ length: Math.max(flowers, 1) }).slice(0, 20).map((_, i) => (
              <span key={i} className="text-center text-4xl animate-grow" style={{ animationDelay: `${i * 0.08}s` }}>
                {flowers === 0 ? '🌱' : FLOWERS[i % FLOWERS.length]}
              </span>
            ))}
          </div>
          <div className="mt-2 h-4 rounded-full bg-amber-700/60" />
        </div>
        <p className="font-extrabold text-leaf-600">{t('garden.flowers', { count: flowers })}</p>
      </main>
      <div className="px-4 pb-4">
        <Button block variant="success" disabled={session.length === 0 || wateredToday} onClick={() => setIndex(0)}>
          💧 {t('garden.start')}
        </Button>
      </div>
      <BottomNav />
    </div>
  );
}
