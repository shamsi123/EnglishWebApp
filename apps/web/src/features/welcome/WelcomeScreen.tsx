import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { speak } from '@/engine/audio';
import { useStore } from '@/lib/store';
import { ArabicText } from '@/ui/ArabicText';
import { Button } from '@/ui/Button';

/** Screen 1 — Splash / Welcome: mascots and language picker. */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const signedIn = useStore((s) => s.parentSignedIn && !!s.parent);
  const [lang, setLang] = useState<'ar' | 'hi'>('ar');

  return (
    <div className="flex h-full flex-col items-center justify-between bg-gradient-to-b from-grape-600 via-grape-400 to-sun-300 px-6 pb-safe pt-safe text-white">
      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <div className="flex items-end gap-2">
          <button type="button" aria-label="Jamal" className="text-8xl animate-bob" onClick={() => speak(t('welcome.greeting'))}>
            🐪
          </button>
          <span className="text-6xl animate-bob opacity-80" style={{ animationDelay: '0.6s' }}>
            🐘
          </span>
        </div>
        <h1 className="text-6xl font-extrabold tracking-tight drop-shadow">KidsLang</h1>
        <p className="text-xl font-bold opacity-95">{t('welcome.tagline')}</p>
      </div>

      <div className="w-full rounded-blob bg-white/95 p-5 text-ink shadow-xl">
        <p className="mb-4 text-center text-xl font-extrabold">{t('welcome.pickLanguage')}</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={lang === 'ar'}
            onClick={() => setLang('ar')}
            className={`flex flex-col items-center gap-1 rounded-3xl p-4 ${lang === 'ar' ? 'bg-sun-100 ring-4 ring-sun-400' : 'bg-grape-50'}`}
          >
            <ArabicText className="whitespace-nowrap text-4xl font-bold leading-tight text-grape-700">أ ب ت</ArabicText>
            <span className="text-lg font-extrabold">{t('welcome.arabic')}</span>
          </button>
          <button type="button" disabled className="relative flex flex-col items-center gap-1 rounded-3xl bg-gray-100 p-4 opacity-60">
            <span lang="hi" className="whitespace-nowrap text-4xl font-bold leading-tight">अ आ इ</span>
            <span className="text-lg font-extrabold">{t('welcome.hindi')}</span>
            <span className="absolute -top-2 end-2 rounded-full bg-coral-400 px-2 text-xs font-extrabold text-white">{t('welcome.comingSoon')}</span>
          </button>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button block variant="success" onClick={() => navigate(signedIn ? '/profiles' : '/signup')}>
          {t('welcome.start')} 🚀
        </Button>
        <Button block variant="ghost" className="text-white" onClick={() => navigate('/signin')}>
          🔒 {t('common.grownUps')}
        </Button>
      </div>
    </div>
  );
}
