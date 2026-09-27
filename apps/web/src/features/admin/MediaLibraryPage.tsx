import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, AdminApiError } from "./adminApi";
import { useAdminRoles } from "./AdminShell";

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Media library (FR-81): upload images and audio, copy the CDN URL into a lesson's JSON. */
export default function MediaLibraryPage() {
  const { isAuthor } = useAdminRoles();
  const queryClient = useQueryClient();
  const media = useQuery({ queryKey: ["admin", "media"], queryFn: () => adminApi.listMedia() });
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => adminApi.uploadMedia(file),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "media"] });
    },
    onError: (err) => setError(err instanceof AdminApiError ? err.message : String(err)),
  });

  const copy = (asset: { id: string; url: string }) => {
    navigator.clipboard?.writeText(asset.url).then(() => {
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId((c) => (c === asset.id ? null : c)), 1500);
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Media library</h1>
      <p className="mt-1 text-sm text-slate-500">
        Upload an image or audio clip, then copy its URL into a lesson's <code>audio</code> or <code>image</code> field. Images are automatically resized and compressed to WebP; audio is
        stored as uploaded.
      </p>

      {isAuthor && (
        <div className="mt-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = "";
            }}
          />
          <button type="button" className="btn-primary" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            {upload.isPending ? "Uploading…" : "+ Upload file"}
          </button>
          {error && <p className="mt-2 text-sm text-danger-700">{error}</p>}
        </div>
      )}

      {media.isPending && <p className="mt-6 text-slate-500">Loading…</p>}
      {media.isError && <p className="mt-6 text-danger-700">Couldn't load the media library.</p>}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {media.data?.map((asset) => (
          <div key={asset.id} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
            {asset.kind === "image" ? (
              <img src={asset.url} alt={asset.originalFileName} className="h-24 w-full rounded-lg object-cover" />
            ) : (
              <div className="flex h-24 items-center justify-center rounded-lg bg-slate-100 text-3xl dark:bg-slate-900" aria-hidden>
                🔊
              </div>
            )}
            <p className="mt-2 truncate text-xs font-medium" title={asset.originalFileName}>
              {asset.originalFileName}
            </p>
            <p className="text-xs text-slate-400">
              {asset.width ? `${asset.width}×${asset.height} · ` : ""}
              {formatBytes(asset.bytes)}
            </p>
            {asset.kind === "audio" && <audio controls src={asset.url} className="mt-2 h-8 w-full" />}
            <button type="button" className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => copy(asset)}>
              {copiedId === asset.id ? "Copied!" : "Copy URL"}
            </button>
          </div>
        ))}
        {media.data?.length === 0 && <p className="col-span-full text-slate-500">No media uploaded yet.</p>}
      </div>
    </div>
  );
}
