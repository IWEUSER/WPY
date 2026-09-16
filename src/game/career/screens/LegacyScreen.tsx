import { useMemo, useState } from 'react';
import { GAME_TITLE } from '../../branding';
import { getNation } from '../international';
import {
  careerLegacyBoards,
  chaseBoardIds,
  type LegacyBoardView,
  type LegacyReveal,
} from '../legacyRecords';
import { countsTowardCareerRecord } from '../seasonDisplay';
import { useCareerStore } from '../store';
import { DATA_CARD, DATA_TILE } from './dataUi';

const GROUPS: Array<{ id: LegacyBoardView['def']['group'] | 'chase'; label: string }> = [
  { id: 'chase', label: 'Chase' },
  { id: 'league', label: 'Leagues' },
  { id: 'club', label: 'UCL' },
  { id: 'national', label: 'Cups' },
  { id: 'international', label: 'International' },
];

export default function LegacyScreen() {
  const history = useCareerStore((s) => s.seasonHistory);
  const current = useCareerStore((s) => s.currentSeason);
  const nationalTeam = useCareerStore((s) => s.nationalTeam);
  const clubLeague = useCareerStore((s) => s.clubLeague);
  const nationality = useCareerStore((s) => s.nationality);
  const returnFromLegacy = useCareerStore((s) => s.returnFromLegacy);
  const [group, setGroup] = useState<(typeof GROUPS)[number]['id']>('chase');
  const [openId, setOpenId] = useState<string | null>(null);

  const seasons = useMemo(
    () => [
      ...history.filter((season) => countsTowardCareerRecord(season.seasonNumber, season.role)),
      ...(current && countsTowardCareerRecord(current.seasonNumber, current.role) ? [current] : []),
    ],
    [history, current],
  );
  const input = useMemo(
    () => ({
      seasons,
      nationalTeam,
      currentLeague: current?.league ?? clubLeague,
      nationalityConfederation: nationality ? getNation(nationality)?.confederation ?? null : null,
    }),
    [seasons, nationalTeam, current?.league, clubLeague, nationality],
  );
  const boards = useMemo(() => careerLegacyBoards(input), [input]);
  const chaseIds = useMemo(() => new Set(chaseBoardIds(input)), [input]);
  const visible = boards.filter((board) => {
    if (group === 'chase') return chaseIds.has(board.def.id);
    return board.def.group === group;
  });
  const listedCount = boards.filter((board) => board.reveal !== 'outside').length;
  const topCount = boards.filter((board) => board.reveal === 'top10').length;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-5 py-[max(1.25rem,env(safe-area-inset-top))] pb-10 text-white">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={returnFromLegacy} className="text-xs text-white/40 underline underline-offset-2">
          Back
        </button>
        <span className="text-xs uppercase tracking-[0.18em] text-amber-200/80">Legacy</span>
      </div>

      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="" className="h-12 w-12 rounded-xl ring-1 ring-amber-200/30" />
        <div>
          <h1 className="font-brand text-2xl leading-none text-white">{GAME_TITLE}</h1>
          <p className="mt-1 text-xs text-white/50">All-time scoring records. Fictional names, real chase.</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatTile value={String(boards.length)} label="Boards" />
        <StatTile value={String(listedCount)} label="Inside 99" />
        <StatTile value={String(topCount)} label="Top 10" />
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {GROUPS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setGroup(item.id);
              setOpenId(null);
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
              group === item.id ? 'bg-amber-400 text-black' : 'bg-white/8 text-white/60 ring-1 ring-white/10'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {visible.map((board) => (
          <BoardCard
            key={board.def.id}
            board={board}
            open={openId === board.def.id}
            onToggle={() => setOpenId((id) => (id === board.def.id ? null : board.def.id))}
          />
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

function BoardCard({
  board,
  open,
  onToggle,
}: {
  board: LegacyBoardView;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={DATA_CARD}>
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3 text-left">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-white/40">{board.def.subtitle}</p>
          <h2 className="mt-0.5 text-lg font-extrabold">{board.def.title}</h2>
          <p className="mt-1 text-sm text-white/60">{statusLine(board)}</p>
        </div>
        <RankBadge reveal={board.reveal} label={board.rankLabel} />
      </button>
      {open && <BoardDetail board={board} />}
    </article>
  );
}

function RankBadge({ reveal, label }: { reveal: LegacyReveal; label: string }) {
  const tone =
    reveal === 'top10'
      ? 'bg-amber-400/20 text-amber-200'
      : reveal === 'listed'
        ? 'bg-emerald-400/15 text-emerald-300'
        : 'bg-white/10 text-white/50';
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ${tone}`}>
      {label}
    </span>
  );
}

function statusLine(board: LegacyBoardView): string {
  if (board.reveal === 'outside') {
    if (board.playerGoals <= 0) return '100+ · score to enter the all-time 99';
    return `100+ · ${board.playerGoals} goals · ${board.goalsToEnter} more to enter`;
  }
  if (board.reveal === 'listed') {
    return `${board.rankLabel} · ${board.playerGoals} goals · ${board.goalsToTop10} more to reach the top 10`;
  }
  if (board.rank === 1) return `Record holder · ${board.playerGoals} goals`;
  const ahead = board.table?.find((row) => !row.you && row.rank < board.rank);
  if (!ahead) return `${board.rankLabel} · ${board.playerGoals} goals`;
  const gap = ahead.goals + 1 - board.playerGoals;
  return `${board.rankLabel} · ${gap} more to overtake ${ahead.name}`;
}

function BoardDetail({ board }: { board: LegacyBoardView }) {
  if (board.reveal === 'outside') {
    return (
      <p className="mt-3 text-xs text-white/45">
        Names stay hidden until you reach the 99th place total
        {board.goalsToEnter > 0 ? ` (${board.historical[board.historical.length - 1]?.goals} goals)` : ''}.
      </p>
    );
  }
  if (board.reveal === 'listed') {
    return (
      <p className="mt-3 text-xs text-white/45">
        Rank {board.rankLabel} with {board.playerGoals} goals. The top 10 table unlocks at {board.tenthGoals} goals.
      </p>
    );
  }
  if (!board.table) return null;
  return (
    <table className="mt-3 w-full table-fixed border-collapse text-sm">
      <colgroup>
        <col className="w-10" />
        <col />
        <col className="w-14" />
      </colgroup>
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-white/40">
          <th className="pb-1 pr-2 text-left font-medium">#</th>
          <th className="pb-1 text-left font-medium">Player</th>
          <th className="pb-1 text-right font-medium">Goals</th>
        </tr>
      </thead>
      <tbody>
        {board.table.map((row) => (
          <tr
            key={`${row.rank}-${row.name}`}
            className={row.you ? 'bg-amber-400/15 font-bold text-amber-100' : 'text-white/80'}
          >
            <td className="py-1 pr-2 tabular-nums">{row.rank}</td>
            <td className="py-1">{row.name}</td>
            <td className="py-1 text-right tabular-nums">{row.goals}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
