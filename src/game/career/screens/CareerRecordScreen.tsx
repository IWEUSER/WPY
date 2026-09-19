import { getClub } from '../data/clubs';
import { formatInternationalSeason, seasonClubName, seasonLeagueLabel } from '../honoursDisplay';
import { countsTowardCareerRecord, displaySeasonLabel } from '../seasonDisplay';
import { aggregateContinental, aggregateDomesticSplit, seasonDomesticSplit } from '../seasonStats';
import { useCareerStore } from '../store';
import type { SeasonRecord } from '../types';
import { DATA_CARD, DATA_TILE } from './dataUi';
import { ClubCompetitionTable, InternationalSeasonBlock } from './StatsTable';

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
  const returnToHub = useCareerStore((s) => s.returnToHub);

  const seasons: Array<SeasonRecord & { inProgress?: boolean }> = [
    ...(current && countsTowardCareerRecord(current.seasonNumber, current.role) ? [{ ...current, inProgress: true }] : []),
    ...[...history].filter((s) => countsTowardCareerRecord(s.seasonNumber, s.role)).reverse(),
  ];
  const recordSeasons = [...history, ...(current && countsTowardCareerRecord(current.seasonNumber, current.role) ? [current] : [])];
  const scoredSeasons = recordSeasons.filter((s) => countsTowardCareerRecord(s.seasonNumber, s.role));
  const domestic = aggregateDomesticSplit(scoredSeasons);
  const continental = aggregateContinental(scoredSeasons);
  const ratio = careerGames > 0 ? careerGoals / careerGames : 0;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-5 py-[max(1.25rem,env(safe-area-inset-top))] pb-10 text-white">
      <div className="mb-5 flex items-center justify-between">
        <button type="button" onClick={returnToHub} className="text-xs text-white/40 underline underline-offset-2">
          Back
        </button>
        <span className="text-xs uppercase tracking-wide text-white/40">Career record</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile value={String(careerGames)} label="Club games" />
        <StatTile value={String(careerGoals)} label="Club goals" />
        <StatTile value={ratio.toFixed(2)} label="Club ratio" />
      </div>

      <div className={`mt-3 ${DATA_CARD} text-sm`}>
        <p className="text-xs uppercase tracking-wide text-white/40">Club</p>
        <ClubCompetitionTable split={domestic} continental={continental} alwaysShowEuropean />
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {seasons.length === 0 && (
          <p className="text-sm text-white/50">
            Season 1 will appear here once you play your first first-team match.
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
    <div className={DATA_TILE}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
    </div>
  );
}

function SeasonCard({ season }: { season: SeasonRecord & { inProgress?: boolean } }) {
  const club = getClub(season.clubId);
  const careerStart = useCareerStore((s) => s.careerStart);

  return (
    <article className={DATA_CARD} style={club ? { borderLeft: `4px solid ${club.color}` } : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/40">
            {displaySeasonLabel(season.seasonNumber, { role: season.role, careerStart })}
            {season.inProgress ? ' · in progress' : ''}
            {' · '}
            Age {season.age}
          </p>
          <h2 className="mt-1 text-lg font-extrabold">{seasonClubName(season)}</h2>
          <p className="text-xs text-white/50">
            {seasonLeagueLabel(season)} · {ROLE_LABEL[season.role] ?? season.role}
          </p>
        </div>
      </div>

      <ClubCompetitionTable
        split={seasonDomesticSplit(season)}
        continental={season.continentalStats ?? []}
      />
      {season.international && formatInternationalSeason(season.international) && (
        <div className="mt-2">
          <InternationalSeasonBlock
            title={formatInternationalSeason(season.international)?.name ?? 'International'}
            record={season.international}
          />
        </div>
      )}
    </article>
  );
}
