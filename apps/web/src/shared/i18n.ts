/**
 * UI strings are externalised (NFR-11). English only at launch; locale files for
 * Arabic (RTL) and other UI languages plug in here later.
 */
const en = {
  "nav.learn": "Learn",
  "nav.review": "Review",
  "nav.profile": "Profile",
  "learn.title": "Your path",
  "learn.loadError": "Couldn't load your course. Check your connection and try again.",
  "learn.retry": "Try again",
  "learn.tryDemo": "Try a demo lesson",
  "lesson.check": "Check",
  "lesson.continue": "Continue",
  "lesson.correct": "Correct!",
  "lesson.incorrect": "Not quite",
  "lesson.correctAnswer": "Correct answer:",
  "lesson.reviewMistakes": "Let's review your mistakes",
  "lesson.complete": "Lesson complete!",
  "lesson.xpEarned": "XP earned",
  "lesson.accuracy": "Accuracy",
  "lesson.done": "Done",
  "lesson.close": "Close lesson",
  "lesson.start": "Start",
  "lesson.typeAnswer": "Type your answer",
  "lesson.playAudio": "Play audio",
  "review.title": "Review",
  "review.empty": "Words from your lessons will appear here for review.",
  "profile.title": "Profile",
  "profile.signedOut": "Sign in to save your progress across devices.",
} as const;

export type MessageKey = keyof typeof en;

export function t(key: MessageKey): string {
  return en[key];
}
