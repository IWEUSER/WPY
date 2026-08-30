import { formatCountedHonour, type CountedHonour } from '../honoursDisplay';

export function HonoursPills({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: CountedHonour[];
  empty?: string;
  tone: 'trophy' | 'award';
}) {
  const box =
    tone === 'trophy' ? 'bg-emerald-400/10' : 'bg-sky-400/10';
  const heading =
    tone === 'trophy' ? 'text-emerald-200/70' : 'text-sky-200/70';
  const pill =
    tone === 'trophy'
      ? 'bg-emerald-400/15 text-emerald-300'
      : 'bg-sky-400/15 text-sky-200';

  return (
    <div className={`mt-3 rounded-2xl ${box} p-4`}>
      <p className={`text-xs uppercase tracking-wide ${heading}`}>{title}</p>
      {items.length === 0 ? (
        empty ? <p className="mt-2 text-sm text-white/50">{empty}</p> : null
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span key={item.name} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pill}`}>
              {formatCountedHonour(item)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
