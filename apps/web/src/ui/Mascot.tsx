import { useEffect, useRef } from 'react';
import { speak } from '@/engine/audio';

interface Props {
  emoji?: string;
  says?: string;
  /** Speak the bubble text aloud (every child instruction has audio). */
  speakLang?: 'en' | 'ar';
  size?: 'sm' | 'md' | 'lg';
  mood?: 'idle' | 'happy';
}

const SIZES = { sm: 'text-5xl', md: 'text-7xl', lg: 'text-[7.5rem] leading-none' };

export function Mascot({ emoji = '🐪', says, speakLang, size = 'md', mood = 'idle' }: Props) {
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    if (says && speakLang && spoken.current !== says) {
      spoken.current = says;
      speak(says, speakLang);
    }
  }, [says, speakLang]);

  return (
    <div className="flex items-end gap-3">
      <button
        type="button"
        aria-label={says ?? 'mascot'}
        onClick={() => says && speak(says, speakLang ?? 'en')}
        className={`${SIZES[size]} ${mood === 'happy' ? 'animate-wiggle' : 'animate-bob'} drop-shadow-md`}
      >
        {emoji}
      </button>
      {says && (
        <div className="relative mb-4 max-w-[15rem] rounded-3xl bg-white px-4 py-3 text-lg font-bold leading-snug shadow-md animate-pop-in" role="status">
          {says}
          <span className="absolute -start-2 bottom-3 h-4 w-4 rotate-45 bg-white" />
        </div>
      )}
    </div>
  );
}
