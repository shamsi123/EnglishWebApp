import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, type Answer, type PlacementStepDto } from "@englishpath/core";
import { api } from "../../shared/api";
import { AuthScreen, FormMessage, errorMessage } from "../../shared/Form";
import { t } from "../../shared/i18n";
import { LEVEL_NAMES } from "../../shared/levels";
import { ExerciseView } from "../lesson/ExerciseView";

/**
 * Adaptive placement test (FR-10). Scored on the server, so there is no per-question feedback;
 * the learner just moves on. Skipping starts them at Pre-A1 (FR-11).
 */
export default function PlacementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<PlacementStepDto | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const run = async (action: () => Promise<PlacementStepDto | void>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      if (next) {
        setStep(next);
        setAnswer(null);
        if (next.result) await queryClient.invalidateQueries({ queryKey: ["course-map"] });
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "placement.unavailable") setUnavailable(true);
      else if (err instanceof ApiError && err.code === "placement.expired") {
        setError(t("placement.expired"));
        setStep(await api.startPlacement().catch(() => null));
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const skip = () =>
    run(async () => {
      await api.skipPlacement();
      await queryClient.invalidateQueries({ queryKey: ["course-map"] });
      navigate("/learn", { replace: true });
    });

  if (step?.result) {
    return (
      <AuthScreen title={t("placement.resultTitle")}>
        <p className="mt-6 text-lg">{t("placement.resultBody")}</p>
        <p className="mt-2 text-3xl font-bold text-brand-700 dark:text-brand-500">{LEVEL_NAMES[step.result.startLevel]}</p>
        <Link to="/learn" replace className="btn-primary mt-10">
          {t("placement.goLearn")}
        </Link>
      </AuthScreen>
    );
  }

  if (step?.question) {
    const { question } = step;
    return (
      <div className="pt-safe mx-auto flex min-h-full max-w-player flex-col px-4">
        <header className="py-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("placement.question")} {step.answered + 1}
          </p>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={step.maxQuestions} aria-valuenow={step.answered}>
            {/* Adaptive tests usually end early; show progress against the maximum. */}
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(step.answered / step.maxQuestions) * 100}%` }} />
          </div>
        </header>
        <div className="flex-1 py-4">
          <ExerciseView key={question.itemId} exercise={question.exercise} disabled={busy} onAnswerChange={setAnswer} />
          <FormMessage>{error}</FormMessage>
        </div>
        <footer className="pb-safe sticky bottom-0 -mx-4 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950">
          <button type="button" className="btn-primary w-full" disabled={!answer || busy} onClick={() => answer && run(() => api.answerPlacement(step.sessionId, question.itemId, answer))}>
            {t("placement.next")}
          </button>
        </footer>
      </div>
    );
  }

  return (
    <AuthScreen title={t("placement.title")}>
      <p className="mt-4 text-lg">{unavailable ? t("placement.unavailable") : t("placement.intro")}</p>
      <FormMessage>{error}</FormMessage>
      <div className="mt-auto grid gap-3 pt-10">
        {!unavailable && (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => run(() => api.startPlacement())}>
            {t("placement.start")}
          </button>
        )}
        <button type="button" className={unavailable ? "btn-primary" : "btn border-2 border-slate-200 dark:border-slate-700"} disabled={busy} onClick={skip}>
          {t("placement.skip")}
        </button>
      </div>
    </AuthScreen>
  );
}
