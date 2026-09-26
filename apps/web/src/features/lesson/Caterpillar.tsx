/** Progress caterpillar: one body segment per activity; the head moves along as the child plays. */
export function Caterpillar({ total, done, label }: { total: number; done: number; label: string }) {
  return (
    <div className="flex flex-1 items-center gap-1" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-5 flex-1 rounded-full transition-colors duration-500 ${i < done ? 'bg-leaf-400' : 'bg-grape-100'}`}
        />
      ))}
      <span className="-ms-1 text-2xl">🐛</span>
    </div>
  );
}
