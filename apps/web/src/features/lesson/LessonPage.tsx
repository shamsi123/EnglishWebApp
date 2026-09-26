import { useEffect, useReducer, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Answer, AttemptDto, Lesson } from "@englishpath/core";
import { api } from "../../shared/api";
import { localDay } from "../../shared/dates";
import { t } from "../../shared/i18n";
import { demoLesson } from "../../fixtures/demoLesson";
import { enqueueCompletion, flushCompletions } from "./completionQueue";
import { ExerciseView } from "./ExerciseView";
import { currentExercise, initSession, isMistakeReview, progress, reduceSession, summary } from "./lessonSession";

export default function LessonPage() {
  const { lessonId = "" } = useParams();
  const queryClient = useQueryClient();
  const lesson = useQuery({ queryKey: ["lesson", lessonId], queryFn: () => api.getLesson(lessonId) });

  // Queue first so the result survives going offline or closing the app, then try to sync (NFR-05).
  const complete = async (attempts: AttemptDto[]) => {
    if (!lesson.data) return;
    await enqueueCompletion({
      lessonId,
      request: { completionId: crypto.randomUUID(), lessonVersion: lesson.data.version, learnerLocalDay: localDay(), attempts },
    });
    const synced = await flushCompletions().catch(() => 0);
    if (synced > 0) {
      await queryClient.invalidateQueries({ queryKey: ["course-map"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  };

  if (lesson.isPending) return <div className="mx-auto mt-8 h-64 max-w-player animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;
  if (lesson.isError) {
    return (
      <div role="alert" className="mx-auto max-w-player p-4">
        <p>{t("learn.loadError")}</p>
        <Link to="/learn" className="btn-primary mt-4">{t("lesson.close")}</Link>
      </div>
    );
  }
  return <LessonPlayer lesson={lesson.data} exitTo="/learn" onComplete={complete} />;
}

/** FR-03 guest mode: the demo lesson runs locally, then invites the learner to sign up. */
export function TryLessonPage() {
  return <LessonPlayer lesson={demoLesson} exitTo="/sign-up" summaryNote={t("guest.saveProgress")} />;
}

interface LessonPlayerProps {
  lesson: Lesson;
  exitTo: string;
  /** Called once when the summary is reached, with every attempt in order. */
  onComplete?: (attempts: AttemptDto[]) => void | Promise<void>;
  summaryNote?: string;
}

export function LessonPlayer({ lesson, exitTo, onComplete, summaryNote }: LessonPlayerProps) {
  const navigate = useNavigate();
  const [session, dispatch] = useReducer(
    (state: ReturnType<typeof initSession>, action: Parameters<typeof reduceSession>[2]) => reduceSession(lesson, state, action),
    lesson,
    initSession,
  );
  const [answer, setAnswer] = useState<Answer | null>(null);
  const exercise = currentExercise(lesson, session);
  const attempts = useRef<AttemptDto[]>([]);
  const shownAt = useRef(Date.now());
  const reported = useRef(false);

  useEffect(() => {
    if (session.phase === "exercise") shownAt.current = Date.now();
  }, [session.phase, session.turn]);

  useEffect(() => {
    if (session.phase === "summary" && !reported.current) {
      reported.current = true;
      void onComplete?.(attempts.current);
    }
  }, [session.phase, onComplete]);

  const submit = () => {
    if (!answer || !exercise) return;
    attempts.current.push({
      exerciseId: exercise.id,
      answer,
      answeredAt: new Date().toISOString(),
      timeTakenMs: Date.now() - shownAt.current,
    });
    dispatch({ type: "submit", answer });
    navigator.vibrate?.(30);
  };
  const next = () => {
    setAnswer(null);
    dispatch({ type: "continue" });
  };

  return (
    <div className="mx-auto flex min-h-full max-w-player flex-col px-4 pt-safe">
      <header className="flex items-center gap-3 py-3">
        <button type="button" className="btn min-w-touch p-0 text-xl" aria-label={t("lesson.close")} onClick={() => navigate(exitTo)}>
          ✕
        </button>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress(lesson, session) * 100)}>
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress(lesson, session) * 100}%` }} />
        </div>
      </header>

      <div className="flex-1 py-4">
        {session.phase === "intro" && (
          <div>
            <h1 className="text-2xl font-bold">{lesson.title}</h1>
            <p className="mt-2 text-slate-600 dark:text-slate-400">{lesson.objective}</p>
            <p className="mt-6">{lesson.intro.concept}</p>
            <p className="mt-3 rounded-2xl bg-brand-50 p-4 italic dark:bg-slate-900">{lesson.intro.example}</p>
          </div>
        )}

        {(session.phase === "exercise" || session.phase === "feedback") && exercise && (
          <>
            {isMistakeReview(session) && <p className="mb-2 text-sm font-semibold text-amber-600">{t("lesson.reviewMistakes")}</p>}
            <ExerciseView
              key={`${exercise.id}-${session.turn - (session.phase === "feedback" ? 1 : 0)}`}
              exercise={exercise}
              disabled={session.phase === "feedback"}
              onAnswerChange={setAnswer}
            />
          </>
        )}

        {session.phase === "summary" && (
          <div className="text-center">
            <p className="text-6xl" aria-hidden>🎉</p>
            <h1 className="mt-4 text-2xl font-bold">{t("lesson.complete")}</h1>
            <dl className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-amber-50 p-4 dark:bg-slate-900">
                <dt className="text-sm text-slate-600 dark:text-slate-400">{t("lesson.xpEarned")}</dt>
                <dd className="text-2xl font-bold">{summary(lesson, session).xp}</dd>
              </div>
              <div className="rounded-2xl bg-brand-50 p-4 dark:bg-slate-900">
                <dt className="text-sm text-slate-600 dark:text-slate-400">{t("lesson.accuracy")}</dt>
                <dd className="text-2xl font-bold">{summary(lesson, session).accuracy}%</dd>
              </div>
            </dl>
            {summaryNote && <p className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">{summaryNote}</p>}
          </div>
        )}
      </div>

      {/* Sticky action in the thumb zone (BRD §9). */}
      <footer
        className={`pb-safe sticky bottom-0 -mx-4 border-t px-4 py-4 ${
          session.phase === "feedback"
            ? session.lastResult?.correct
              ? "border-brand-100 bg-brand-50 dark:bg-brand-700/20"
              : "border-danger-50 bg-danger-50 dark:bg-danger-700/20"
            : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
        }`}
      >
        {session.phase === "feedback" && session.lastResult && (
          <div role="status" className="mb-3">
            <p className={`text-lg font-bold ${session.lastResult.correct ? "text-brand-700" : "text-danger-700"}`}>
              {session.lastResult.correct ? t("lesson.correct") : t("lesson.incorrect")}
            </p>
            {!session.lastResult.correct && (
              <p>
                {t("lesson.correctAnswer")} <strong>{session.lastResult.correctAnswer}</strong>
              </p>
            )}
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{session.lastResult.explanation}</p>
          </div>
        )}
        {session.phase === "intro" && <button type="button" className="btn-primary w-full" onClick={() => dispatch({ type: "start" })}>{t("lesson.start")}</button>}
        {session.phase === "exercise" && <button type="button" className="btn-primary w-full" disabled={!answer} onClick={submit}>{t("lesson.check")}</button>}
        {session.phase === "feedback" && <button type="button" className="btn-primary w-full" onClick={next}>{t("lesson.continue")}</button>}
        {session.phase === "summary" && <button type="button" className="btn-primary w-full" onClick={() => navigate(exitTo)}>{t("lesson.done")}</button>}
      </footer>
    </div>
  );
}
