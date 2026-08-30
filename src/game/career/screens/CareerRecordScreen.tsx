import { getClub } from '../data/clubs';
import { INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { currentCalendarWeek } from '../calendar';
import { awardLabels, careerAwardCounts, careerTrophyCounts, formatGamesGoals, seasonClubName, seasonRatio } from '../honoursDisplay';
import { formatEuros, formatWeeklyWage, playerMarketValueFromSeasons } from '../playerValue';
import { countsTowardCareerRecord, displaySeasonLabel } from '../seasonDisplay';
import { aggregateContinental, aggregateDomestic, continentalLabel } from '../seasonStats';
import { useCareerStore } from '../store';
import type { SeasonRecord } from '../types';
import { HonoursPills } from './HonoursPills';

const ROLE_LABEL: Record<string, string> = {
  reserve: 'Reserves',
  'first-team': 'First team',
  loan: 'Loan',
};

export default function CareerRecordScreen() {
  const history = useCareerStore((s) => s.seasonHistory);
  const current = useCareerStore((s) => s.currentSeason);
  const careerGoals = useCareerStore((s) => s.careerGoals);
  const careerGames = useCareerStore((s) => s.careerGames);
  const nationalTeam = useCareerStore((s) => s.nationalTeam);
  const clubId = useCareerStore((s) => s.clubId);
  const age = useCareerStore((s) => s.age);
  const careerEarnings = useCareerStore((s) => s.careerEarnings);
  const weeklyWage = useCareerStore((s) => s.weeklyWage);
  const contractYearsRemaining = useCareerStore((s) => s.contractYearsRemaining);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const seasonCalendar = useCareerStore((s) => s.seasonCalendar);
  const seasonSim = useCareerStore((s) => s.seasonSim);
  const returnToHub = useCareerStore((s) => s.returnToHub);

  const seasons: Array<SeasonRecord & { inProgress?: boolean }> = [
    ...(current && countsTowardCareerRecord(current.seasonNumber) ? [{ ...current, inProgress: true }] : []),
    ...[...history].filter((s) => countsTowardCareerRecord(s.seasonNumber)).reverse(),
  ];
  const wpyWins = [...history, ...(current?.wonWpy ? [current] : [])].filter(
    (s) => s.wonWpy && countsTowardCareerRecord(s.seasonNumber),
  );
  const recordSeasons = [...history, ...(current && countsTowardCareerRecord(current.seasonNumber) ? [current] : [])];
  const domestic = aggregateDomestic(recordSeasons.filter((s) => countsTowardCareerRecord(s.seasonNumber)));
  const continental = aggregateContinental(recordSeasons.filter((s) => countsTowardCareerRecord(s.seasonNumber)));
  const intlGames = nationalTeam?.caps ?? 0;
  const intlGoals = nationalTeam?.goals ?? 0;
  const totalGames = careerGames + intlGames;
  const totalGoals = careerGoals + intlGoals;
  const ratio = totalGames > 0 ? totalGoals / totalGames : 0;
  const trophies = careerTrophyCounts(recordSeasons.filter((s) => countsTowardCareerRecord(s.seasonNumber)));
  const awards = careerAwardCounts(recordSeasons.filter((s) => countsTowardCareerRecord(s.seasonNumber)));
  const week = seasonCalendar && seasonSim
    ? currentCalendarWeek(seasonCalendar, seasonSim.fixtureIndex)
    : current?.gamesPlayed ?? 0;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-5 py-[max(1.25rem,env(safe-area-inset-top))] pb-10 text-white">
      <div className="mb-5 flex items-center justify-between">
        <button type="button" onClick={returnToHub} className="text-xs text-white/40 underline underline-offset-2">
          Back
        </button>
        <span className="text-xs uppercase tracking-wide text-white/40">Career record</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile value={String(totalGames)} label="All games" />
        <StatTile value={String(totalGoals)} label="All goals" />
        <StatTile value={ratio.toFixed(2)} label="All ratio" />
      </div>
      <p className="mt-2 text-center text-[11px] text-white/40">Club and country combined</p>

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

      {(() => {
        const club = clubId ? getClub(clubId) : undefined;
        const value =
          club && careerGames > 0
            ? playerMarketValueFromSeasons({
                age,
                careerGoals,
                careerGames,
                seasons: [...history, ...(current ? [current] : [])],
                fallbackClub: club,
                contractYearsRemaining,
                seasonNumber,
                calendarWeek: week,
              })
            : null;
        if (value == null && careerEarnings <= 0 && weeklyWage <= 0) return null;
        return (
          <p className="mt-3 text-center text-sm text-white/60">
            {value != null ? `Market value ${formatEuros(value)}` : ''}
            {value != null && (careerEarnings > 0 || weeklyWage > 0) ? ' · ' : ''}
            {careerEarnings > 0 || weeklyWage > 0
              ? `Earnings ${formatEuros(careerEarnings)}${weeklyWage > 0 ? ` · ${formatWeeklyWage(weeklyWage)}` : ''}`
              : ''}
          </p>
        );
      })()}

      {nationalTeam && (
        <section className="mt-5 rounded-2xl bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/40">International</p>
          <p className="mt-1 text-lg font-bold">
            {nationalTeam.caps} caps · {nationalTeam.goals} goals
          </p>
          {(nationalTeam.byCompetition ?? []).length === 0 ? (
            <p className="mt-2 text-xs text-white/40">No international appearances yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-white/70">
              {nationalTeam.byCompetition.map((row) => {
                const name = INTERNATIONAL_TOURNAMENTS[row.tournament]?.name ?? row.tournament;
                return (
                  <li key={row.tournament}>
                    <p className="font-semibold text-white/90">{name}</p>
                    <p className="text-xs text-white/50">
                      Qualifying {formatGamesGoals(row.qualifyingGames, row.qualifyingGoals)}
                      {' · '}
                      Tournament {formatGamesGoals(row.finalsGames, row.finalsGoals)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <HonoursPills title="Trophies" items={trophies} empty="No trophies yet" tone="trophy" />
      <HonoursPills title="Awards" items={awards} empty="No awards yet" tone="award" />

      <section className="mt-5 rounded-2xl bg-amber-400/10 p-4">
        <p className="text-xs uppercase tracking-wide text-amber-200/70">World Player of the Year</p>
        {wpyWins.length === 0 ? (
          <p className="mt-2 text-sm text-white/60">No titles yet. Win the Champions League or a major international with an elite season.</p>
        ) : (
          <>
            <p className="mt-1 text-2xl font-extrabold text-amber-200">
              {wpyWins.length} title{wpyWins.length === 1 ? '' : 's'}
            </p>
            <ul className="mt-3 space-y-2">
              {wpyWins.map((season) => (
                <li key={`wpy-${season.seasonNumber}`} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-amber-100">{displaySeasonLabel(season.seasonNumber)}</span>
                  <span className="text-right text-xs text-white/50">
                    Age {season.age} · {seasonClubName(season)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="mt-5 flex flex-col gap-3">
        {seasons.length === 0 && (
          <p className="text-sm text-white/50">
            The reserve year is not part of the career record. First-team seasons will appear here.
          </p>
        )}
        {seasons.map((season) => (
          <SeasonCard key={`${season.inProgress ? 'live' : 'done'}-${season.seasonNumber}`} season={season} />
        ))}
      </div>
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

function SeasonCard({ season }: { season: SeasonRecord & { inProgress?: boolean } }) {
  const club = getClub(season.clubId);
  const awards = awardLabels(season);
  const trophies = season.trophies ?? [];

  return (
    <article className="rounded-2xl bg-white/5 p-4" style={club ? { borderLeft: `4px solid ${club.color}` } : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/40">
            {displaySeasonLabel(season.seasonNumber)}
            {season.inProgress ? ' · in progress' : ''}
            {' · '}
            Age {season.age}
          </p>
          <h2 className="text-lg font-extrabold">{seasonClubName(season)}</h2>
          <p className="text-xs text-white/50">
            {club?.league ?? ''} · {ROLE_LABEL[season.role] ?? season.role}
          </p>
        </div>
        {season.wonWpy && (
          <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-200">
            WPY
          </span>
        )}
      </div>

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
      <p className="mt-2 text-xs text-white/50">
        Domestic {formatGamesGoals(season.domesticGames ?? 0, season.domesticGoals ?? 0)}
        {(season.continentalStats ?? []).map((row) => (
          <span key={row.cup}>
            {' · '}
            {continentalLabel(row.cup)} {row.goals}
          </span>
        ))}
      </p>

      <div className="mt-3">
        <p className="text-[10px] uppercase tracking-wide text-white/40">Tournaments won</p>
        {trophies.length === 0 ? (
          <p className="mt-1 text-xs text-white/40">{season.inProgress ? 'Still playing' : 'None'}</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {trophies.map((name) => (
              <span key={name} className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {(awards.length > 0 || season.wonWpy) && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wide text-white/40">Awards</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {awards.map((name) => (
              <span key={name} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                {name}
              </span>
            ))}
            {season.wonWpy && (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                World Player of the Year
              </span>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
