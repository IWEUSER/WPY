import type { ReactNode } from 'react';
import { formatCountedHonour, type CountedHonour } from '../honoursDisplay';
import { DATA_CARD } from './dataUi';

export function HonoursPills({
  title,
  items,
  empty,
  tone,
  icon,
}: {
  title: string;
  items: CountedHonour[];
  empty?: string;
  tone: 'trophy' | 'award' | 'record';
  icon?: ReactNode;
}) {
  const pill =
    tone === 'trophy'
      ? 'bg-emerald-400/15 text-emerald-300'
      : tone === 'award'
        ? 'bg-sky-400/15 text-sky-200'
        : 'bg-amber-400/15 text-amber-200';

  return (
    <div className={`mt-3 ${DATA_CARD}`}>
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
        {icon}
        {title}
      </p>
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
