export function Stars({ count, max = 3, size = 'text-2xl' }: { count: number; max?: number; size?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${size}`} aria-label={`${count} / ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < count ? 'drop-shadow' : 'opacity-25 grayscale'}>
          ⭐
        </span>
      ))}
    </span>
  );
}
