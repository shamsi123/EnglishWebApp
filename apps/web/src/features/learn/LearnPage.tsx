import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { LessonState } from "@englishpath/core";
import { api } from "../../shared/api";
import { t } from "../../shared/i18n";
import { DEMO_LESSON_ID } from "../../fixtures/ids";

const stateStyles: Record<LessonState, string> = {
  locked: "bg-slate-200 text-slate-400 dark:bg-slate-800",
  unlocked: "bg-brand-600 text-white",
  inProgress: "bg-brand-500 text-white ring-4 ring-brand-100",
  completed: "bg-amber-400 text-white",
};

/** Course map: Levels → Units → Lessons with locked/unlocked/completed states (FR-20). */
export function LearnPage() {
  const courseMap = useQuery({ queryKey: ["course-map"], queryFn: () => api.getCourseMap() });

  return (
    <section className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold">{t("learn.title")}</h1>

      {courseMap.isPending && (
        <div className="mt-6 space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      )}

      {courseMap.isError && (
        <div role="alert" className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
          <p>{t("learn.loadError")}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => courseMap.refetch()}>
              {t("learn.retry")}
            </button>
            <Link to={`/lesson/${DEMO_LESSON_ID}`} className="btn border-2 border-slate-200 dark:border-slate-700">
              {t("learn.tryDemo")}
            </Link>
          </div>
        </div>
      )}

      {courseMap.data?.levels.map((level) => (
        <div key={level.level} className="mt-6">
          <h2 className="text-lg font-semibold">{level.title}</h2>
          {level.units.map((unit) => (
            <div key={unit.id} className="mt-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <h3 className="font-medium">{unit.title}</h3>
              <ol className="mt-3 flex flex-wrap gap-3">
                {unit.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    {lesson.state === "locked" ? (
                      <span
                        className={`btn h-14 w-14 rounded-full p-0 ${stateStyles.locked}`}
                        aria-label={`${lesson.title} (locked)`}
                      >
                        🔒
                      </span>
                    ) : (
                      <Link
                        to={`/lesson/${lesson.id}`}
                        className={`btn h-14 w-14 rounded-full p-0 ${stateStyles[lesson.state]}`}
                        aria-label={`${lesson.title} (${lesson.state})`}
                      >
                        {lesson.state === "completed" ? "★" : "▶"}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
