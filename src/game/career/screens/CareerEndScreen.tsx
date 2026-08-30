import { getClub } from '../data/clubs';
import { INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { awardLabels, careerAwardCounts, careerTrophyCounts, formatInternationalSeason, seasonClubName, seasonLeagueLabel, seasonRatio } from '../honoursDisplay';
import { formatEuros } from '../playerValue';
import { countsTowardCareerRecord, displaySeasonLabel } from '../seasonDisplay';
import { aggregateContinental, aggregateDomesticSplit, continentalLabel, seasonDomesticSplit } from '../seasonStats';
import { useCareerStore } from '../store';
import type { SeasonRecord } from '../types';
import { HonoursPills } from './HonoursPills';
import StatsTable, { DomesticStatsTable } from './StatsTable';

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
  const domestic = aggregateDomesticSplit(seasons);
  const continental = aggregateContinental(seasons);
  const intlGames = nationalTeam?.caps ?? 0;
  const intlGoals = nationalTeam?.goals ?? 0;
  const totalGames = careerGames + intlGames;
  const totalGoals = careerGoals + intlGoals;
  const ratio = totalGames > 0 ? totalGoals / totalGames : 0;
  const sponsorship = seasons.reduce((sum, s) => sum + (s.sponsorship ?? 0), 0);
  const trophies = careerTrophyCounts(seasons);
  const awards = careerAwardCounts(seasons);
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
        <StatTile value={String(totalGames)} label="All games" />
        <StatTile value={String(totalGoals)} label="All goals" />
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
        <DomesticStatsTable split={domestic} />
      </div>
      {continental.length > 0 && (
        <div className="mt-3 rounded-2xl bg-white/5 p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-white/40">Continental</p>
          <StatsTable
            rows={continental.map((row) => ({
              label: continentalLabel(row.cup),
              games: row.games,
              goals: row.goals,
            }))}
          />
        </div>
      )}

      {nationalTeam && (
        <div className="mt-3 rounded-2xl bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">International</p>
          <p className="mt-1 text-lg font-bold">
            {nationalTeam.caps} caps · {nationalTeam.goals} goals
          </p>
          {(nationalTeam.byCompetition ?? []).map((row) => (
            <div key={row.tournament} className="mt-2">
              <p className="text-xs font-semibold text-white/70">
                {INTERNATIONAL_TOURNAMENTS[row.tournament]?.name ?? row.tournament}
              </p>
              <StatsTable
                rows={[
                  { label: 'Qualifying', games: row.qualifyingGames, goals: row.qualifyingGoals },
                  { label: 'Tournament', games: row.finalsGames, goals: row.finalsGoals },
                ]}
              />
            </div>
          ))}
          {seasons
            .filter((s) => formatInternationalSeason(s.international))
            .map((s) => {
              const line = formatInternationalSeason(s.international);
              if (!line) return null;
              return (
                <p key={`intl-${s.seasonNumber}`} className="mt-1 text-xs text-white/50">
                  {displaySeasonLabel(s.seasonNumber)} · {line.name}
                  {line.qualifying ? ` · ${line.qualifying}` : ''}
                  {line.tournament ? ` · ${line.tournament}` : ''}
                  {line.awards.length > 0 ? ` · ${line.awards.join(' · ')}` : ''}
                </p>
              );
            })}
        </div>
      )}

      <div className="mt-3 rounded-2xl bg-amber-400/10 p-4">
        <p className="text-xs uppercase tracking-wide text-amber-200/70">World Player of the Year</p>
        <p className="mt-1 text-2xl font-extrabold text-amber-200">
          {wpyWins.length} title{wpyWins.length === 1 ? '' : 's'}
        </p>
      </div>

      <HonoursPills title="Trophies" items={trophies} empty="No trophies won" tone="trophy" />
      <HonoursPills title="Awards" items={awards} empty="No awards won" tone="award" />

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
      <p className="text-xs text-white/50">{seasonLeagueLabel(season)}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-white/40">Games</dt>
          <dd className="text-base font-bold">{season.gamesPlayed}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-white/40">Goals</dt>
          <dd className="text-base font-bold">{season.goals}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-white/40">Ratio</dt>
          <dd className="text-base font-bold">{seasonRatio(season).toFixed(2)}</dd>
        </div>
      </dl>
      <DomesticStatsTable split={seasonDomesticSplit(season)} />
      {(season.continentalStats ?? []).length > 0 && (
        <StatsTable
          rows={(season.continentalStats ?? []).map((row) => ({
            label: continentalLabel(row.cup),
            games: row.games,
            goals: row.goals,
          }))}
        />
      )}
      {(season.trophies ?? []).length > 0 && (
        <p className="mt-1 text-xs text-emerald-300">{(season.trophies ?? []).join(' · ')}</p>
      )}
      {(() => {
        const intl = formatInternationalSeason(season.international);
        if (!intl) return null;
        return (
          <p className="mt-1 text-xs text-white/50">
            {intl.name}
            {intl.qualifying ? ` · ${intl.qualifying}` : ''}
            {intl.tournament ? ` · ${intl.tournament}` : ''}
          </p>
        );
      })()}
      {awards.length > 0 && <p className="mt-1 text-xs text-white/50">{awards.join(' · ')}</p>}
    </article>
  );
}
