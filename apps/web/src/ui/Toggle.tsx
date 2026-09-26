export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-tap items-center justify-between gap-3 text-lg font-bold">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-9 w-16 rounded-full transition-colors ${checked ? 'bg-leaf-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ${checked ? 'start-8' : 'start-1'}`} />
      </button>
    </label>
  );
}
