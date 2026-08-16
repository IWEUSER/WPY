import { getClub } from '../data/clubs';
import { describeAvailability, isAvailable } from '../availabilityEngine';
import { useCareerStore, SEASON_LENGTH } from '../store';

const ROLE_LABEL: Record<string, string> = {
  reserve: 'Reserve Team',
  'first-team': 'First Team',
  loan: 'On Loan',
};

export default function CareerHub({ onOpenMenu }: { onOpenMenu: () => void }) {
  const age = useCareerStore((s) => s.age);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const clubId = useCareerStore((s) => s.clubId);
  const role = useCareerStore((s) => s.role);
  const season = useCareerStore((s) => s.currentSeason);
  const availability = useCareerStore((s) => s.availability);
  const careerGoals = useCareerStore((s) => s.careerGoals);
  const careerGames = useCareerStore((s) => s.careerGames);
  const advance = useCareerStore((s) => s.advance);

  const club = clubId ? getClub(clubId) : undefined;
  if (!club || !season) return null;

  const played = season.gamesPlayed;
  const goals = season.goals;
  const ratio = played > 0 ? goals / played : 0;
  const threshold = role === 'first-team' ? club.firstTeamGoalRatio : club.reserveGoalRatio;
  const ratioProgress = Math.min(1, threshold > 0 ? ratio / threshold : 0);
  const available = isAvailable(availability);
  const matchesLeft = SEASON_LENGTH - season.matches.length;

  return (
    <div className="flex h-full w-full flex-col gap-5 overflow-y-auto px-5 py-[max(1.25rem,env(safe-area-inset-top))] pb-8 text-white">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onOpenMenu} className="text-xs text-white/40 underline underline-offset-2">
          Menu
        </button>
        <span className="text-xs text-white/40">Age {age}</span>
      </div>

      <div className="rounded-2xl bg-white/5 p-4" style={{ borderLeft: `4px solid ${club.color}` }}>
        <p className="text-xs uppercase tracking-wide text-white/40">
          Season {seasonNumber} · {ROLE_LABEL[role]}
        </p>
        <h1 className="text-2xl font-extrabold">{club.name}</h1>
        <p className="text-xs text-white/50">
          {club.country} · {club.league}
        </p>
      </div>

      <div
        className={`rounded-xl px-4 py-3 text-sm font-semibold ${
          available ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
        }`}
      >
        {describeAvailability(availability)}
      </div>

      <div className="rounded-2xl bg-white/5 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-white/40">Season ratio</span>
          <span className="text-sm font-bold">
            {goals} goal{goals === 1 ? '' : 's'} / {played} played
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${ratioProgress >= 1 ? 'bg-emerald-400' : 'bg-amber-400'}`}
            style={{ width: `${ratioProgress * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-white/50">
          Need {threshold.toFixed(2)} goals/game to {role === 'first-team' ? 'keep your place' : 'earn a promotion'} ·
          currently {ratio.toFixed(2)}
        </p>
        <p className="mt-1 text-xs text-white/40">{matchesLeft} matches left this season</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <p className="text-lg font-bold">{careerGoals}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Career goals</p>
        </div>
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <p className="text-lg font-bold">{careerGames}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Career games</p>
        </div>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={advance}
        className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        {available ? 'Play Next Match' : 'Continue'}
      </button>
    </div>
  );
}
