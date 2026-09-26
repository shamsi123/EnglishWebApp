import type { ReactNode } from 'react';

/** Full-screen on phones; a centred phone frame on tablets/desktop (BRD §9 Responsiveness). */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center md:bg-gradient-to-br md:from-grape-200 md:via-sky2-100 md:to-sun-100 md:p-6">
      <div className="relative h-full w-full overflow-hidden bg-cream md:h-[860px] md:max-h-full md:w-[400px] md:rounded-[3rem] md:border-[10px] md:border-ink md:shadow-2xl">
        {children}
      </div>
    </div>
  );
}
