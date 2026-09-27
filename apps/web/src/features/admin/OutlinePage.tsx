import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { adminApi, CEFR_LEVELS, type CefrLevel, type DraftStatus, type LessonKind } from "./adminApi";
import { EMPTY_LESSON_CONTENT } from "./exerciseTemplates";
import { useAdminRoles } from "./AdminShell";

const STATUS_STYLE: Record<DraftStatus, string> = {
  Draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  InReview: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Published: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-400",
};

/** CMS course tree: every unit and lesson, drafts included (FR-80). */
export default function OutlinePage() {
  const { isAuthor } = useAdminRoles();
  const queryClient = useQueryClient();
  const outline = useQuery({ queryKey: ["admin", "outline"], queryFn: () => adminApi.getOutline() });
  const [addingUnit, setAddingUnit] = useState(false);
  const [addingLessonTo, setAddingLessonTo] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "outline"] });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Course outline</h1>
        {isAuthor && (
          <button type="button" className="btn-primary" onClick={() => setAddingUnit(true)}>
            + New unit
          </button>
        )}
      </div>

      {addingUnit && <NewUnitForm onDone={() => setAddingUnit(false)} onCreated={refresh} />}

      {outline.isPending && <p className="mt-6 text-slate-500">Loading…</p>}
      {outline.isError && <p className="mt-6 text-danger-700">Couldn't load the course outline.</p>}

      <div className="mt-6 space-y-6">
        {CEFR_LEVELS.map((level) => {
          const units = (outline.data ?? []).filter((u) => u.level === level).sort((a, b) => a.order - b.order);
          if (units.length === 0) return null;
          return (
            <section key={level}>
              <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">{level}</h2>
              <div className="mt-2 space-y-3">
                {units.map((unit) => (
                  <div key={unit.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">
                        {unit.title} <span className="text-sm text-slate-400">#{unit.order}</span>
                      </h3>
                      {isAuthor && (
                        <button type="button" className="text-sm text-brand-700 hover:underline dark:text-brand-500" onClick={() => setAddingLessonTo(unit.id)}>
                          + Add lesson
                        </button>
                      )}
                    </div>
                    {addingLessonTo === unit.id && (
                      <NewLessonForm unitId={unit.id} nextOrder={unit.lessons.length} onDone={() => setAddingLessonTo(null)} onCreated={refresh} />
                    )}
                    <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                      {unit.lessons.length === 0 && <li className="py-2 text-sm text-slate-400">No lessons yet.</li>}
                      {unit.lessons.map((lesson) => (
                        <li key={lesson.id} className="flex items-center justify-between gap-3 py-2">
                          <Link to={`/admin/lessons/${lesson.id}`} className="flex min-w-0 items-center gap-2 hover:underline">
                            {lesson.kind === "Checkpoint" && <span aria-hidden>🏆</span>}
                            <span className="truncate">{lesson.title}</span>
                          </Link>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[lesson.status]}`}>
                            {lesson.status === "Published" ? `Published v${lesson.publishedVersion}` : lesson.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
        {outline.data?.length === 0 && <p className="text-slate-500">No units yet. Create one to get started.</p>}
      </div>
    </div>
  );
}

function NewUnitForm({ onDone, onCreated }: { onDone: () => void; onCreated: () => void }) {
  const [level, setLevel] = useState<CefrLevel>("PreA1");
  const [order, setOrder] = useState(0);
  const [title, setTitle] = useState("");
  const mutation = useMutation({
    mutationFn: () => adminApi.createUnit(level, order, title.trim()),
    onSuccess: () => {
      onCreated();
      onDone();
    },
  });

  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <label className="text-sm">
        Level
        <select className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800" value={level} onChange={(e) => setLevel(e.target.value as CefrLevel)}>
          {CEFR_LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Order
        <input type="number" className="mt-1 block w-20 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800" value={order} onChange={(e) => setOrder(Number(e.target.value))} />
      </label>
      <label className="flex-1 text-sm">
        Title
        <input required className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <button type="submit" className="btn-primary" disabled={mutation.isPending || !title.trim()}>
        Create
      </button>
      <button type="button" className="btn" onClick={onDone}>
        Cancel
      </button>
      {mutation.isError && <p className="w-full text-sm text-danger-700">{(mutation.error as Error).message}</p>}
    </form>
  );
}

function NewLessonForm({ unitId, nextOrder, onDone, onCreated }: { unitId: string; nextOrder: number; onDone: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<LessonKind>("Lesson");
  const mutation = useMutation({
    mutationFn: () => adminApi.createLesson(unitId, nextOrder, title.trim(), EMPTY_LESSON_CONTENT, kind),
    onSuccess: () => {
      onCreated();
      onDone();
    },
  });

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <label className="flex-1 text-sm">
        Title
        <input required className="mt-1 block w-full rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="text-sm">
        Kind
        <select className="mt-1 block rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-800" value={kind} onChange={(e) => setKind(e.target.value as LessonKind)}>
          <option value="Lesson">Lesson</option>
          <option value="Checkpoint">Checkpoint</option>
        </select>
      </label>
      <button type="submit" className="btn-primary" disabled={mutation.isPending || !title.trim()}>
        Create draft
      </button>
      <button type="button" className="btn" onClick={onDone}>
        Cancel
      </button>
      {mutation.isError && <p className="w-full text-sm text-danger-700">{(mutation.error as Error).message}</p>}
    </form>
  );
}
