import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api";
import { auth } from "../../shared/auth";
import { localDay } from "../../shared/dates";
import { AuthScreen, Field, FormMessage, errorMessage } from "../../shared/Form";
import { t } from "../../shared/i18n";

// Identity & onboarding screens (FR-01–05). All state lives on the server; these pages only call the API.

export function WelcomePage() {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-full max-w-player flex-col justify-between px-4 py-12">
      <div className="mt-16 text-center">
        <p className="text-6xl" aria-hidden>
          🌍
        </p>
        <h1 className="mt-6 text-3xl font-bold">EnglishPath</h1>
        <p className="mt-2 text-lg text-slate-600 dark:text-slate-400">{t("welcome.tagline")}</p>
      </div>
      <div className="grid gap-3">
        <Link to="/sign-up" className="btn-primary">
          {t("welcome.start")}
        </Link>
        <Link to="/sign-in" className="btn border-2 border-slate-200 dark:border-slate-700">
          {t("welcome.haveAccount")}
        </Link>
        {/* FR-03 guest mode: one lesson before sign-up. */}
        <Link to="/try" className="btn text-brand-700 dark:text-brand-500">
          {t("welcome.tryLesson")}
        </Link>
      </div>
    </main>
  );
}

function useSubmit(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

export function SignInPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, submit } = useSubmit(async () => {
    await auth.signInWithPassword(email.trim(), password);
    navigate("/learn", { replace: true });
  });

  return (
    <AuthScreen title={t("auth.signInTitle")}>
      <form onSubmit={submit} noValidate>
        <Field id="email" label={t("auth.email")} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="password" label={t("auth.password")} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormMessage>{error}</FormMessage>
        <button type="submit" className="btn-primary mt-6 w-full" disabled={busy || !email || !password}>
          {t("auth.signIn")}
        </button>
      </form>
      <div className="mt-6 flex flex-col items-center gap-2">
        <Link to="/forgot-password" className="btn text-brand-700 dark:text-brand-500">
          {t("auth.forgot")}
        </Link>
        <Link to="/sign-up" className="btn text-brand-700 dark:text-brand-500">
          {t("auth.noAccount")}
        </Link>
      </div>
    </AuthScreen>
  );
}

/** Mirrors the server's age rules for the form only; the server decides (AgePolicy). */
function ageOn(dateOfBirth: string, today = new Date()): number | null {
  const dob = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  let age = today.getFullYear() - dob.getFullYear();
  const beforeBirthday = today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function SignUpPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", dateOfBirth: "", guardianEmail: "", acceptedTerms: false });
  const [waitingForGuardian, setWaitingForGuardian] = useState(false);
  const age = form.dateOfBirth ? ageOn(form.dateOfBirth) : null;
  const isMinor = age !== null && age >= 13 && age < 18;

  const { busy, error, submit } = useSubmit(async () => {
    const result = await api.register({
      email: form.email.trim(),
      password: form.password,
      dateOfBirth: form.dateOfBirth,
      guardianEmail: isMinor ? form.guardianEmail.trim() : undefined,
      acceptedTerms: form.acceptedTerms,
    });
    if (result.requiresGuardianConsent) {
      setWaitingForGuardian(true);
      return;
    }
    await auth.signInWithPassword(form.email.trim(), form.password);
    navigate("/onboarding", { replace: true });
  });

  if (waitingForGuardian) {
    return (
      <AuthScreen title={t("auth.signUpTitle")}>
        <FormMessage tone="info">{t("auth.waitingGuardian")}</FormMessage>
        <Link to="/sign-in" className="btn-primary mt-6">
          {t("auth.signIn")}
        </Link>
      </AuthScreen>
    );
  }

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <AuthScreen title={t("auth.signUpTitle")}>
      <form onSubmit={submit} noValidate>
        <Field id="email" label={t("auth.email")} type="email" autoComplete="email" inputMode="email" required value={form.email} onChange={(e) => update({ email: e.target.value })} />
        <Field
          id="password"
          label={t("auth.password")}
          hint={t("auth.passwordHint")}
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          value={form.password}
          onChange={(e) => update({ password: e.target.value })}
        />
        <Field id="dob" label={t("auth.dateOfBirth")} type="date" max={localDay()} required value={form.dateOfBirth} onChange={(e) => update({ dateOfBirth: e.target.value })} />
        {isMinor && (
          <Field
            id="guardian"
            label={t("auth.guardianEmail")}
            hint={t("auth.guardianHelp")}
            type="email"
            inputMode="email"
            required
            value={form.guardianEmail}
            onChange={(e) => update({ guardianEmail: e.target.value })}
          />
        )}
        <label className="mt-6 flex min-h-touch items-center gap-3">
          <input type="checkbox" className="h-6 w-6 accent-brand-600" checked={form.acceptedTerms} onChange={(e) => update({ acceptedTerms: e.target.checked })} />
          <span>{t("auth.terms")}</span>
        </label>
        <FormMessage>{error}</FormMessage>
        <button
          type="submit"
          className="btn-primary mt-6 w-full"
          disabled={busy || !form.email || form.password.length < 12 || !form.dateOfBirth || !form.acceptedTerms || (isMinor && !form.guardianEmail)}
        >
          {t("auth.signUp")}
        </button>
      </form>
      <Link to="/sign-in" className="btn mt-4 text-brand-700 dark:text-brand-500">
        {t("welcome.haveAccount")}
      </Link>
    </AuthScreen>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { busy, error, submit } = useSubmit(async () => {
    await api.forgotPassword(email.trim());
    setSent(true);
  });
  return (
    <AuthScreen title={t("auth.forgotTitle")}>
      {sent ? (
        <FormMessage tone="info">{t("auth.forgotSent")}</FormMessage>
      ) : (
        <form onSubmit={submit} noValidate>
          <Field id="email" label={t("auth.email")} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormMessage>{error}</FormMessage>
          <button type="submit" className="btn-primary mt-6 w-full" disabled={busy || !email}>
            {t("auth.forgotSend")}
          </button>
        </form>
      )}
      <Link to="/sign-in" className="btn mt-4 text-brand-700 dark:text-brand-500">
        {t("auth.back")}
      </Link>
    </AuthScreen>
  );
}

function useLinkParams() {
  const [params] = useSearchParams();
  return { userId: params.get("userId") ?? "", token: params.get("token") ?? "" };
}

export function ResetPasswordPage() {
  const { userId, token } = useLinkParams();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const { busy, error, submit } = useSubmit(async () => {
    await api.resetPassword(userId, token, password);
    setDone(true);
  });
  return (
    <AuthScreen title={t("auth.resetTitle")}>
      {done ? (
        <>
          <FormMessage tone="info">{t("auth.resetDone")}</FormMessage>
          <Link to="/sign-in" className="btn-primary mt-6">
            {t("auth.signIn")}
          </Link>
        </>
      ) : (
        <form onSubmit={submit} noValidate>
          <Field
            id="password"
            label={t("auth.newPassword")}
            hint={t("auth.passwordHint")}
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FormMessage>{error}</FormMessage>
          <button type="submit" className="btn-primary mt-6 w-full" disabled={busy || password.length < 12 || !token}>
            {t("auth.continue")}
          </button>
        </form>
      )}
    </AuthScreen>
  );
}

export function VerifyEmailPage() {
  const { userId, token } = useLinkParams();
  const [state, setState] = useState<"pending" | "done" | "failed">("pending");
  const started = useRef(false);
  useEffect(() => {
    // Guard against React StrictMode's double effect: tokens are single-use.
    if (started.current) return;
    started.current = true;
    api.verifyEmail(userId, token).then(
      () => setState("done"),
      () => setState("failed"),
    );
  }, [userId, token]);
  return (
    <AuthScreen title={t("auth.email")}>
      {state === "pending" && <p className="mt-4">{t("auth.verifying")}</p>}
      {state === "done" && <FormMessage tone="info">{t("auth.verified")}</FormMessage>}
      {state === "failed" && <FormMessage>{t("auth.linkInvalid")}</FormMessage>}
      <Link to="/learn" className="btn-primary mt-6">
        {t("auth.continue")}
      </Link>
    </AuthScreen>
  );
}

export function GuardianConsentPage() {
  const { userId, token } = useLinkParams();
  const [result, setResult] = useState<"approved" | "declined" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = async (granted: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await api.guardianConsent(userId, token, granted);
      setResult(granted ? "approved" : "declined");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title={t("guardian.title")}>
      {result ? (
        <FormMessage tone="info">{t(result === "approved" ? "guardian.approved" : "guardian.declined")}</FormMessage>
      ) : (
        <>
          <p className="mt-4">{t("guardian.body")}</p>
          <FormMessage>{error}</FormMessage>
          <div className="mt-6 grid gap-3">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => decide(true)}>
              {t("guardian.approve")}
            </button>
            <button type="button" className="btn border-2 border-danger-600 text-danger-700" disabled={busy} onClick={() => decide(false)}>
              {t("guardian.decline")}
            </button>
          </div>
        </>
      )}
    </AuthScreen>
  );
}
