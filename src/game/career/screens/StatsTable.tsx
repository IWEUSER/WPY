import {
  formatInternationalSeason,
  qualifyingOutcomeLabel,
  tournamentOutcomeLabel,
} from '../honoursDisplay';
import {
  continentalLabel,
  type DomesticSplit,
} from '../seasonStats';
import type { ContinentalSeasonStat, InternationalSeasonRecord } from '../types';

export interface StatsTableRow {
  label: string;
  games: number;
  goals: number;
}

export default function StatsTable({
  rows,
  footer,
  footerNote,
  alwaysShowRows = false,
}: {
  rows: StatsTableRow[];
  footer?: StatsTableRow;
  footerNote?: string;
  alwaysShowRows?: boolean;
}) {
  const visible = alwaysShowRows ? rows : rows.filter((row) => row.games > 0 || row.goals > 0);
  if (visible.length === 0 && !footer) return null;
  return (
    <table className="mt-2 w-full border-collapse text-left text-sm">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-white/40">
          <th className="pb-1 pr-3 font-medium"> </th>
          <th className="pb-1 text-right font-medium">Games</th>
          <th className="pb-1 text-right font-medium">Goals</th>
        </tr>
      </thead>
      <tbody>
        {visible.map((row) => (
          <tr key={row.label} className="text-white/80">
            <td className="py-0.5 pr-3">{row.label}</td>
            <td className="py-0.5 text-right tabular-nums">{row.games}</td>
            <td className="py-0.5 text-right tabular-nums">{row.goals}</td>
          </tr>
        ))}
      </tbody>
      {footer && (
        <tfoot>
          <tr className="border-t border-white/10 font-semibold text-white">
            <td className="pt-1.5 pr-3">{footer.label}</td>
            <td className="pt-1.5 text-right tabular-nums">{footer.games}</td>
            <td className="pt-1.5 text-right tabular-nums">{footer.goals}</td>
          </tr>
          {footerNote && (
            <tr>
              <td colSpan={3} className="pt-1 text-right text-xs font-semibold tabular-nums text-white/70">
                {footerNote}
              </td>
            </tr>
          )}
        </tfoot>
      )}
    </table>
  );
}

/** League, cup, and European rows in one list, with a single total + ratio. */
export function ClubCompetitionTable({
  split,
  continental = [],
  alwaysShowEuropean = false,
}: {
  split: DomesticSplit;
  continental?: ContinentalSeasonStat[];
  alwaysShowEuropean?: boolean;
}) {
  const euroRows = continental.map((row) => ({
    label: continentalLabel(row.cup),
    games: row.games,
    goals: row.goals,
  }));
  const rows: StatsTableRow[] = [
    { label: 'League', games: split.league.games, goals: split.league.goals },
    { label: 'Cup', games: split.cup.games, goals: split.cup.goals },
    ...euroRows,
  ];
  if (alwaysShowEuropean && euroRows.length === 0) {
    rows.push({ label: 'European', games: 0, goals: 0 });
  }
  const totalGames = split.total.games + euroRows.reduce((sum, row) => sum + row.games, 0);
  const totalGoals = split.total.goals + euroRows.reduce((sum, row) => sum + row.goals, 0);
  const ratio = totalGames > 0 ? totalGoals / totalGames : 0;
  return (
    <StatsTable
      alwaysShowRows
      rows={rows}
      footer={{ label: 'Total', games: totalGames, goals: totalGoals }}
      footerNote={`Ratio ${ratio.toFixed(2)}`}
    />
  );
}

export function DomesticStatsTable({ split }: { split: DomesticSplit }) {
  return (
    <StatsTable
      alwaysShowRows
      rows={[
        { label: 'League', games: split.league.games, goals: split.league.goals },
        { label: 'Cup', games: split.cup.games, goals: split.cup.goals },
      ]}
      footer={{ label: 'Total', games: split.total.games, goals: split.total.goals }}
    />
  );
}

export function InternationalSeasonBlock({
  title,
  record,
}: {
  title: string;
  record: InternationalSeasonRecord | undefined | null;
}) {
  const line = formatInternationalSeason(record);
  if (!line || !record) return null;
  const qNote = qualifyingOutcomeLabel(record.qualifyingOutcome);
  const tNote = tournamentOutcomeLabel(record.tournamentOutcome);
  return (
    <div>
      <p className="font-semibold text-white/90">{title}</p>
      <StatsTable
        rows={[
          { label: qNote ? `Qualifying · ${qNote}` : 'Qualifying', games: record.qualifyingGames, goals: record.qualifyingGoals },
          { label: tNote ? `Tournament · ${tNote}` : 'Tournament', games: record.finalsGames, goals: record.finalsGoals },
        ]}
      />
      {line.awards.length > 0 && (
        <p className="mt-1 text-xs text-sky-200/80">{line.awards.join(' · ')}</p>
      )}
    </div>
  );
}
