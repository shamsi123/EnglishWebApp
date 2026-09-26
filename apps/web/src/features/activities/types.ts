import type { ActivityOf, ActivityType } from '@/content/schema';

export interface ActivityOutcome {
  /** Correct on the first try — this is what the mastery quiz counts. */
  correct: boolean;
  /** Tracing accuracy (0–1) for trace activities. */
  score?: number;
}

export interface ActivityProps<T extends ActivityType> {
  activity: ActivityOf<T>;
  onDone: (outcome: ActivityOutcome) => void;
}
