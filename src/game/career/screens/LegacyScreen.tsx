import { useMemo, useState } from 'react';
import { GAME_TITLE } from '../../branding';
import { careerLegacyBoards, goalsLabel, type LegacyBoardView, type LegacyReveal } from '../legacyRecords';
import { countsTowardCareerRecord } from '../seasonDisplay';
import { useCareerStore } from '../store';
import { DATA_CARD, DATA_TILE } from './dataUi';

const TONE_CLASS: Record<LegacyBoardView['def']['tone'], string> = {
  'all-time': 'border-amber-400/40 bg-amber-950/30',
  'season-overall': 'border-sky-400/40 bg-sky-950/30',
  'season-club': 'border-violet-400/40 bg-violet-950/30',
  'season-intl': 'border-emerald-400/40 bg-emerald-950/30',
};

const TONE_LABEL: Record<LegacyBoardView['def']['tone'], string> = {
  'all-time': 'All-time',
  'season-overall': 'Single season',
  'season-club': 'Club season',
  'season-intl': 'International tournament',
};

const TONE_BADGE: Record<LegacyBoardView['def']['tone'], string> = {
  'all-time': 'bg-amber-400/20 text-amber-200',
  'season-overall': 'bg-sky-400/20 text-sky-200',
  'season-club': 'bg-violet-400/20 text-violet-200',
  'season-intl': 'bg-emerald-400/20 text-emerald-200',
};

const GROUPS: Array<{ id: LegacyBoardView['def']['group'] | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'club-overall', label: 'Club' },
  { id: 'league', label: 'Leagues' },
  { id: 'cup', label: 'Cups' },
  { id: 'continental', label: 'Continental' },
  { id: 'nation', label: 'International' },
];

export default function LegacyScreen() {
  const history = useCareerStore((s) => s.seasonHistory);
  const current = useCareerStore((s) => s.currentSeason);
  const nationalTeam = useCareerStore((s) => s.nationalTeam);
  const nationality = useCareerStore((s) => s.nationality);
  const playerName = useCareerStore((s) => s.playerName);
  const returnFromLegacy = useCareerStore((s) => s.returnFromLegacy);
  const [group, setGroup] = useState<(typeof GROUPS)[number]['id']>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const seasons = useMemo(
    () => [
      ...history.filter((season) => countsTowardCareerRecord(season.seasonNumber, season.role)),
      ...(current && countsTowardCareerRecord(current.seasonNumber, current.role) ? [current] : []),
    ],
    [history, current],
  );
  const input = useMemo(
    () => ({ seasons, nationalTeam, nationality, playerName }),
    [seasons, nationalTeam, nationality, playerName],
  );
  const boards = useMemo(() => careerLegacyBoards(input), [input]);
  const visible = boards.filter((board) => group === 'all' || board.def.group === group);
  const topCount = boards.filter((board) => board.reveal === 'top10').length;
  const you = playerName?.trim() || 'You';

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
          <p className="mt-1 text-xs text-white/50">Sourced all-time and single-season totals. Rank and the number to chase.</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
        <span className={`rounded-full px-2 py-1 ${TONE_BADGE['season-overall']}`}>Single season</span>
        <span className={`rounded-full px-2 py-1 ${TONE_BADGE['season-club']}`}>Club season</span>
        <span className={`rounded-full px-2 py-1 ${TONE_BADGE['season-intl']}`}>Intl tournament</span>
        <span className={`rounded-full px-2 py-1 ${TONE_BADGE['all-time']}`}>All-time</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatTile value={String(boards.length)} label="Boards" />
        <StatTile value={String(topCount)} label="Top 10" />
        <StatTile value={you} label="Name" />
      </div>

      {boards.length === 0 && (
        <p className="mt-6 text-sm text-white/50">Records appear for tournaments you have played in.</p>
      )}

      {boards.length > 0 && (
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
          {GROUPS.filter((item) => item.id === 'all' || boards.some((board) => board.def.group === item.id)).map((item) => (
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
      )}

      <div className="mt-4 flex flex-col gap-3">
        {visible.map((board) => (
          <BoardCard
            key={board.def.id}
            board={board}
            open={openId === board.def.id || board.reveal === 'top10'}
            onToggle={() => setOpenId((id) => (id === board.def.id ? null : board.def.id))}
            playerName={you}
          />
        ))}
      </div>
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className={DATA_TILE}>
      <p className="truncate text-lg font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
    </div>
  );
}

function BoardCard({
  board,
  open,
  onToggle,
  playerName,
}: {
  board: LegacyBoardView;
  open: boolean;
  onToggle: () => void;
  playerName: string;
}) {
  return (
    <article className={`${DATA_CARD} ${TONE_CLASS[board.def.tone]}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-start justify-between gap-3 text-left">
        <div>
          <p className={`text-[10px] uppercase tracking-wide ${TONE_BADGE[board.def.tone]} inline-block rounded-full px-2 py-0.5`}>
            {TONE_LABEL[board.def.tone]}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-wide text-white/40">{board.def.subtitle}</p>
          <h2 className="mt-0.5 text-lg font-extrabold">{board.def.title}</h2>
          <p className="mt-1 text-sm text-white/60">{statusLine(board, playerName)}</p>
        </div>
        <RankBadge reveal={board.reveal} label={board.reveal === 'top10' ? board.rankLabel : '—'} />
      </button>
      {open && <BoardDetail board={board} playerName={playerName} />}
    </article>
  );
}

function RankBadge({ reveal, label }: { reveal: LegacyReveal; label: string }) {
  const tone = reveal === 'top10' ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-white/50';
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ${tone}`}>
      {label}
    </span>
  );
}

function statusLine(board: LegacyBoardView, playerName: string): string {
  if (board.reveal === 'outside') {
    if (board.playerGoals <= 0) {
      return `${board.tenthGoals} to enter the sourced top ${Math.min(10, board.historical.length)}`;
    }
    return `${goalsLabel(board.playerGoals)} · ${board.goalsToTop10} more to enter`;
  }
  if (board.rank === 1) return `Record · ${playerName} · ${goalsLabel(board.playerGoals)}`;
  return `${board.rankLabel} · ${playerName} · ${goalsLabel(board.playerGoals)}`;
}

function BoardDetail({ board, playerName }: { board: LegacyBoardView; playerName: string }) {
  if (board.reveal === 'outside') {
    return (
      <p className="mt-3 text-xs text-white/45">
        The sourced top {Math.min(10, board.historical.length)} starts at {goalsLabel(board.tenthGoals)}.
      </p>
    );
  }
  if (!board.table) return null;
  return (
    <table className="mt-3 w-full table-fixed border-collapse text-sm">
      <colgroup>
        <col className="w-10" />
        <col />
      </colgroup>
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-white/40">
          <th className="pb-1 pr-2 text-left font-medium">#</th>
          <th className="pb-1 text-right font-medium">Goals</th>
        </tr>
      </thead>
      <tbody>
        {board.table.map((row) => (
          <tr
            key={`${row.rank}-${row.goals}-${row.you ? 'you' : 'rec'}`}
            className={row.you ? 'bg-amber-400/15 font-bold text-amber-100' : 'text-white/80'}
          >
            <td className="py-1 pr-2 tabular-nums">{row.rank}</td>
            <td className="py-1 text-right tabular-nums">
              {row.goals}
              {row.you ? <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide">{playerName}</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
