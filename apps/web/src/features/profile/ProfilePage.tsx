import { t } from "../../shared/i18n";

// FR-01/02/60: sign-in, onboarding preferences and dashboard land here.
export default function ProfilePage() {
  return (
    <section className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-400">{t("profile.signedOut")}</p>
    </section>
  );
}
