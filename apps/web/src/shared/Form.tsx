import type { InputHTMLAttributes, ReactNode } from "react";
import { ApiError, OAuthError } from "@englishpath/core";
import { t } from "./i18n";

export function Field({ label, hint, id, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; id: string }) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-1 min-h-touch w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-base dark:border-slate-700 dark:bg-slate-900"
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {hint}
        </p>
      )}
    </div>
  );
}

export function FormMessage({ tone = "error", children }: { tone?: "error" | "info"; children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`mt-4 rounded-2xl p-3 ${tone === "error" ? "bg-danger-50 text-danger-700" : "bg-brand-50 text-brand-700"} dark:bg-slate-900`}
    >
      {children}
    </p>
  );
}

/** Screen layout for sign-in style pages: centred column, title, content. */
export function AuthScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-full max-w-player flex-col px-4 py-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </main>
  );
}

/** User-facing message for an API/OAuth failure. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof OAuthError) return error.message;
  if (error instanceof TypeError) return t("auth.offline");
  return String(error);
}
