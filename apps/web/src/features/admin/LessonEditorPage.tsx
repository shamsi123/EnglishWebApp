import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Lesson as LessonSchema } from "@englishpath/core";
import { LessonPlayer } from "../lesson/LessonPage";
import { useAdminRoles } from "./AdminShell";
import { adminApi, AdminApiError } from "./adminApi";
import { EXERCISE_TEMPLATES } from "./exerciseTemplates";

/**
 * CMS lesson editor (FR-80, FR-82): a JSON editor for the lesson content schema shared with the
 * client, with a live preview rendered through the real lesson player, and the
 * Draft → Review → Published workflow with version history and rollback.
 */
export default function LessonEditorPage() {
  const { lessonId = "" } = useParams();
  const { isAuthor, isReviewer } = useAdminRoles();
  const queryClient = useQueryClient();
  const lessonQuery = useQuery({ queryKey: ["admin", "lesson", lessonId], queryFn: () => adminApi.getLesson(lessonId) });
  const auditQuery = useQuery({ queryKey: ["admin", "audit", lessonId], queryFn: () => adminApi.getAudit(lessonId) });

  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const loadedFor = useRef<string | null>(null);

  // Seed the editor from the server once per lesson; explicit "Discard changes" re-syncs.
  const loadFromServer = () => {
    if (!lessonQuery.data) return;
    setTitle(lessonQuery.data.title);
    setContentText(JSON.stringify(lessonQuery.data.draft, null, 2));
    setJsonError(null);
  };
  useEffect(() => {
    if (lessonQuery.data && loadedFor.current !== lessonId) {
      loadedFor.current = lessonId;
      loadFromServer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonQuery.data, lessonId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "lesson", lessonId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "audit", lessonId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "outline"] });
  };

  const parseContent = (): unknown | null => {
    try {
      const parsed = JSON.parse(contentText);
      setJsonError(null);
      return parsed;
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "Invalid JSON");
      return null;
    }
  };

  const saveDraft = useMutation({
    mutationFn: async () => {
      const content = parseContent();
      if (content === null) throw new Error("Fix the JSON errors before saving.");
      return adminApi.updateLessonDraft(lessonId, title.trim(), content);
    },
    onSuccess: invalidate,
    onError: (err) => setActionError(err instanceof Error ? err.message : String(err)),
  });

  type WorkflowAction = { action: "submit" } | { action: "requestChanges" } | { action: "publish" } | { action: "rollback"; version: number };
  const workflow = useMutation({
    mutationFn: (vars: WorkflowAction) => {
      if (vars.action === "submit") return adminApi.submitForReview(lessonId);
      if (vars.action === "requestChanges") return adminApi.requestChanges(lessonId);
      if (vars.action === "publish") return adminApi.publish(lessonId);
      return adminApi.rollback(lessonId, vars.version);
    },
    onSuccess: invalidate,
    onError: (err) => setActionError(err instanceof AdminApiError ? err.message : String(err)),
  });

  const insertExercise = (type: string) => {
    const content = parseContent();
    if (content === null || typeof content !== "object") {
      setJsonError("Fix the JSON errors before inserting an exercise.");
      return;
    }
    const draft = content as { exercises?: unknown[] };
    const exercises = Array.isArray(draft.exercises) ? draft.exercises : [];
    const next = { ...draft, exercises: [...exercises, EXERCISE_TEMPLATES[type]!.make()] };
    setContentText(JSON.stringify(next, null, 2));
  };

  const formatJson = () => {
    const content = parseContent();
    if (content !== null) setContentText(JSON.stringify(content, null, 2));
  };

  if (lessonQuery.isPending) return <p className="text-slate-500">Loading…</p>;
  if (lessonQuery.isError) return <p className="text-danger-700">Couldn't load this lesson.</p>;
  const lesson = lessonQuery.data;

  const previewLesson = (() => {
    const content = (() => {
      try {
        return JSON.parse(contentText);
      } catch {
        return null;
      }
    })();
    if (content === null || typeof content !== "object") return null;
    const candidate = { id: lessonId, unitId: lesson.unitId, version: lesson.publishedVersion ?? 1, title: title || "(untitled)", kind: lesson.kind === "Checkpoint" ? "checkpoint" : "lesson", ...content };
    const result = LessonSchema.safeParse(candidate);
    return result.success ? result.data : null;
  })();

  return (
    <div>
      <Link to="/admin/outline" className="text-sm text-slate-500 hover:underline">
        ← Course outline
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Edit lesson</h1>
        <StatusBadge status={lesson.status} publishedVersion={lesson.publishedVersion} />
        {lesson.kind === "Checkpoint" && <span aria-hidden title="Checkpoint">🏆</span>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <label className="block text-sm font-medium">
            Title
            <input
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              value={title}
              disabled={lesson.status === "InReview"}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Content (JSON)</span>
            <button type="button" className="btn border border-slate-200 px-2 py-1 text-xs dark:border-slate-700" onClick={formatJson}>
              Format
            </button>
            <button type="button" className="btn border border-slate-200 px-2 py-1 text-xs dark:border-slate-700" onClick={loadFromServer}>
              Discard changes
            </button>
            <label className="text-xs">
              Insert exercise:{" "}
              <select
                className="rounded border border-slate-300 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-800"
                value=""
                disabled={lesson.status === "InReview"}
                onChange={(e) => {
                  if (e.target.value) insertExercise(e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Choose type…
                </option>
                {Object.entries(EXERCISE_TEMPLATES).map(([key, tpl]) => (
                  <option key={key} value={key}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            spellCheck={false}
            disabled={lesson.status === "InReview"}
            className="mt-2 h-96 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
          />
          {jsonError && <p className="mt-1 text-sm text-danger-700">JSON error: {jsonError}</p>}

          {lesson.draftProblems.length > 0 && (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
              <p className="font-medium text-amber-800 dark:text-amber-300">Content rules not yet met:</p>
              <ul className="mt-1 list-inside list-disc text-amber-800 dark:text-amber-300">
                {lesson.draftProblems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          {actionError && <p className="mt-3 text-sm text-danger-700">{actionError}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            {lesson.status !== "InReview" && (
              <button type="button" className="btn-primary" disabled={saveDraft.isPending} onClick={() => saveDraft.mutate()}>
                Save draft
              </button>
            )}
            <button type="button" className="btn border-2 border-slate-200 dark:border-slate-700" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? "Hide" : "Show"} live preview
            </button>
            {isAuthor && lesson.status === "Draft" && (
              <button type="button" className="btn border-2 border-brand-600 text-brand-700" onClick={() => workflow.mutate({ action: "submit" })}>
                Submit for review
              </button>
            )}
            {isReviewer && lesson.status === "InReview" && (
              <>
                <button type="button" className="btn border-2 border-slate-200 dark:border-slate-700" onClick={() => workflow.mutate({ action: "requestChanges" })}>
                  Request changes
                </button>
                <button type="button" className="btn-primary" onClick={() => workflow.mutate({ action: "publish" })}>
                  Publish
                </button>
              </>
            )}
            {lesson.status === "InReview" && !isReviewer && <p className="self-center text-sm text-slate-500">Waiting for a reviewer.</p>}
          </div>

          <VersionHistory versions={lesson.versions} isReviewer={isReviewer} onRollback={(v) => workflow.mutate({ action: "rollback", version: v })} />
          <AuditTrail entries={auditQuery.data} />
        </div>

        {showPreview && (
          <div className="lg:sticky lg:top-4 lg:self-start">
            <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">Live preview (as a learner would see it)</p>
            <div className="rounded-3xl border-2 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
              {previewLesson ? (
                <div className="max-h-[80vh] overflow-y-auto">
                  <LessonPlayer key={contentText} lesson={previewLesson} exitTo={`/admin/lessons/${lessonId}`} />
                </div>
              ) : (
                <p className="p-6 text-sm text-slate-500">
                  The content doesn't fully match the lesson format yet (8–15 exercises, one listening item, valid answers). Fix the issues above to see the
                  preview.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, publishedVersion }: { status: string; publishedVersion: number | null }) {
  const style =
    status === "Published"
      ? "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-400"
      : status === "InReview"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return <span className={`rounded-full px-3 py-1 text-sm font-medium ${style}`}>{status === "Published" ? `Published v${publishedVersion}` : status}</span>;
}

function VersionHistory({
  versions,
  isReviewer,
  onRollback,
}: {
  versions: { version: number; publishedAt: string; publishedBy: string; rolledBackFrom: number | null }[];
  isReviewer: boolean;
  onRollback: (version: number) => void;
}) {
  if (versions.length === 0) return null;
  const latest = Math.max(...versions.map((v) => v.version));
  return (
    <details className="mt-6 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <summary className="cursor-pointer text-sm font-medium">Version history ({versions.length})</summary>
      <ul className="mt-2 divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {versions.map((v) => (
          <li key={v.version} className="flex items-center justify-between gap-2 py-2">
            <span>
              v{v.version} · {new Date(v.publishedAt).toLocaleString()}
              {v.rolledBackFrom !== null && <span className="text-slate-400"> (rollback of v{v.rolledBackFrom})</span>}
            </span>
            {isReviewer && v.version !== latest && (
              <button type="button" className="text-brand-700 hover:underline dark:text-brand-500" onClick={() => onRollback(v.version)}>
                Roll back to this
              </button>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function AuditTrail({ entries }: { entries: { at: string; actorId: string; action: string }[] | undefined }) {
  if (!entries || entries.length === 0) return null;
  return (
    <details className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <summary className="cursor-pointer text-sm font-medium">Audit trail ({entries.length})</summary>
      <ul className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
        {entries.map((e, i) => (
          <li key={i}>
            {new Date(e.at).toLocaleString()} — {e.action} — {e.actorId.slice(0, 8)}
          </li>
        ))}
      </ul>
    </details>
  );
}
