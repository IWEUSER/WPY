import { getClub } from '../data/clubs';
import { useCareerStore, SEASON_LENGTH } from '../store';

export default function SeasonSummaryScreen() {
  const clubId = useCareerStore((s) => s.clubId);
  const season = useCareerStore((s) => s.currentSeason);
  const role = useCareerStore((s) => s.role);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const continueAfterSeason = useCareerStore((s) => s.continueAfterSeason);

  const club = clubId ? getClub(clubId) : undefined;
  if (!club || !season) return null;

  const ratio = season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
  const threshold = role === 'first-team' ? club.firstTeamGoalRatio : club.reserveGoalRatio;
  const ratioMet = ratio >= threshold;
  const gamesMissed = SEASON_LENGTH - season.gamesPlayed;

  let headline: string;
  let detail: string;
  if (role === 'reserve') {
    headline = ratioMet ? 'Promoted to the First Team!' : 'Ratio not met';
    detail = ratioMet
      ? `You hit ${club.reserveGoalRatio.toFixed(2)} goals/game in the reserves - the manager wants you in the first-team squad for Season ${seasonNumber + 1}.`
      : `Season 2's loan-move logic (leaving on loan to a lower club, then a return-or-sale decision in Season 3) is the next system to build. For now you'll keep grinding it out in the reserves.`;
  } else {
    headline = ratioMet ? 'Place secured' : 'Under pressure';
    detail = ratioMet
      ? `You maintained ${club.firstTeamGoalRatio.toFixed(2)} goals/game in the first team - your place is safe going into Season ${seasonNumber + 1}.`
      : `Your ratio slipped below ${club.firstTeamGoalRatio.toFixed(2)} goals/game. The transfer-market logic that reacts to this (moving up or down based on your ratio, with a grace period at a new club) is the next system to build.`;
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6 text-center text-white">
      <div>
        <p className="text-xs uppercase tracking-wide text-white/40">Season {seasonNumber} complete</p>
        <h1 className="mt-1 text-2xl font-extrabold">{headline}</h1>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-white/5 p-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xl font-bold">{season.goals}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Goals</p>
          </div>
          <div>
            <p className="text-xl font-bold">{season.gamesPlayed}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Played</p>
          </div>
          <div>
            <p className="text-xl font-bold">{gamesMissed}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Missed</p>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold text-white/80">
          Ratio: {ratio.toFixed(2)} / {threshold.toFixed(2)} required
        </p>
      </div>

      <p className="max-w-sm text-sm text-white/60">{detail}</p>

      <button
        type="button"
        onClick={continueAfterSeason}
        className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        Continue to Season {seasonNumber + 1}
      </button>
    </div>
  );
}
