import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, CEFR_LEVELS, type CefrLevel } from "./adminApi";
import { EXERCISE_TEMPLATES } from "./exerciseTemplates";
import { useAdminRoles } from "./AdminShell";

/** Question types allowed for placement (FR-10): the answer key can be withheld from the client. */
const ALLOWED_TYPES = ["multipleChoice", "listenSelect", "imageWord", "fillBlank"] as const;

/** Placement item bank (FR-10). Answer keys are never shown to learners; this screen manages the pool of questions. */
export default function PlacementItemsPage() {
  const { isAuthor } = useAdminRoles();
  const queryClient = useQueryClient();
  const [level, setLevel] = useState<CefrLevel | undefined>(undefined);
  const items = useQuery({ queryKey: ["admin", "placement-items", level], queryFn: () => adminApi.listPlacementItems(level) });
  const [showForm, setShowForm] = useState(false);
  const [newLevel, setNewLevel] = useState<CefrLevel>("PreA1");
  const [text, setText] = useState(() => JSON.stringify(EXERCISE_TEMPLATES.multipleChoice!.make(), null, 2));
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "placement-items"] });

  const create = useMutation({
    mutationFn: () => {
      let exercise: unknown;
      try {
        exercise = JSON.parse(text);
      } catch (err) {
        throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
      }
      return adminApi.createPlacementItem(newLevel, exercise);
    },
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  const retire = useMutation({
    mutationFn: (id: string) => adminApi.retirePlacementItem(id),
    onSuccess: invalidate,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Placement items</h1>
        {isAuthor && (
          <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            + New item
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">
        The placement test (FR-10) scores answers on the server, so only question types whose answer is a choice work here: multiple choice, listen &amp; select, image &amp; word, or fill
        in the blank. Tag each item with one of grammar, vocabulary, reading or listening.
      </p>

      {showForm && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm">
              Level
              <select className="ml-2 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800" value={newLevel} onChange={(e) => setNewLevel(e.target.value as CefrLevel)}>
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Template
              <select
                className="ml-2 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800"
                onChange={(e) => setText(JSON.stringify(EXERCISE_TEMPLATES[e.target.value]!.make(), null, 2))}
              >
                {ALLOWED_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EXERCISE_TEMPLATES[type]!.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            spellCheck={false}
            className="mt-3 h-56 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <p className="mt-1 text-sm text-danger-700">{error}</p>}
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-primary" disabled={create.isPending} onClick={() => create.mutate()}>
              Create
            </button>
            <button type="button" className="btn" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={`rounded-full px-3 py-1 text-sm ${!level ? "bg-brand-600 text-white" : "border border-slate-200 dark:border-slate-700"}`} onClick={() => setLevel(undefined)}>
          All levels
        </button>
        {CEFR_LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${level === l ? "bg-brand-600 text-white" : "border border-slate-200 dark:border-slate-700"}`}
            onClick={() => setLevel(l)}
          >
            {l}
          </button>
        ))}
      </div>

      {items.isPending && <p className="mt-6 text-slate-500">Loading…</p>}
      <ul className="mt-4 space-y-2">
        {items.data?.map((item) => (
          <li key={item.id} className={`rounded-xl border p-3 ${item.isActive ? "border-slate-200 dark:border-slate-800" : "border-slate-100 opacity-50 dark:border-slate-900"}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">
                <span className="font-medium">{item.level}</span> · {item.skill} · <span className="text-slate-400">{(item.exercise as { type?: string }).type}</span>
              </span>
              {isAuthor && item.isActive && (
                <button type="button" className="text-sm text-danger-700 hover:underline" onClick={() => retire.mutate(item.id)}>
                  Retire
                </button>
              )}
              {!item.isActive && <span className="text-xs text-slate-400">Retired</span>}
            </div>
            <p className="mt-1 text-sm">{(item.exercise as { prompt?: string }).prompt}</p>
          </li>
        ))}
        {items.data?.length === 0 && <p className="text-slate-500">No placement items yet.</p>}
      </ul>
    </div>
  );
}
