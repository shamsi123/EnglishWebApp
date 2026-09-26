import { useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { courses, findNode, journeyNodes, type JourneyNode } from '@/content/course';
import type { Activity } from '@/content/schema';
import { speakAll } from '@/engine/audio';
import { activityCaption, activitySpeech } from '@/features/activities/speech';
import type { ActivityOutcome } from '@/features/activities/types';
import { RewardScreen } from '@/features/rewards/RewardScreen';
import { nodeStatuses, type LessonSession, type LessonStage } from '@/lib/progress';
import { useActiveChild, useStore } from '@/lib/store';
import { IconButton } from '@/ui/Button';
import { ActivityHost } from './ActivityHost';
import { buildHelpLoop, buildLesson, generateQuiz } from './buildLesson';
import { Caterpillar } from './Caterpillar';
import { HelpIntro } from './HelpIntro';

function activitiesFor(node: JourneyNode, session: LessonSession): Activity[] {
  switch (session.stage) {
    case 'learn':
      return buildLesson(node, session.seed).learn;
    case 'play':
      return buildLesson(node, session.seed).play;
    case 'check':
      return generateQuiz(node, session.seed + session.retries);
    case 'help':
      return buildHelpLoop(node, session.helpItems ?? [], session.seed + session.retries);
    default:
      return [];
  }
}

const STAGE_ORDER: LessonStage[] = ['learn', 'play', 'check'];

/** Lesson runner (FR-11): Learn → Play → Check in order; the Check result gates the next lesson. */
export default function LessonScreen() {
  const { nodeId = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { child, data, settings } = useActiveChild();
  const setSession = useStore((s) => s.setSession);
  const recordAnswer = useStore((s) => s.recordAnswer);
  const completeCheck = useStore((s) => s.completeCheck);
  const node = findNode(nodeId);
  const status = node ? nodeStatuses(node.courseId, data)[node.id] : undefined;

  const session = data.session?.nodeId === nodeId ? data.session : null;

  useEffect(() => {
    if (!node || !child || session || status === 'locked') return;
    setSession({
      nodeId,
      stage: node.kind === 'lesson' ? 'learn' : 'check',
      index: 0,
      seed: Math.floor(Math.random() * 1e6),
      quizResults: [],
      traceAccuracy: null,
      retries: 0,
    });
  }, [node, child, session, status, nodeId, setSession]);

  const activities = useMemo(() => (node && session ? activitiesFor(node, session) : []), [node, session]);
  const activity = session && session.index >= 0 ? activities[session.index] : undefined;

  useEffect(() => {
    if (activity) speakAll(activitySpeech(activity, t, settings.uiLang));
  }, [activity, t, settings.uiLang]);

  if (!node || status === 'locked') return <Navigate to="/journey/ar" replace />;
  if (!session) return null;
  const course = courses[node.courseId]!;
  const toMap = () => navigate(`/journey/${node.courseId}`);

  if (session.stage === 'reward' && session.result) {
    const nodes = journeyNodes(node.courseId);
    const next = nodes[nodes.findIndex((n) => n.id === node.id) + 1];
    const leave = (to: string) => {
      setSession(null);
      navigate(to);
    };
    return <RewardScreen node={node} result={session.result} onNext={next ? () => leave(`/lesson/${next.id}`) : null} onMap={() => leave(`/journey/${node.courseId}`)} />;
  }

  if (session.stage === 'help' && session.index < 0) {
    return <HelpIntro items={session.helpItems ?? []} mascot={course.mascot.emoji} onStart={() => setSession({ ...session, index: 0 })} />;
  }

  const stages = node.kind === 'lesson' ? STAGE_ORDER : (['check'] as LessonStage[]);
  const built = node.kind === 'lesson' ? buildLesson(node, session.seed) : { learn: [], play: [] };
  const quizLen = generateQuiz(node, session.seed).length;
  const total = session.stage === 'help' ? activities.length : built.learn.length + built.play.length + quizLen;
  const doneBefore = session.stage === 'play' ? built.learn.length : session.stage === 'check' ? built.learn.length + built.play.length : 0;

  const onDone = (outcome: ActivityOutcome) => {
    if (!activity) return;
    let next: LessonSession = { ...session, index: session.index + 1 };
    if (session.stage === 'check' || session.stage === 'help') recordAnswer(activity.id, activity.itemId, outcome.correct);
    if (session.stage === 'check') {
      next.quizResults = [...session.quizResults, { itemId: activity.itemId, correct: outcome.correct }];
      if (activity.type === 'trace') next.traceAccuracy = Math.max(session.traceAccuracy ?? 0, outcome.score ?? 0);
    }
    if (next.index >= activities.length) {
      if (session.stage === 'check') {
        const result = completeCheck(node.id, next.quizResults, next.traceAccuracy);
        next = result.mastered
          ? { ...next, stage: 'reward', result }
          : { ...next, stage: 'help', index: -1, helpItems: result.missedItems, retries: session.retries + 1, quizResults: [], traceAccuracy: null };
      } else if (session.stage === 'help') {
        next = { ...next, stage: 'check', index: 0 };
      } else {
        next = { ...next, stage: stages[stages.indexOf(session.stage) + 1] ?? 'check', index: 0 };
      }
    }
    setSession(next);
  };

  const stageColor = { learn: 'bg-sky2-100 text-sky2-500', play: 'bg-sun-100 text-sun-500', check: 'bg-grape-100 text-grape-600', help: 'bg-leaf-100 text-leaf-600', reward: '' }[session.stage];
  const stageLabel = session.stage === 'help' ? t('help.title') : t(`lesson.${session.stage}`);

  return (
    <div className="flex h-full flex-col bg-cream">
      <header className="pt-safe flex items-center gap-3 px-4">
        <IconButton label={t('lesson.leave')} onClick={toMap}>
          ✖️
        </IconButton>
        <Caterpillar total={total} done={doneBefore + Math.max(session.index, 0)} label={stageLabel} />
      </header>
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <span data-testid="stage" data-stage={session.stage} className={`rounded-full px-4 py-1 text-lg font-extrabold ${stageColor}`}>
          {stageLabel}
        </span>
        <span className="text-4xl">{course.mascot.emoji}</span>
      </div>
      {activity && (
        <div className="flex items-center gap-3 px-4 pt-2">
          <button
            type="button"
            data-testid="replay"
            aria-label={t('lesson.replay')}
            onClick={() => speakAll(activitySpeech(activity, t, settings.uiLang))}
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-grape-600 text-3xl text-white shadow-[0_5px_0_#5b21b6] active:translate-y-1 active:shadow-none"
          >
            🔊
          </button>
          <p data-testid="caption" className="text-lg font-bold leading-snug">{activityCaption(activity, t)}</p>
        </div>
      )}
      <main className="flex-1 overflow-y-auto px-4 pb-safe pt-2">{activity && <ActivityHost activity={activity} onDone={onDone} />}</main>
    </div>
  );
}
