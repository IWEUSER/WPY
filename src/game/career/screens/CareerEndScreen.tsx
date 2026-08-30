import { getClub } from '../data/clubs';
import { INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { awardLabels, seasonClubName, seasonRatio } from '../honoursDisplay';
import { formatEuros } from '../playerValue';
import { countsTowardCareerRecord, displaySeasonLabel } from '../seasonDisplay';
import { aggregateContinental, aggregateDomestic, continentalLabel } from '../seasonStats';
import { useCareerStore } from '../store';
import type { SeasonRecord } from '../types';

export default function CareerEndScreen() {
  const history = useCareerStore((s) => s.seasonHistory);
  const current = useCareerStore((s) => s.currentSeason);
  const careerGoals = useCareerStore((s) => s.careerGoals);
  const careerGames = useCareerStore((s) => s.careerGames);
  const nationalTeam = useCareerStore((s) => s.nationalTeam);
  const clubId = useCareerStore((s) => s.clubId);
  const careerEarnings = useCareerStore((s) => s.careerEarnings);
  const resetCareer = useCareerStore((s) => s.resetCareer);
  const returnToMenu = useCareerStore((s) => s.returnToMenu);

  const seen = new Set<number>();
  const seasons = [...history, ...(current ? [current] : [])].filter((s) => {
    if (!countsTowardCareerRecord(s.seasonNumber) || seen.has(s.seasonNumber)) return false;
    seen.add(s.seasonNumber);
    return true;
  });
  const wpyWins = seasons.filter((s) => s.wonWpy);
  const domestic = aggregateDomestic(seasons);
  const continental = aggregateContinental(seasons);
  const intlGames = nationalTeam?.caps ?? 0;
  const intlGoals = nationalTeam?.goals ?? 0;
  const totalGames = careerGames + intlGames;
  const totalGoals = careerGoals + intlGoals;
  const ratio = totalGames > 0 ? totalGoals / totalGames : 0;
  const sponsorship = seasons.reduce((sum, s) => sum + (s.sponsorship ?? 0), 0);
  const trophies = [...new Set(seasons.flatMap((s) => s.trophies ?? []))];
  const lastClub = clubId ? getClub(clubId) : undefined;
  const lastSeason = seasons[seasons.length - 1];

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-5 py-[max(1.25rem,env(safe-area-inset-top))] pb-10 text-white">
      <p className="text-xs uppercase tracking-wide text-white/40">Career complete</p>
      <h1 className="mt-1 text-2xl font-extrabold">Retired at 36</h1>
      <p className="mt-2 text-sm text-white/60">
        {lastClub ? `${lastClub.name}` : 'Your career'}
        {lastSeason ? ` · last season ${displaySeasonLabel(lastSeason.seasonNumber)}` : ''}
      </p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <StatTile value={String(totalGoals)} label="All goals" />
        <StatTile value={String(totalGames)} label="All games" />
        <StatTile value={ratio.toFixed(2)} label="All ratio" />
      </div>
      <p className="mt-2 text-center text-[11px] text-white/40">Club and country combined</p>

      <div className="mt-3 rounded-2xl bg-white/5 p-4 text-sm">
        <p className="text-xs uppercase tracking-wide text-white/40">Earnings</p>
        <p className="mt-1 text-lg font-bold">{formatEuros(careerEarnings)}</p>
        {sponsorship > 0 && (
          <p className="mt-1 text-xs text-white/50">including {formatEuros(sponsorship)} in sponsorships</p>
        )}
      </div>

      <div className="mt-3 rounded-2xl bg-white/5 p-4 text-sm">
        <p className="text-xs uppercase tracking-wide text-white/40">Domestic</p>
        <p className="mt-1 font-semibold">
          {domestic.goals} goals in {domestic.games} games
        </p>
        {continental.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-white/70">
            {continental.map((row) => (
              <li key={row.cup}>
                {continentalLabel(row.cup)} — {row.goals} goal{row.goals === 1 ? '' : 's'} in {row.games}
              </li>
            ))}
          </ul>
        )}
      </div>

      {nationalTeam && (
        <div className="mt-3 rounded-2xl bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">International</p>
          <p className="mt-1 text-lg font-bold">
            {nationalTeam.caps} caps · {nationalTeam.goals} goals
          </p>
          {(nationalTeam.byCompetition ?? []).map((row) => (
            <p key={row.tournament} className="mt-1 text-xs text-white/50">
              {INTERNATIONAL_TOURNAMENTS[row.tournament]?.name ?? row.tournament}
              {': '}
              Qualifying {row.qualifyingGoals} in {row.qualifyingGames}
              {' · '}
              Tournament {row.finalsGoals} in {row.finalsGames}
            </p>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-2xl bg-amber-400/10 p-4">
        <p className="text-xs uppercase tracking-wide text-amber-200/70">World Player of the Year</p>
        <p className="mt-1 text-2xl font-extrabold text-amber-200">
          {wpyWins.length} title{wpyWins.length === 1 ? '' : 's'}
        </p>
      </div>

      {trophies.length > 0 && (
        <div className="mt-3 rounded-2xl bg-emerald-400/10 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-200/70">Trophies</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {trophies.map((name) => (
              <span key={name} className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {[...seasons].reverse().map((season) => (
          <SeasonCard key={season.seasonNumber} season={season} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          resetCareer();
          returnToMenu();
        }}
        className="mt-6 w-full rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        New career
      </button>
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
    </div>
  );
}

function SeasonCard({ season }: { season: SeasonRecord }) {
  const club = getClub(season.clubId);
  const awards = awardLabels(season);
  return (
    <article className="rounded-2xl bg-white/5 p-4" style={club ? { borderLeft: `4px solid ${club.color}` } : undefined}>
      <p className="text-xs uppercase tracking-wide text-white/40">
        {displaySeasonLabel(season.seasonNumber)} · Age {season.age}
      </p>
      <h2 className="text-lg font-extrabold">{seasonClubName(season)}</h2>
      <p className="text-xs text-white/50">{season.league ?? club?.league ?? ''}</p>
      <p className="mt-2 text-sm text-white/80">
        {season.goals} goals in {season.gamesPlayed} · {seasonRatio(season).toFixed(2)}
      </p>
      {(season.trophies ?? []).length > 0 && (
        <p className="mt-1 text-xs text-emerald-300">{(season.trophies ?? []).join(' · ')}</p>
      )}
      {awards.length > 0 && <p className="mt-1 text-xs text-white/50">{awards.join(' · ')}</p>}
    </article>
  );
}
