import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ParentGate } from '@/features/auth/ParentGate';
import { useActiveChild, useStore } from '@/lib/store';
import { Mascot } from '@/ui/Mascot';
import { Button } from '@/ui/Button';
import { PhoneFrame } from './PhoneFrame';
import { useBreakReason, useChildSession } from './useChildSession';

const Welcome = lazy(() => import('@/features/welcome/WelcomeScreen'));
const Auth = lazy(() => import('@/features/auth/AuthScreen'));
const Profiles = lazy(() => import('@/features/profiles/ProfilesScreen'));
const NewProfile = lazy(() => import('@/features/profiles/NewProfileScreen'));
const PinEntry = lazy(() => import('@/features/profiles/PinScreen'));
const Courses = lazy(() => import('@/features/courses/CoursesScreen'));
const Journey = lazy(() => import('@/features/journey/JourneyScreen'));
const Lesson = lazy(() => import('@/features/lesson/LessonScreen'));
const Garden = lazy(() => import('@/features/review/GardenScreen'));
const Stickers = lazy(() => import('@/features/rewards/StickerBookScreen'));
const Parent = lazy(() => import('@/features/parent/ParentDashboard'));

function Loading() {
  return <div className="flex h-full items-center justify-center text-6xl animate-bob">🐪</div>;
}

function RequireParent({ children }: { children: ReactNode }) {
  const signedIn = useStore((s) => s.parentSignedIn && !!s.parent);
  return signedIn ? <>{children}</> : <Navigate to="/signin" replace />;
}

function RequireChild({ children }: { children: ReactNode }) {
  const { child } = useActiveChild();
  const reason = useBreakReason();
  if (!child) return <Navigate to="/profiles" replace />;
  if (reason) return <BreakScreen reason={reason} />;
  return <>{children}</>;
}

function Gated({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return <ParentGate onCancel={() => navigate('/profiles')}>{children}</ParentGate>;
}

function BreakScreen({ reason }: { reason: 'limit' | 'quiet' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const select = useStore((s) => s.selectChild);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-sky2-100 p-6 text-center">
      <Mascot size="lg" says={reason === 'quiet' ? t('break.quiet') : t('break.title')} speakLang="en" />
      <p className="text-xl font-bold">{t('break.body')}</p>
      <Button
        variant="secondary"
        onClick={() => {
          select(null);
          navigate('/profiles');
        }}
      >
        👋 {t('common.close')}
      </Button>
    </div>
  );
}

function Shell() {
  useChildSession();
  const { settings } = useActiveChild();
  return (
    <div className={`h-full ${settings.highContrast ? 'high-contrast' : ''}`}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route path="/signin" element={<Auth mode="signin" />} />
          <Route path="/profiles" element={<RequireParent><Profiles /></RequireParent>} />
          <Route path="/profiles/new" element={<RequireParent><Gated><NewProfile /></Gated></RequireParent>} />
          <Route path="/profiles/:childId/pin" element={<RequireParent><PinEntry /></RequireParent>} />
          <Route path="/courses" element={<RequireChild><Courses /></RequireChild>} />
          <Route path="/journey/:courseId" element={<RequireChild><Journey /></RequireChild>} />
          <Route path="/lesson/:nodeId" element={<RequireChild><Lesson /></RequireChild>} />
          <Route path="/garden" element={<RequireChild><Garden /></RequireChild>} />
          <Route path="/stickers" element={<RequireChild><Stickers /></RequireChild>} />
          <Route path="/parent" element={<RequireParent><Gated><Parent /></Gated></RequireParent>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <PhoneFrame>
        <Shell />
      </PhoneFrame>
    </BrowserRouter>
  );
}
