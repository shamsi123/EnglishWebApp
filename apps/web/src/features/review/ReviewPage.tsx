import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MediaRef, VocabularyEntry } from "@englishpath/core";
import { api } from "../../shared/api";
import { FormMessage, errorMessage } from "../../shared/Form";
import { t } from "../../shared/i18n";

/** SM-2 grades behind the four buttons (FR-31). */
const grades = [
  { label: "review.again", grade: 1, style: "border-danger-600 text-danger-700" },
  { label: "review.hard", grade: 3, style: "border-amber-400" },
  { label: "review.good", grade: 4, style: "border-brand-500 text-brand-700" },
  { label: "review.easy", grade: 5, style: "border-brand-600 bg-brand-50 text-brand-700" },
] as const;

function speak(media: MediaRef | undefined, text: string, lang: string) {
  const fallback = () => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      window.speechSynthesis.speak(utterance);
    }
  };
  if (media) new Audio(media.url).play().catch(fallback);
  else fallback();
}

/** Daily spaced-repetition review of the learner's word bank (FR-30–32). */
export default function ReviewPage() {
  const queryClient = useQueryClient();
  const due = useQuery({
    queryKey: ["reviews-due"],
    queryFn: async () => {
      const cards = await api.getDueReviews(20);
      if (cards.length === 0) return [];
      const words = await api.getVocabulary(cards.map((c) => c.vocabularyId));
      const byId = new Map(words.map((w) => [w.id, w]));
      // Skip cards whose word is no longer in any published lesson.
      return cards.flatMap((c) => (byId.has(c.vocabularyId) ? [byId.get(c.vocabularyId)!] : []));
    },
    staleTime: 0,
  });
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = due.data ?? [];
  const word: VocabularyEntry | undefined = words[index];

  const grade = async (value: number) => {
    if (!word) return;
    setError(null);
    try {
      await api.reviewWord(word.id, value);
      setRevealed(false);
      setIndex((i) => i + 1);
      if (index + 1 >= words.length) await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section className="mx-auto max-w-player p-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">{t("review.title")}</h1>
        {word && (
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {words.length - index} {t("review.remaining")}
          </span>
        )}
      </div>

      {due.isPending && <div className="mt-6 h-64 animate-pulse rounded-3xl bg-slate-100 dark:bg-slate-800" aria-busy="true" />}
      {due.isError && <FormMessage>{errorMessage(due.error)}</FormMessage>}
      {due.data && !word && (
        <p className="mt-6 rounded-2xl bg-brand-50 p-6 text-center text-lg dark:bg-slate-900">{words.length === 0 && index === 0 ? t("review.empty") : t("review.done")}</p>
      )}

      {word && (
        <div className="mt-6 rounded-3xl border-2 border-slate-200 p-6 text-center dark:border-slate-700">
          {word.image && <img src={word.image.url} alt={word.image.text} className="mx-auto mb-4 max-h-40 rounded-2xl object-contain" />}
          <p className="text-4xl font-bold">{word.word}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button type="button" className="btn border-2 border-slate-200 dark:border-slate-700" onClick={() => speak(word.audioUk, word.word, "en-GB")} aria-label={`${t("lesson.playAudio")} (UK)`}>
              🔊 UK
            </button>
            <button type="button" className="btn border-2 border-slate-200 dark:border-slate-700" onClick={() => speak(word.audioUs, word.word, "en-US")} aria-label={`${t("lesson.playAudio")} (US)`}>
              🔊 US
            </button>
          </div>
          {revealed && (
            <div className="mt-6 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700" aria-live="polite">
              {word.ipa && <p className="text-lg text-slate-600 dark:text-slate-400">{word.ipa}</p>}
              {word.translation && <p className="text-lg font-medium">{word.translation}</p>}
              <p className="italic">“{word.example}”</p>
            </div>
          )}
        </div>
      )}

      <FormMessage>{error}</FormMessage>
      {word && !revealed && (
        <button type="button" className="btn-primary mt-6 w-full" onClick={() => setRevealed(true)}>
          {t("review.showAnswer")}
        </button>
      )}
      {word && revealed && (
        <>
          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">{t("review.howWell")}</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {grades.map((g) => (
              <button key={g.grade} type="button" className={`btn border-2 px-2 ${g.style}`} onClick={() => grade(g.grade)}>
                {t(g.label)}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
