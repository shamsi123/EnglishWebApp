import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { api } from "../../shared/api";

/** FR-91 roles that may see the CMS at all; each screen further narrows by author/reviewer. */
const ADMIN_ROLES = ["ContentAuthor", "Reviewer", "SuperAdmin", "Support"];

const tabs = [
  { to: "/admin/outline", label: "Course outline" },
  { to: "/admin/media", label: "Media library" },
  { to: "/admin/placement", label: "Placement items" },
  { to: "/admin/import-export", label: "Import / export" },
  { to: "/admin/audit", label: "Audit log" },
];

export function useAdminRoles() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.getMe() });
  const roles = me.data?.roles ?? [];
  return {
    isLoading: me.isPending,
    isAuthor: roles.includes("ContentAuthor") || roles.includes("SuperAdmin"),
    isReviewer: roles.includes("Reviewer") || roles.includes("SuperAdmin"),
    hasAdminAccess: roles.some((r) => ADMIN_ROLES.includes(r)),
  };
}

/**
 * CMS layout (FR-80). Lives under /admin in the learner PWA but is code-split so learners never
 * download it (NFR-02); gated on a content-team role from Identity (FR-91).
 */
export function AdminShell() {
  const { isLoading, hasAdminAccess } = useAdminRoles();
  const location = useLocation();

  if (isLoading) return <div className="p-6">Loading…</div>;
  if (!hasAdminAccess) return <Navigate to="/learn" replace state={{ from: location.pathname }} />;

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <nav aria-label="CMS" className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 lg:w-56 lg:border-b-0 lg:border-e lg:px-3 lg:py-6">
        <Link to="/learn" className="mb-4 hidden text-sm text-slate-500 hover:underline lg:block">
          ← Back to app
        </Link>
        <ul className="flex gap-1 overflow-x-auto lg:flex-col">
          {tabs.map((tab) => (
            <li key={tab.to} className="shrink-0">
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  `block rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap ${
                    isActive ? "bg-brand-50 text-brand-700 dark:bg-slate-900 dark:text-brand-500" : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900"
                  }`
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="min-w-0 flex-1 p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  );
}
