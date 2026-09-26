import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { AppShell } from "./AppShell";
import { LearnPage } from "../features/learn/LearnPage";

// Route-level code splitting keeps the initial bundle small (NFR-02).
const LessonPage = lazy(() => import("../features/lesson/LessonPage"));
const ReviewPage = lazy(() => import("../features/review/ReviewPage"));
const ProfilePage = lazy(() => import("../features/profile/ProfilePage"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

function Skeleton() {
  return <div className="m-4 h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" aria-hidden />;
}

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/learn" replace /> },
      { path: "learn", element: <LearnPage /> },
      { path: "review", element: <Suspense fallback={<Skeleton />}><ReviewPage /></Suspense> },
      { path: "profile", element: <Suspense fallback={<Skeleton />}><ProfilePage /></Suspense> },
    ],
  },
  // The lesson player is full-screen: one task per screen, no tab bar (BRD §9).
  { path: "lesson/:lessonId", element: <Suspense fallback={<Skeleton />}><LessonPage /></Suspense> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
