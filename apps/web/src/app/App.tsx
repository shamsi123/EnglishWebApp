import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from "react-router-dom";
import { AppShell } from "./AppShell";
import { LearnPage } from "../features/learn/LearnPage";
import { flushCompletions } from "../features/lesson/completionQueue";
import { api } from "../shared/api";
import { restoreSession, useAuthStore } from "../shared/auth";

// Route-level code splitting keeps the initial bundle small (NFR-02).
const LessonPage = lazy(() => import("../features/lesson/LessonPage"));
const TryLessonPage = lazy(() => import("../features/lesson/LessonPage").then((m) => ({ default: m.TryLessonPage })));
const ReviewPage = lazy(() => import("../features/review/ReviewPage"));
const ProfilePage = lazy(() => import("../features/profile/ProfilePage"));
const OnboardingPage = lazy(() => import("../features/onboarding/OnboardingPage"));
const PlacementPage = lazy(() => import("../features/placement/PlacementPage"));
const authPage = (name: keyof typeof import("../features/auth/AuthPages")) =>
  lazy(() => import("../features/auth/AuthPages").then((m) => ({ default: m[name] })));
const WelcomePage = authPage("WelcomePage");
const SignInPage = authPage("SignInPage");
const SignUpPage = authPage("SignUpPage");
const ForgotPasswordPage = authPage("ForgotPasswordPage");
const ResetPasswordPage = authPage("ResetPasswordPage");
const VerifyEmailPage = authPage("VerifyEmailPage");
const GuardianConsentPage = authPage("GuardianConsentPage");

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

function Skeleton() {
  return <div className="m-4 h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" aria-hidden />;
}

const lazyPage = (page: ReactNode) => <Suspense fallback={<Skeleton />}>{page}</Suspense>;

/** Signed-in area. While the stored session is being restored, show a skeleton rather than flashing the welcome page. */
function RequireAuth() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === "restoring") return <Skeleton />;
  if (status === "signedOut") return <Navigate to="/welcome" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Sends new learners through onboarding (FR-02). Offline or on error, let them keep learning. */
function RequireOnboarding() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.getMe() });
  if (me.isPending) return <Skeleton />;
  if (me.data && me.data.onboarding === null) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

function SignedOutOnly() {
  const status = useAuthStore((s) => s.status);
  if (status === "restoring") return <Skeleton />;
  if (status === "signedIn") return <Navigate to="/learn" replace />;
  return <Outlet />;
}

const router = createBrowserRouter([
  {
    element: <SignedOutOnly />,
    children: [
      { path: "welcome", element: lazyPage(<WelcomePage />) },
      { path: "sign-in", element: lazyPage(<SignInPage />) },
      { path: "sign-up", element: lazyPage(<SignUpPage />) },
      { path: "forgot-password", element: lazyPage(<ForgotPasswordPage />) },
    ],
  },
  // FR-03 guest lesson; also offered to signed-in learners when the course can't load.
  { path: "try", element: lazyPage(<TryLessonPage />) },
  // Email links work whether or not the reader is signed in (the guardian usually isn't).
  { path: "reset-password", element: lazyPage(<ResetPasswordPage />) },
  { path: "verify-email", element: lazyPage(<VerifyEmailPage />) },
  { path: "guardian-consent", element: lazyPage(<GuardianConsentPage />) },
  {
    element: <RequireAuth />,
    children: [
      { path: "onboarding", element: lazyPage(<OnboardingPage />) },
      {
        element: <RequireOnboarding />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/learn" replace /> },
              { path: "learn", element: <LearnPage /> },
              { path: "review", element: lazyPage(<ReviewPage />) },
              { path: "profile", element: lazyPage(<ProfilePage />) },
            ],
          },
          // The lesson player and placement test are full-screen: one task per screen, no tab bar (BRD §9).
          { path: "lesson/:lessonId", element: lazyPage(<LessonPage />) },
          { path: "placement", element: lazyPage(<PlacementPage />) },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

async function syncQueued() {
  const synced = await flushCompletions().catch(() => 0);
  if (synced > 0) await queryClient.invalidateQueries();
}

export function App() {
  useEffect(() => {
    restoreSession().then(() => {
      if (useAuthStore.getState().status === "signedIn") void syncQueued();
    });
    // NFR-05: answers completed offline sync when the connection returns.
    const onOnline = () => void syncQueued();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
