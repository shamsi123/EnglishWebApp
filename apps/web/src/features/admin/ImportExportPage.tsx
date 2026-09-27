import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { adminApi, AdminApiError, type ContentPackage } from "./adminApi";
import { useAdminRoles } from "./AdminShell";

/** Bulk content exchange (FR-85): export the whole course as JSON, or import a package drafted offline. */
export default function ImportExportPage() {
  const { isAuthor } = useAdminRoles();
  const inputRef = useRef<HTMLInputElement>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const exportContent = async () => {
    setExportError(null);
    try {
      const pkg = await adminApi.exportContent();
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `englishpath-content-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof AdminApiError ? err.message : String(err));
    }
  };

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      let pkg: ContentPackage;
      try {
        pkg = JSON.parse(text);
      } catch (err) {
        throw new Error(`Invalid JSON file: ${err instanceof Error ? err.message : String(err)}`);
      }
      return adminApi.importContent(pkg);
    },
    onSuccess: (result) => {
      setImportError(null);
      setImportResult(`Imported ${result.unitsCreated} new unit(s), ${result.lessonsCreated} lesson(s) and ${result.placementItemsCreated} placement item(s) as drafts.`);
    },
    onError: (err) => {
      setImportResult(null);
      setImportError(err instanceof Error ? err.message : String(err));
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Import / export</h1>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Export</h2>
        <p className="mt-1 text-sm text-slate-500">Downloads every unit and lesson draft, plus the active placement item bank, as one JSON file.</p>
        <button type="button" className="btn-primary mt-3" onClick={exportContent}>
          Export course content
        </button>
        {exportError && <p className="mt-2 text-sm text-danger-700">{exportError}</p>}
      </section>

      {isAuthor && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Import</h2>
          <p className="mt-1 text-sm text-slate-500">
            Loads a content package (drafted offline, or with AI assistance) as drafts — everything still goes through review before it's published (FR-82). A unit with the same level
            and title is reused, so re-importing an updated file adds new lessons without duplicating the unit.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importMutation.mutate(file);
              e.target.value = "";
            }}
          />
          <button type="button" className="btn-primary mt-3" disabled={importMutation.isPending} onClick={() => inputRef.current?.click()}>
            {importMutation.isPending ? "Importing…" : "Choose file to import"}
          </button>
          {importResult && <p className="mt-2 text-sm text-brand-700 dark:text-brand-500">{importResult}</p>}
          {importError && <p className="mt-2 text-sm text-danger-700">{importError}</p>}
        </section>
      )}
    </div>
  );
}
