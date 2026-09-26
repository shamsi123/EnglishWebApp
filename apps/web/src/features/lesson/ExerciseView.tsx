import { useMemo, useState } from "react";
import type { Answer, ExerciseDisplay, MediaRef } from "@englishpath/core";
import { t } from "../../shared/i18n";

interface Props {
  exercise: ExerciseDisplay;
  disabled: boolean;
  onAnswerChange: (answer: Answer | null) => void;
}

/** Renders one exercise per screen (FR-22, BRD §9). Parent keys this by exercise so state resets. */
export function ExerciseView({ exercise, disabled, onAnswerChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold">{exercise.prompt}</h2>
      {exercise.audio && <AudioButton media={exercise.audio} />}
      {exercise.image && (
        <img src={exercise.image.url} alt={exercise.image.text} className="mt-4 max-h-48 rounded-2xl object-contain" />
      )}
      <div className="mt-6">
        <ExerciseBody exercise={exercise} disabled={disabled} onAnswerChange={onAnswerChange} />
      </div>
    </div>
  );
}

function ExerciseBody({ exercise, disabled, onAnswerChange }: Props) {
  switch (exercise.type) {
    case "multipleChoice":
    case "listenSelect":
      return <Choice type={exercise.type} labels={exercise.options} disabled={disabled} onAnswerChange={onAnswerChange} />;
    case "imageWord":
      return <Choice type="imageWord" labels={exercise.choices.map((c) => c.word)} disabled={disabled} onAnswerChange={onAnswerChange} />;
    case "fillBlank":
      return (
        <>
          <p className="mb-3 text-lg">{exercise.sentence}</p>
          <TextAnswer type="fillBlank" disabled={disabled} onAnswerChange={onAnswerChange} />
        </>
      );
    case "dictation":
      return <TextAnswer type="dictation" disabled={disabled} onAnswerChange={onAnswerChange} />;
    case "reorderWords":
      return <ReorderWords id={exercise.id} words={exercise.words} disabled={disabled} onAnswerChange={onAnswerChange} />;
    case "matchPairs":
      return <MatchPairs id={exercise.id} pairs={exercise.pairs} disabled={disabled} onAnswerChange={onAnswerChange} />;
  }
}

function AudioButton({ media }: { media: MediaRef }) {
  const play = () => {
    const speak = () => {
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(media.text);
        utterance.lang = "en-GB";
        window.speechSynthesis.speak(utterance);
      }
    };
    new Audio(media.url).play().catch(speak);
  };
  return (
    <button type="button" onClick={play} className="btn-primary mt-4 h-16 w-16 rounded-full p-0 text-2xl" aria-label={t("lesson.playAudio")}>
      🔊
    </button>
  );
}

function Choice({
  type,
  labels,
  disabled,
  onAnswerChange,
}: {
  type: "multipleChoice" | "listenSelect" | "imageWord";
  labels: string[];
  disabled: boolean;
  onAnswerChange: Props["onAnswerChange"];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="grid gap-3">
      {labels.map((label, i) => (
        <button
          key={label}
          type="button"
          className="btn-option"
          aria-pressed={selected === i}
          disabled={disabled}
          onClick={() => {
            setSelected(i);
            onAnswerChange({ type, selectedIndex: i });
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TextAnswer({
  type,
  disabled,
  onAnswerChange,
}: {
  type: "fillBlank" | "dictation";
  disabled: boolean;
  onAnswerChange: Props["onAnswerChange"];
}) {
  return (
    <input
      type="text"
      autoFocus
      autoCapitalize="off"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      aria-label={t("lesson.typeAnswer")}
      placeholder={t("lesson.typeAnswer")}
      className="min-h-touch w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg dark:border-slate-700 dark:bg-slate-900"
      onChange={(e) => onAnswerChange(e.target.value.trim() ? { type, text: e.target.value } : null)}
    />
  );
}

/** Deterministic shuffle so re-renders don't reorder options mid-exercise. */
function shuffled<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  // Never present the answer already solved.
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}

function ReorderWords({
  id,
  words,
  disabled,
  onAnswerChange,
}: {
  id: string;
  words: string[];
  disabled: boolean;
  onAnswerChange: Props["onAnswerChange"];
}) {
  const bank = useMemo(() => shuffled(words.map((w, i) => ({ w, key: i })), id), [id, words]);
  const [picked, setPicked] = useState<number[]>([]);

  const update = (next: number[]) => {
    setPicked(next);
    onAnswerChange(next.length === words.length ? { type: "reorderWords", words: next.map((k) => words[k]!) } : null);
  };

  return (
    <div>
      <div className="flex min-h-16 flex-wrap gap-2 border-b-2 border-slate-200 pb-3 dark:border-slate-700" aria-live="polite">
        {picked.map((k) => (
          <button key={k} type="button" disabled={disabled} className="btn border-2 border-slate-300 dark:border-slate-600" onClick={() => update(picked.filter((p) => p !== k))}>
            {words[k]}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {bank.map(({ w, key }) => (
          <button
            key={key}
            type="button"
            disabled={disabled || picked.includes(key)}
            className="btn border-2 border-slate-200 dark:border-slate-700"
            onClick={() => update([...picked, key])}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

function MatchPairs({
  id,
  pairs,
  disabled,
  onAnswerChange,
}: {
  id: string;
  pairs: Array<[string, string]>;
  disabled: boolean;
  onAnswerChange: Props["onAnswerChange"];
}) {
  const rights = useMemo(() => shuffled(pairs.map(([, r]) => r), id), [id, pairs]);
  const [activeLeft, setActiveLeft] = useState<string | null>(null);
  const [matches, setMatches] = useState<Array<[string, string]>>([]);

  const matchedLeft = new Set(matches.map(([l]) => l));
  const matchedRight = new Set(matches.map(([, r]) => r));

  const pickRight = (right: string) => {
    if (!activeLeft) return;
    const next: Array<[string, string]> = [...matches, [activeLeft, right]];
    setMatches(next);
    setActiveLeft(null);
    onAnswerChange(next.length === pairs.length ? { type: "matchPairs", pairs: next } : null);
  };

  const unmatch = (left: string) => {
    const next = matches.filter(([l]) => l !== left);
    setMatches(next);
    onAnswerChange(null);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid gap-3">
        {pairs.map(([left]) => (
          <button
            key={left}
            type="button"
            className="btn-option justify-center"
            disabled={disabled}
            aria-pressed={activeLeft === left || matchedLeft.has(left)}
            onClick={() => (matchedLeft.has(left) ? unmatch(left) : setActiveLeft(left))}
          >
            {left}
          </button>
        ))}
      </div>
      <div className="grid gap-3">
        {rights.map((right) => (
          <button
            key={right}
            type="button"
            className="btn-option justify-center"
            disabled={disabled || matchedRight.has(right) || !activeLeft}
            aria-pressed={matchedRight.has(right)}
            onClick={() => pickRight(right)}
          >
            {right}
          </button>
        ))}
      </div>
    </div>
  );
}
