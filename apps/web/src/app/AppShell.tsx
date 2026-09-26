import { NavLink, Outlet } from "react-router-dom";
import { t, type MessageKey } from "../shared/i18n";

// Phase 1 tabs. Speak and Leaderboard arrive in Phase 2 (FR-40, FR-52).
const tabs: Array<{ to: string; label: MessageKey; icon: string }> = [
  { to: "/learn", label: "nav.learn", icon: "🏠" },
  { to: "/review", label: "nav.review", icon: "🔁" },
  { to: "/profile", label: "nav.profile", icon: "👤" },
];

/** Bottom tab bar on phones, left sidebar from 1024 px (BRD §9). */
export function AppShell() {
  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950
          lg:static lg:w-60 lg:border-e lg:border-t-0 lg:pb-0 lg:pt-6"
      >
        <ul className="flex justify-around lg:flex-col lg:gap-1 lg:px-3">
          {tabs.map((tab) => (
            <li key={tab.to} className="flex-1 lg:flex-none">
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  `flex min-h-touch flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium lg:flex-row lg:justify-start lg:gap-3 lg:rounded-xl lg:px-4 lg:text-base ${
                    isActive ? "text-brand-700 dark:text-brand-500 lg:bg-brand-50 dark:lg:bg-slate-900" : "text-slate-500"
                  }`
                }
              >
                <span aria-hidden className="text-xl">{tab.icon}</span>
                {t(tab.label)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="pt-safe flex-1 pb-24 lg:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
