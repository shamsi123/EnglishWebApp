import { PIN_PICTURES } from '@/lib/progress';

/** Picture-PIN pad: tap 3 pictures (no typing for children). */
export function PicturePin({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-4xl shadow-inner">
            {value[i] ?? '·'}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {PIN_PICTURES.map((p) => (
          <button
            key={p}
            type="button"
            aria-label={p}
            onClick={() => onChange(value.length >= 3 ? [p] : [...value, p])}
            className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-5xl shadow-[0_5px_0_#ddd6fe] active:translate-y-1"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
