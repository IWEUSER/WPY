import { getClub, TIER_LABEL } from '../data/clubs';
import { getNation } from '../international';
import { useCareerStore } from '../store';
import { CLUB_TRIAL_GAMES, trialGoalsNeeded, trialRatioRequired, TRIALS_AT_LEVEL } from '../trial';
import { tierForRatio } from '../transfers';

export default function OpeningBriefScreen() {
  const opening = useCareerStore((s) => s.openingCampaign);
  const nationality = useCareerStore((s) => s.nationality);
  const pendingTransfer = useCareerStore((s) => s.pendingTransfer);
  const startOpeningTrial = useCareerStore((s) => s.startOpeningTrial);

  const nation = nationality ? getNation(nationality) : undefined;
  const club = opening?.trialClubId ? getClub(opening.trialClubId) : undefined;
  const rejectedId = opening?.rejectedClubIds[opening.rejectedClubIds.length - 1];
  const rejected = rejectedId ? getClub(rejectedId) : undefined;
  const afterYouth = opening?.kind === 'youth-tournament';
  const offersReady = Boolean(pendingTransfer) && opening?.kind === 'club-trial';
  const youthGoals = opening?.youthGoals ?? opening?.goals ?? 0;
  const youthGames = afterYouth ? (opening?.gamesPlayed ?? 0) : null;
  const needed = club ? trialGoalsNeeded(club) : 0;
  const required = club ? trialRatioRequired(club) : 0;
  const trialRatio = opening && opening.gamesPlayed > 0 ? opening.goals / opening.gamesPlayed : 0;
  const looksUsed = opening?.rejectedClubIds.length ?? 0;
  const lookNumber = offersReady ? looksUsed : looksUsed + 1;
  const bestRatio = opening?.bestTrialRatio ?? trialRatio;
  const offerTier = tierForRatio(bestRatio);
  const offerBand = TIER_LABEL[offerTier].toLowerCase();

  return (
    <div className="flex h-full w-full flex-col items-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div>
        <p className="text-sm text-white/50">
          {afterYouth
            ? opening?.youthName ?? 'Youth Championship'
            : offersReady
              ? 'Trials complete'
              : looksUsed > 0
                ? `Look ${lookNumber} of ${TRIALS_AT_LEVEL}`
                : 'Club trial'}
        </p>
        <h1 className="font-display text-2xl font-bold">
          {afterYouth
            ? `${youthGoals} goal${youthGoals === 1 ? '' : 's'} for ${nation?.name ?? 'your country'}`
            : offersReady
              ? `${opening?.goals ?? 0} goal${opening?.goals === 1 ? '' : 's'} in ${opening?.gamesPlayed ?? CLUB_TRIAL_GAMES} games`
              : `${rejected?.name ?? 'The club'} turned you down`}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">
          {afterYouth
            ? `${nation?.name ?? 'You'} played ${youthGames} ${youthGames === 1 ? 'game' : 'games'} at the ${opening?.youthName}. Scouts from ${club ? TIER_LABEL[club.tier].toLowerCase() : 'the next'} clubs were watching. Miss this trial and you get two more looks at the same level.`
            : offersReady
              ? `Your best trial ratio was ${bestRatio.toFixed(2)}. ${TIER_LABEL[offerTier]} clubs want to sign you. A later transfer, including back toward a club that turned you down, is possible — not guaranteed.`
              : `You did not hit the goal ratio they needed. This is look ${lookNumber} of ${TRIALS_AT_LEVEL} at this level. If none of them sign you, clubs will bid from your best ratio. A later move, including toward a club that turned you down, is possible — not guaranteed.`}
        </p>
      </div>

      {club && !offersReady && (
        <div
          className="w-full max-w-sm rounded-2xl bg-white/5 p-4 text-left"
          style={{ borderLeft: `4px solid ${club.color}` }}
        >
          <p className="text-xs uppercase tracking-wide text-white/40">
            {afterYouth ? 'Trial earned' : looksUsed > 0 ? 'Next trial' : 'Club trial'}
          </p>
          <p className="mt-1 text-lg font-bold">{club.name}</p>
          <p className="text-xs text-white/50">
            {club.country} · {club.league}
          </p>
          <span className="mt-2 inline-block rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
            {TIER_LABEL[club.tier]}
          </span>
          <p className="mt-3 text-sm text-white/70">
            Three games against {club.league} sides. Score at least {needed} goal
            {needed === 1 ? '' : 's'} ({required.toFixed(2)} per game) to earn a reserve contract.
          </p>
        </div>
      )}

      {offersReady && (
        <div className="w-full max-w-sm rounded-2xl bg-white/5 p-4 text-left">
          <p className="text-xs uppercase tracking-wide text-white/40">What happens next</p>
          <p className="mt-2 text-sm text-white/70">
            Offers come from {offerBand} clubs only — the band your best ratio earned. You sign a 2-year
            reserve deal at €1,000 a week.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={startOpeningTrial}
        className="w-full max-w-sm rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        {afterYouth ? 'Start club trial' : offersReady ? 'See transfer offers' : 'Start next trial'}
      </button>
    </div>
  );
}
