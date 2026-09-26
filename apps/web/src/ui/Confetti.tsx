const COLORS = ['#f43f5e', '#fbbf24', '#22c55e', '#38bdf8', '#8b5cf6', '#fb923c'];

export function Confetti({ pieces = 40 }: { pieces?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: pieces }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-3 w-2 rounded-sm"
          style={{
            insetInlineStart: `${(i * 37) % 100}%`,
            background: COLORS[i % COLORS.length],
            animation: `confetti ${2.2 + (i % 5) * 0.4}s linear ${(i % 10) * 0.15}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
