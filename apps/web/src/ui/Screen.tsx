import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconButton } from './Button';

interface Props {
  title?: ReactNode;
  back?: string | (() => void);
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bg?: string;
}

/** Standard screen: top bar, scrolling body, bottom-anchored primary actions (thumb reach). */
export function Screen({ title, back, right, children, footer, className = '', bg = 'bg-cream' }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className={`flex h-full flex-col ${bg}`}>
      {(title || back || right) && (
        <header className="pt-safe flex items-center gap-3 px-4 pb-2">
          {back && (
            <IconButton label={t('common.back')} onClick={() => (typeof back === 'function' ? back() : navigate(back))}>
              <span className="rtl:-scale-x-100">⬅️</span>
            </IconButton>
          )}
          <h1 className="line-clamp-2 flex-1 text-2xl font-extrabold leading-tight">{title}</h1>
          {right}
        </header>
      )}
      <main className={`flex-1 overflow-y-auto px-4 ${className}`}>{children}</main>
      {footer && <footer className="pb-safe px-4 pt-3">{footer}</footer>}
    </div>
  );
}
