import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Skill } from "@englishpath/core";
import { api } from "../../shared/api";
import { auth } from "../../shared/auth";
import { localDay } from "../../shared/dates";
import { Field, FormMessage, errorMessage } from "../../shared/Form";
import { t, type MessageKey } from "../../shared/i18n";
import { pendingCount } from "../lesson/completionQueue";

const skills: Skill[] = ["reading", "listening", "speaking", "writing", "grammar", "vocabulary"];

/** Learner dashboard (FR-60) and account settings (FR-04). */
export default function ProfilePage() {
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.getMe() });
  const today = localDay();
  const dashboard = useQuery({ queryKey: ["dashboard", today], queryFn: () => api.getDashboard(today) });
  const [pending, setPending] = useState(0);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    pendingCount().then(setPending, () => setPending(0));
  }, []);

  const signOut = async () => {
    await auth.signOut();
    navigate("/welcome", { replace: true });
  };

  const d = dashboard.data;
  return (
    <section className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
      {me.data && <p className="text-slate-600 dark:text-slate-400">{me.data.email}</p>}

      {me.data && !me.data.emailVerified && (
        <div className="mt-4 rounded-2xl bg-amber-50 p-4 dark:bg-slate-900">
          <p>{t("profile.verifyBanner")}</p>
          {resent ? (
            <p className="mt-2 font-medium" role="status">{t("profile.resent")}</p>
          ) : (
            <button type="button" className="btn mt-2 border-2 border-amber-400" onClick={() => api.resendVerification().then(() => setResent(true))}>
              {t("profile.resend")}
            </button>
          )}
        </div>
      )}

      {pending > 0 && (
        <p className="mt-4 rounded-2xl bg-slate-100 p-3 text-sm dark:bg-slate-900" role="status">
          {pending} {t("profile.pendingSync")}
        </p>
      )}

      {dashboard.isPending && <div className="mt-6 h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" aria-busy="true" />}
      {d && (
        <>
          <div className="mt-6 rounded-2xl bg-brand-50 p-4 dark:bg-slate-900">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{t("profile.todayXp")}</span>
              <span>
                <strong>{d.todayXp}</strong> / {d.dailyGoalXp} XP
              </span>
            </div>
            <div
              className="mt-2 h-3 overflow-hidden rounded-full bg-white dark:bg-slate-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={d.dailyGoalXp}
              aria-valuenow={Math.min(d.todayXp, d.dailyGoalXp)}
            >
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (d.todayXp / d.dailyGoalXp) * 100)}%` }} />
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(
              [
                ["profile.streak", `🔥 ${d.streak}`],
                ["profile.totalXp", d.totalXp],
                ["profile.lessons", d.lessonsCompleted],
                ["profile.words", d.wordsLearned],
                ["profile.reviewsDue", d.reviewsDue],
              ] as Array<[MessageKey, string | number]>
            ).map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <dt className="text-sm text-slate-600 dark:text-slate-400">{t(label)}</dt>
                <dd className="text-2xl font-bold">{value}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-6 text-lg font-semibold">{t("profile.skills")}</h2>
          <ul className="mt-2 space-y-2">
            {skills.map((skill) => (
              <li key={skill} className="grid grid-cols-[7rem_1fr] items-center gap-3">
                <span className="text-sm">{t(`skill.${skill}` as MessageKey)}</span>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="meter" aria-label={t(`skill.${skill}` as MessageKey)} aria-valuemin={0} aria-valuemax={100} aria-valuenow={d.skills[skill]}>
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${d.skills[skill]}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <button type="button" className="btn mt-8 w-full border-2 border-slate-200 dark:border-slate-700" onClick={signOut}>
        {t("profile.signOut")}
      </button>
      {me.data && <DeleteAccount requiresPassword={me.data.hasPassword} onDeleted={signOut} />}
    </section>
  );
}

function DeleteAccount({ requiresPassword, onDeleted }: { requiresPassword: boolean; onDeleted: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(requiresPassword ? password : undefined);
      await onDeleted();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <details className="mt-6 rounded-2xl border border-danger-50 p-4" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold text-danger-700">{t("profile.deleteTitle")}</summary>
      <p className="mt-2 text-sm">{t("profile.deleteHelp")}</p>
      {requiresPassword && (
        <Field id="delete-password" label={t("profile.deletePassword")} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      )}
      <FormMessage>{error}</FormMessage>
      <button type="button" className="btn mt-4 w-full bg-danger-600 text-white" disabled={busy || (requiresPassword && !password)} onClick={confirm}>
        {t("profile.deleteConfirm")}
      </button>
    </details>
  );
}
