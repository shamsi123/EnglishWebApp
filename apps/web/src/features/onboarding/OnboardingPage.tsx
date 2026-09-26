import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { LearningGoal } from "@englishpath/core";
import { api } from "../../shared/api";
import { AuthScreen, FormMessage, errorMessage } from "../../shared/Form";
import { t, type MessageKey } from "../../shared/i18n";

const goals: Array<{ value: LearningGoal; icon: string }> = [
  { value: "work", icon: "💼" },
  { value: "travel", icon: "✈️" },
  { value: "study", icon: "🎓" },
  { value: "exam", icon: "📝" },
];

const minutes = [5, 10, 15, 20] as const;

// Native names so learners with little English can find theirs; hints in these languages arrive in Phase 2 (FR-26).
const languages: Array<{ code: string; name: string }> = [
  { code: "ar", name: "العربية" },
  { code: "hi", name: "हिन्दी" },
  { code: "ur", name: "اردو" },
  { code: "ml", name: "മലയാളം" },
  { code: "ta", name: "தமிழ்" },
  { code: "bn", name: "বাংলা" },
  { code: "tl", name: "Filipino" },
  { code: "und", name: "Other" },
];

/** FR-02 onboarding: goal, daily time target, native language — one question per screen. */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<LearningGoal | null>(null);
  const [daily, setDaily] = useState<(typeof minutes)[number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async (nativeLanguage: string) => {
    if (!goal || !daily) return;
    setBusy(true);
    setError(null);
    try {
      await api.saveOnboarding({ goal, dailyMinutes: daily, nativeLanguage });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      // Primary journey: onboarding → placement test → first lesson (BRD §9).
      navigate("/placement", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const option = "btn-option min-h-16 gap-3 text-lg";
  return (
    <AuthScreen title={t(step === 0 ? "onboarding.goalTitle" : step === 1 ? "onboarding.minutesTitle" : "onboarding.languageTitle")}>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden>
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${((step + 1) / 3) * 100}%` }} />
      </div>

      <div className="mt-6 grid gap-3">
        {step === 0 &&
          goals.map((g) => (
            <button key={g.value} type="button" className={option} aria-pressed={goal === g.value} onClick={() => { setGoal(g.value); setStep(1); }}>
              <span aria-hidden>{g.icon}</span>
              {t(`onboarding.goal.${g.value}` as MessageKey)}
            </button>
          ))}
        {step === 1 &&
          minutes.map((m) => (
            <button key={m} type="button" className={option} aria-pressed={daily === m} onClick={() => { setDaily(m); setStep(2); }}>
              <strong>{m}</strong> {t("onboarding.minutes")}
            </button>
          ))}
        {step === 2 &&
          languages.map((l) => (
            <button key={l.code} type="button" className={option} disabled={busy} onClick={() => finish(l.code)}>
              <span lang={l.code === "und" ? "en" : l.code}>{l.name}</span>
            </button>
          ))}
      </div>

      <FormMessage>{error}</FormMessage>
      {step > 0 && (
        <button type="button" className="btn mt-6 text-brand-700 dark:text-brand-500" onClick={() => setStep(step - 1)}>
          {t("auth.back")}
        </button>
      )}
    </AuthScreen>
  );
}
