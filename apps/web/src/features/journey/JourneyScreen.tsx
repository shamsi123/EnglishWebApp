import { useEffect, useRef } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { courses, getItem, journeyNodes, type JourneyNode } from '@/content/course';
import { nodeStatuses, totalStars, type NodeStatus } from '@/lib/progress';
import { useActiveChild } from '@/lib/store';
import { ArabicText } from '@/ui/ArabicText';
import { Avatar } from '@/ui/Avatar';
import { BottomNav } from '@/ui/BottomNav';
import { Stars } from '@/ui/Stars';

// Horizontal offsets that make the path wind (logical: positive = towards the end side).
const WAVE = [0, 70, 105, 70, 0, -70, -105, -70];

function NodeFace({ node }: { node: JourneyNode }) {
  if (node.kind === 'checkpoint') return <span className="text-4xl">🏁</span>;
  if (node.kind === 'level_test') return <span className="text-4xl">🏆</span>;
  return <ArabicText className="text-5xl leading-none">{getItem(node.lesson.newItems[0]!).glyph}</ArabicText>;
}

const STYLES: Record<NodeStatus, string> = {
  mastered: 'bg-leaf-400 text-white shadow-[0_6px_0_#16a34a]',
  available: 'bg-sun-300 text-ink shadow-[0_6px_0_#d97706] animate-glow',
  in_progress: 'bg-sun-300 text-ink shadow-[0_6px_0_#d97706] animate-glow',
  locked: 'bg-gray-200 text-gray-400 shadow-[0_6px_0_#d1d5db]',
};

/** Screen 5 — Journey map (FR-10): a winding path of lessons with locked / available / mastered states. */
export default function JourneyScreen() {
  const { courseId = 'ar' } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { child, data } = useActiveChild();
  const currentRef = useRef<HTMLDivElement>(null);
  const course = courses[courseId];

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  if (!course || !child) return <Navigate to="/courses" replace />;
  const states = nodeStatuses(courseId, data);
  const nodes = journeyNodes(courseId);
  const current = nodes.find((n) => states[n.id] === 'available' || states[n.id] === 'in_progress');
  const lang = i18n.language === 'ar' ? 'ar' : 'en';
  let unitNo = 0;

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-leaf-100 via-sun-100 to-sky2-100">
      <header className="pt-safe flex items-center gap-3 bg-white/80 px-4 pb-2 backdrop-blur">
        <button type="button" aria-label={t('common.back')} onClick={() => navigate('/courses')}>
          <Avatar avatar={child.avatar} size={52} />
        </button>
        <div className="flex-1">
          <div className="text-xl font-extrabold">{course.title[lang]}</div>
          <div className="text-sm font-bold text-ink/60">{course.levels[0]!.title[lang]}</div>
        </div>
        <span className="rounded-full bg-sun-100 px-3 py-1 text-lg font-extrabold" aria-label={t('parent.stars')}>
          ⭐ {totalStars(data)}
        </span>
        <span className="rounded-full bg-coral-100 px-3 py-1 text-lg font-extrabold" aria-label={t('parent.streak')}>
          🔥 {data.streak.current}
        </span>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6" data-testid="journey">
        <div className="flex flex-col items-center">
          {nodes.map((node, i) => {
            const status = states[node.id]!;
            const isCurrent = node.id === current?.id;
            const firstOfUnit = node.kind === 'lesson' && node.unit.lessons[0]!.id === node.id;
            if (firstOfUnit) unitNo++;
            const stars = data.lessons[node.id]?.stars ?? 0;
            return (
              <div key={node.id} className="flex w-full flex-col items-center">
                {firstOfUnit && node.kind === 'lesson' && (
                  <div className="my-4 flex w-full items-center gap-3 rounded-blob bg-white/90 px-4 py-3 shadow-sm">
                    <span className={`text-4xl ${data.stickers.includes(node.unit.id) ? '' : 'grayscale opacity-50'}`}>{node.unit.sticker}</span>
                    <span className="flex flex-col">
                      <span className="text-sm font-extrabold uppercase text-grape-600">{t('journey.unit', { n: unitNo })}</span>
                      <span className="text-lg font-extrabold leading-tight">{node.unit.title[lang]}</span>
                    </span>
                  </div>
                )}
                <div
                  ref={isCurrent ? currentRef : undefined}
                  className={`relative flex flex-col items-center ${isCurrent ? 'mb-2 mt-12' : 'my-2'}`}
                  style={{ transform: `translateX(calc(${WAVE[i % WAVE.length]}px * var(--dir, 1)))` }}
                >
                  {isCurrent && (
                    <span className="absolute -top-10 z-10 flex items-center gap-1 whitespace-nowrap rounded-full bg-white px-3 py-1 text-sm font-extrabold shadow animate-bob">
                      {course.mascot.emoji} {t('journey.youAreHere')}
                    </span>
                  )}
                  <button
                    type="button"
                    data-testid={`node-${node.id}`}
                    data-status={status}
                    disabled={status === 'locked'}
                    aria-label={`${node.kind === 'lesson' ? node.lesson.title[lang] : node.kind === 'checkpoint' ? t('journey.checkpoint') : t('journey.levelTest')} — ${status}`}
                    onClick={() => navigate(`/lesson/${node.id}`)}
                    className={`flex items-center justify-center rounded-full ${node.kind === 'lesson' ? 'h-20 w-20' : 'h-24 w-24'} ${STYLES[status]}`}
                  >
                    {status === 'locked' ? <span className="text-3xl">🔒</span> : <NodeFace node={node} />}
                  </button>
                  <div className="mt-1 h-6">{status === 'mastered' && node.kind === 'lesson' ? <Stars count={stars} size="text-base" /> : null}</div>
                  {node.kind !== 'lesson' && <span className="text-xs font-extrabold text-ink/60">{node.kind === 'checkpoint' ? t('journey.checkpoint') : t('journey.levelTest')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
