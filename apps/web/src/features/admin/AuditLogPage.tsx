import { useQuery } from "@tanstack/react-query";
import { adminApi } from "./adminApi";

/** Global admin action log (FR-92): who did what, and when. */
export default function AuditLogPage() {
  const audit = useQuery({ queryKey: ["admin", "audit", "all"], queryFn: () => adminApi.getAudit(undefined, 200) });

  return (
    <div>
      <h1 className="text-2xl font-bold">Audit log</h1>
      <p className="mt-1 text-sm text-slate-500">The most recent 200 content-management actions across the service.</p>

      {audit.isPending && <p className="mt-6 text-slate-500">Loading…</p>}
      {audit.isError && <p className="mt-6 text-danger-700">Couldn't load the audit log.</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
              <th className="py-2 pr-4 font-medium">When</th>
              <th className="py-2 pr-4 font-medium">Action</th>
              <th className="py-2 pr-4 font-medium">Target</th>
              <th className="py-2 font-medium">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
            {audit.data?.map((entry, i) => (
              <tr key={i}>
                <td className="py-2 pr-4 whitespace-nowrap">{new Date(entry.at).toLocaleString()}</td>
                <td className="py-2 pr-4 font-mono text-xs">{entry.action}</td>
                <td className="py-2 pr-4 font-mono text-xs">{entry.target ?? "—"}</td>
                <td className="py-2 font-mono text-xs">{entry.actorId.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {audit.data?.length === 0 && <p className="mt-4 text-slate-500">No admin actions recorded yet.</p>}
      </div>
    </div>
  );
}
