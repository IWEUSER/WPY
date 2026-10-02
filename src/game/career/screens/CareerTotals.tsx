import { formatEuros } from '../playerValue';
import { countsTowardCareerRecord } from '../seasonDisplay';
import { aggregateContinental, aggregateDomesticSplit, careerClubRecord, careerTransferFeesPaid } from '../seasonStats';
import type { SeasonRecord } from '../types';
import { DATA_CARD, DATA_TILE } from './dataUi';
import { ClubCompetitionTable } from './StatsTable';

export function CareerTotals({ seasons }: { seasons: SeasonRecord[] }) {
  const scored = seasons.filter((season) => countsTowardCareerRecord(season.seasonNumber, season.role));
  const domestic = aggregateDomesticSplit(scored);
  const continental = aggregateContinental(scored);
  const feesPaid = careerTransferFeesPaid(seasons);
  const clubRecord = careerClubRecord(scored);
  const ratio = clubRecord.ratio;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <StatTile value={String(clubRecord.games)} label="Club games" />
        <StatTile value={String(clubRecord.goals)} label="Club goals" />
        <StatTile value={ratio.toFixed(2)} label="Club ratio" />
      </div>
      <StatTile value={feesPaid > 0 ? formatEuros(feesPaid) : '—'} label="Transfer fees paid" />
      <div className={`${DATA_CARD} text-sm`}>
        <p className="text-xs uppercase tracking-wide text-white/40">Club</p>
        <ClubCompetitionTable split={domestic} continental={continental} alwaysShowEuropean />
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
