import type { DomesticSplit } from '../seasonStats';

export interface StatsTableRow {
  label: string;
  games: number;
  goals: number;
}

export default function StatsTable({
  rows,
  footer,
  alwaysShowRows = false,
}: {
  rows: StatsTableRow[];
  footer?: StatsTableRow;
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
        </tfoot>
      )}
    </table>
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
