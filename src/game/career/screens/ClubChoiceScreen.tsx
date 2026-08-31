import { useMemo, useState } from 'react';
import { playableClubsGroupedByLeague, TIER_LABEL } from '../data/clubs';
import { useCareerStore } from '../store';

const PATH_COPY: Record<string, { title: string; detail: string }> = {
  'favourite-trial': {
    title: 'Pick your club',
    detail: 'Three academy games, empty stands. You must hit this club’s first-team ratio to sign.',
  },
  'favourite-reserve': {
    title: 'Pick your club',
    detail: 'A reserve contract and the full league calendar at the academy ground. Hit the ratio to stay.',
  },
  'favourite-first-team': {
    title: 'Pick your club',
    detail: 'A two-year first-team contract. Hit the ratio to stay — miss it and a loan follows.',
  },
};

export default function ClubChoiceScreen() {
  const careerStart = useCareerStore((s) => s.careerStart);
  const chooseFavouriteClub = useCareerStore((s) => s.chooseFavouriteClub);
  const backFromSetup = useCareerStore((s) => s.backFromSetup);
  const [query, setQuery] = useState('');

  const copy = PATH_COPY[careerStart ?? ''] ?? PATH_COPY['favourite-trial'];
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return playableClubsGroupedByLeague()
      .map((g) => ({
        ...g,
        clubs: g.clubs.filter(
          (c) =>
            !q ||
            c.name.toLowerCase().includes(q) ||
            c.league.toLowerCase().includes(q) ||
            c.country.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.clubs.length > 0);
  }, [query]);

  return (
    <div className="flex h-full w-full flex-col items-center gap-5 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div>
        <button
          type="button"
          onClick={backFromSetup}
          className="mb-3 text-xs font-semibold text-white/50 underline underline-offset-2"
        >
          Back
        </button>
        <p className="text-sm text-white/50">Play for your favourite club</p>
        <h1 className="font-display text-2xl font-bold">{copy.title}</h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">{copy.detail}</p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search clubs, leagues, countries"
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-emerald-400/60"
      />

      <div className="flex w-full max-w-sm flex-col gap-5 pb-8">
        {groups.map((group) => (
          <section key={group.league} className="text-left">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
              {group.league}
            </p>
            <div className="flex flex-col gap-2">
              {group.clubs.map((club) => (
                <button
                  key={club.id}
                  type="button"
                  onClick={() => chooseFavouriteClub(club.id)}
                  className="flex items-center gap-3 rounded-2xl bg-white/5 p-3.5 text-left backdrop-blur transition active:scale-[0.98]"
                  style={{ borderLeft: `4px solid ${club.color}` }}
                >
                  <div className="flex-1">
                    <p className="font-bold">{club.name}</p>
                    <p className="text-xs text-white/50">
                      {club.country} · {club.league}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                    {TIER_LABEL[club.tier]}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <p className="text-sm text-white/50">No clubs match “{query}”.</p>
        )}
      </div>
    </div>
  );
}
