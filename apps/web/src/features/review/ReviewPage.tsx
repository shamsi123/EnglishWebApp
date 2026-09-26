import { t } from "../../shared/i18n";

// FR-30/31: word bank and SRS review queue. Wired to the Progress service in Month 4.
export default function ReviewPage() {
  return (
    <section className="mx-auto max-w-2xl p-4">
      <h1 className="text-2xl font-bold">{t("review.title")}</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-400">{t("review.empty")}</p>
    </section>
  );
}
