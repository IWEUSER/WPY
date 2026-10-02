import { getClub } from '../data/clubs';
import { formatInternationalSeason, seasonClubName, seasonLeagueLabel } from '../honoursDisplay';
import { goalsLabel, identityLegacyBoards } from '../legacyRecords';
import { formatEuros } from '../playerValue';
import { countsTowardCareerRecord, displaySeasonLabel } from '../seasonDisplay';
import { aggregateContinental, aggregateDomesticSplit, careerClubRecord, careerTransferFeesPaid, seasonDomesticSplit } from '../seasonStats';
import { useCareerStore } from '../store';
import type { SeasonRecord } from '../types';
import { DATA_CARD, DATA_TILE } from './dataUi';
import { SeasonHonoursLines } from './HonoursPills';
import { RECORD_KIND_BADGE, RECORD_KIND_LABEL, RECORD_KIND_TEXT, RECORD_KIND_VALUE, colorKindForDef } from './recordColors';
import { ClubCompetitionTable, InternationalSeasonBlock } from './StatsTable';

const ROLE_LABEL: Record<string, string> = {
  reserve: 'Reserves',
  'first-team': 'First team',
  loan: 'Loan',
};

export default function CareerRecordScreen() {
  const history = useCareerStore((s) => s.seasonHistory);
  const current = useCareerStore((s) => s.currentSeason);
  const nationalTeam = useCareerStore((s) => s.nationalTeam);
  const nationality = useCareerStore((s) => s.nationality);
  const playerName = useCareerStore((s) => s.playerName);
  const returnToHub = useCareerStore((s) => s.returnToHub);

  const seasons: Array<SeasonRecord & { inProgress?: boolean }> = [
    ...(current && countsTowardCareerRecord(current.seasonNumber, current.role) ? [{ ...current, inProgress: true }] : []),
    ...[...history].filter((s) => countsTowardCareerRecord(s.seasonNumber, s.role)).reverse(),
  ];
  const recordSeasons = [...history, ...(current && countsTowardCareerRecord(current.seasonNumber, current.role) ? [current] : [])];
  const scoredSeasons = recordSeasons.filter((s) => countsTowardCareerRecord(s.seasonNumber, s.role));
  const domestic = aggregateDomesticSplit(scoredSeasons);
  const continental = aggregateContinental(scoredSeasons);
  const feesPaid = careerTransferFeesPaid(recordSeasons);
  const clubRecord = careerClubRecord(scoredSeasons);
  const ratio = clubRecord.ratio;
  const records = identityLegacyBoards({
    seasons: scoredSeasons,
    nationalTeam,
    nationality,
    playerName,
  });

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-5 py-[max(1.25rem,env(safe-area-inset-top))] pb-10 text-white">
      <div className="mb-5 flex items-center justify-between">
        <button type="button" onClick={returnToHub} className="text-xs text-white/40 underline underline-offset-2">
          Back
        </button>
        <span className="text-xs uppercase tracking-wide text-white/40">Career record</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile value={String(clubRecord.games)} label="Club games" />
        <StatTile value={String(clubRecord.goals)} label="Club goals" />
        <StatTile value={ratio.toFixed(2)} label="Club ratio" />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2">
        <StatTile value={feesPaid > 0 ? formatEuros(feesPaid) : '—'} label="Transfer fees paid" />
      </div>

      <div className={`mt-3 ${DATA_CARD} text-sm`}>
        <p className="text-xs uppercase tracking-wide text-white/40">Club</p>
        <ClubCompetitionTable split={domestic} continental={continental} alwaysShowEuropean />
      </div>

      <div className={`mt-3 ${DATA_CARD} text-sm`}>
        <p className="text-xs uppercase tracking-wide text-white/40">Records</p>
        {records.length === 0 ? (
          <p className="mt-2 text-sm text-white/50">No top-10 records yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {records.map((board) => {
              const kind = colorKindForDef(board.def);
              return (
                <li key={board.def.id} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={`font-semibold ${RECORD_KIND_TEXT[kind]}`}>
                    {board.def.title}
                    <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-white/45">
                      {board.def.subtitle}
                    </span>
                    <span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${RECORD_KIND_BADGE[kind]}`}>
                      {RECORD_KIND_LABEL[kind]}
                    </span>
                  </span>
                  <span className={`shrink-0 text-right ${RECORD_KIND_VALUE[kind]}`}>
                    {board.rankLabel}
                    <span className="block text-[10px] text-white/50">{goalsLabel(board.playerGoals)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
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
          {(season.transferFeePaid ?? 0) > 0 && (
            <p className="mt-1 text-xs font-semibold text-amber-200/90">
              Transfer fee {formatEuros(season.transferFeePaid ?? 0)}
              {season.transferFromClubId ? ` from ${getClub(season.transferFromClubId)?.name ?? season.transferFromClubId}` : ''}
            </p>
          )}
        </div>
      </div>

      <ClubCompetitionTable
        split={seasonDomesticSplit(season)}
        continental={season.continentalStats ?? []}
      />
      <SeasonHonoursLines season={season} />
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
