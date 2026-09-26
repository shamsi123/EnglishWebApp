import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { sfx } from '@/engine/audio';

type Variant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-grape-600 text-white shadow-[0_6px_0_#5b21b6] active:shadow-[0_2px_0_#5b21b6]',
  secondary: 'bg-white text-grape-700 shadow-[0_6px_0_#ddd6fe] active:shadow-[0_2px_0_#ddd6fe]',
  ghost: 'bg-transparent text-grape-700',
  success: 'bg-leaf-500 text-white shadow-[0_6px_0_#15803d] active:shadow-[0_2px_0_#15803d]',
  danger: 'bg-coral-500 text-white shadow-[0_6px_0_#be123c] active:shadow-[0_2px_0_#be123c]',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  block?: boolean;
}

export function Button({ variant = 'primary', icon, block, className = '', children, onClick, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      onClick={(e) => {
        sfx('tap');
        onClick?.(e);
      }}
      className={`inline-flex min-h-tap items-center justify-center gap-2 rounded-blob px-6 text-xl font-extrabold transition-all active:translate-y-1 disabled:opacity-40 ${
        block ? 'w-full' : ''
      } ${VARIANTS[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({ label, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-[0_4px_0_#ddd6fe] active:translate-y-1 active:shadow-none ${className}`}
    >
      {children}
    </button>
  );
}
