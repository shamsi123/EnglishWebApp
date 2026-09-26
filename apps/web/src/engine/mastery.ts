/** Mastery gate (BRD §5.5). Mirrored in services/api/src/KidsLang.Domain/Mastery.cs — keep in sync. */
export interface MasteryConfig {
  minScore: number;
  requireEachNewItem: boolean;
  minTraceAccuracy: number;
}

export interface ItemResult {
  itemId: string;
  correct: boolean;
}

export interface MasteryInput {
  newItems: string[];
  config: MasteryConfig;
  results: ItemResult[];
  /** Best tracing accuracy in the check, or null when the lesson has no tracing. */
  traceAccuracy: number | null;
}

export interface MasteryResult {
  mastered: boolean;
  score: number;
  stars: 0 | 1 | 2 | 3;
  missedItems: string[];
}

export const DEFAULT_MASTERY: MasteryConfig = { minScore: 0.8, requireEachNewItem: true, minTraceAccuracy: 0.7 };

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function starsForScore(score: number): 0 | 1 | 2 | 3 {
  const s = round4(score);
  if (s >= 1) return 3;
  if (s >= 0.9) return 2;
  if (s >= 0.8) return 1;
  return 0;
}

export function evaluateMastery({ newItems, config, results, traceAccuracy }: MasteryInput): MasteryResult {
  const correct = results.filter((r) => r.correct).length;
  const score = results.length === 0 ? 0 : round4(correct / results.length);

  const missed = new Set<string>();
  for (const r of results) if (!r.correct) missed.add(r.itemId);

  let eachNewOk = true;
  if (config.requireEachNewItem) {
    for (const id of newItems) {
      if (!results.some((r) => r.itemId === id && r.correct)) {
        eachNewOk = false;
        missed.add(id);
      }
    }
  }

  const traceOk = traceAccuracy === null || traceAccuracy >= config.minTraceAccuracy;
  if (!traceOk) newItems.forEach((id) => missed.add(id));

  const mastered = results.length > 0 && score >= config.minScore && eachNewOk && traceOk;
  if (results.length === 0) newItems.forEach((id) => missed.add(id));

  return {
    mastered,
    score,
    stars: mastered ? starsForScore(score) : 0,
    missedItems: [...missed].sort(),
  };
}
