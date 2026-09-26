import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/lib/store';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

const input = 'min-h-tap w-full rounded-2xl border-2 border-grape-200 bg-white px-4 text-lg outline-none focus:border-grape-500';

/** Screen 2 — Parent sign-up / sign-in with the consent step (FR-01, COPPA/GDPR-K consent). */
export default function AuthScreen({ mode }: { mode: 'signup' | 'signin' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useStore((s) => s.registerParent);
  const signIn = useStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'signup') {
      if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !consent) return setError(t('auth.invalid'));
      await register(email, password);
      navigate('/profiles/new');
    } else {
      if (!(await signIn(email, password))) return setError(t('auth.wrongCredentials'));
      navigate('/profiles');
    }
  };

  return (
    <Screen title={mode === 'signup' ? t('auth.signUpTitle') : t('auth.signInTitle')} back="/" bg="bg-grape-50">
      <form onSubmit={submit} className="flex flex-col gap-4 pt-4" noValidate>
        <div className="mb-2 flex justify-center text-7xl">👨‍👩‍👧</div>
        <label className="flex flex-col gap-1 font-bold">
          {t('auth.email')}
          <input className={input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 font-bold">
          {t('auth.password')}
          <input
            className={input}
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {mode === 'signup' && <span className="text-sm font-medium text-ink/60">{t('auth.passwordHint')}</span>}
        </label>
        {mode === 'signup' && (
          <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-base font-medium leading-snug">
            <input type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-grape-600" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>🛡️ {t('auth.consent')}</span>
          </label>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-coral-100 p-3 font-bold text-coral-500">
            {error}
          </p>
        )}
        <Button type="submit" block>
          {mode === 'signup' ? t('auth.createAccount') : t('auth.signIn')}
        </Button>
        <Button variant="ghost" block onClick={() => navigate(mode === 'signup' ? '/signin' : '/signup')}>
          {mode === 'signup' ? t('auth.haveAccount') : t('auth.noAccount')}
        </Button>
      </form>
    </Screen>
  );
}
