import { useMemo, useState, type ReactNode } from 'react';
import { CONFEDERATION_ORDER, nationsGroupedByConfederation } from '../data/nations';
import { CONTINENTAL_TOURNAMENT_FOR_CONFEDERATION, INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { useCareerStore } from '../store';

const CONFEDERATION_LABEL: Record<string, string> = {
  UEFA: 'UEFA — Europe',
  CONMEBOL: 'CONMEBOL — South America',
  CONCACAF: 'CONCACAF — North & Central America',
  CAF: 'CAF — Africa',
  AFC: 'AFC — Asia',
  OFC: 'OFC — Oceania',
};

export default function NationalityScreen() {
  const chooseNationality = useCareerStore((s) => s.chooseNationality);
  const clubId = useCareerStore((s) => s.clubId);
  const [query, setQuery] = useState('');
  const [confederation, setConfederation] = useState<string | 'all'>('all');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nationsGroupedByConfederation()
      .filter((g) => confederation === 'all' || g.confederation === confederation)
      .map((g) => ({
        ...g,
        nations: g.nations.filter((n) => !q || n.name.toLowerCase().includes(q)),
      }))
      .filter((g) => g.nations.length > 0);
  }, [query, confederation]);

  return (
    <div className="flex h-full w-full flex-col items-center gap-5 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div>
        <p className="text-sm text-white/50">International career</p>
        <h1 className="text-2xl font-extrabold tracking-wide">Who do you play for?</h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">
          {clubId
            ? 'This is independent of your club. Selectors later look at your goal ratio and the level of club you play for.'
            : 'Choose your nationality first. Then take the trial — if your country has a league in the game, two of your three club offers will come from home.'}
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search 211 FIFA nations"
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-emerald-400/60"
      />

      <div className="flex w-full max-w-sm flex-wrap justify-center gap-1.5">
        <FilterChip active={confederation === 'all'} onClick={() => setConfederation('all')}>
          All
        </FilterChip>
        {CONFEDERATION_ORDER.map((id) => (
          <FilterChip key={id} active={confederation === id} onClick={() => setConfederation(id)}>
            {id}
          </FilterChip>
        ))}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-5 pb-8">
        {groups.map((group) => {
          const tournament = INTERNATIONAL_TOURNAMENTS[CONTINENTAL_TOURNAMENT_FOR_CONFEDERATION[group.confederation]];
          return (
            <section key={group.confederation} className="text-left">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                {CONFEDERATION_LABEL[group.confederation]}
                <span className="ml-2 font-normal normal-case tracking-normal text-white/30">
                  {tournament.name}
                </span>
              </p>
              <div className="flex flex-col gap-2">
                {group.nations.map((nation) => (
                  <button
                    key={nation.id}
                    type="button"
                    onClick={() => chooseNationality(nation.id)}
                    className="flex items-center gap-3 rounded-2xl bg-white/5 p-3.5 text-left backdrop-blur transition active:scale-[0.98]"
                  >
                    <div className="flex-1">
                      <p className="font-bold">{nation.name}</p>
                      <p className="text-xs text-white/50">{group.confederation}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {groups.length === 0 && (
          <p className="text-sm text-white/50">No nations match “{query}”.</p>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        active ? 'bg-emerald-400 text-black' : 'bg-white/10 text-white/70'
      }`}
    >
      {children}
    </button>
  );
}
