import { useTranslation } from 'react-i18next';

export type FeedbackState = 'none' | 'correct' | 'tryAgain' | 'hint';

/** Gentle feedback banner: never "wrong" or "failed" wording. */
export function Feedback({ state }: { state: FeedbackState }) {
  const { t } = useTranslation();
  if (state === 'none') return <div className="h-12" />;
  const style = {
    correct: 'bg-leaf-100 text-leaf-600',
    tryAgain: 'bg-sun-100 text-sun-500',
    hint: 'bg-sky2-100 text-sky2-500',
  }[state];
  const text = { correct: `🎉 ${t('act.great')}`, tryAgain: `🤔 ${t('act.tryAgain')}`, hint: `💡 ${t('act.hint')}` }[state];
  return (
    <div role="status" className={`mx-auto flex h-12 items-center justify-center rounded-full px-6 text-xl font-extrabold animate-pop-in ${style}`}>
      {text}
    </div>
  );
}
