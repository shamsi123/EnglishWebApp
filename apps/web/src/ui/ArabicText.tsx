import type { HTMLAttributes } from 'react';

/** Arabic content is always rendered right-to-left in an approved Arabic font. */
export function ArabicText({ className = '', children, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span lang="ar" dir="rtl" className={`ar ${className}`} {...rest}>
      {children}
    </span>
  );
}
