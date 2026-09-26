import { useRef, useState } from 'react';
import type { Activity } from '@/content/schema';
import { sfx } from '@/engine/audio';
import type { FeedbackState } from './Feedback';
import type { ActivityOutcome } from './types';

const ADVANCE_MS = 900;

/**
 * Shared answer flow. Play: unlimited tries, hint after 2 misses. Check: the first answer counts,
 * no hints, and we move on gently either way.
 */
export function useAnswer(activity: Activity, onDone: (o: ActivityOutcome) => void) {
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const [misses, setMisses] = useState(0);
  const [finished, setFinished] = useState(false);
  const done = useRef(false);
  const isCheck = activity.phase === 'check';
  const hintsOn = 'hints' in activity ? activity.hints : !isCheck;

  const finish = (outcome: ActivityOutcome) => {
    if (done.current) return;
    done.current = true;
    setFinished(true);
    window.setTimeout(() => onDone(outcome), ADVANCE_MS);
  };

  const answer = (correct: boolean) => {
    if (done.current) return;
    if (correct) {
      sfx('correct');
      setFeedback('correct');
      finish({ correct: misses === 0 });
      return;
    }
    sfx('tryAgain');
    const n = misses + 1;
    setMisses(n);
    if (isCheck) {
      setFeedback('none');
      finish({ correct: false });
      return;
    }
    setFeedback(hintsOn && n >= 2 ? 'hint' : 'tryAgain');
  };

  return { feedback, misses, finished, answer, finish, showHint: hintsOn && misses >= 2, isCheck, setFeedback };
}
