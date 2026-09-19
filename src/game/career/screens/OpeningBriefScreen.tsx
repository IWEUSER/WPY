import { getClub, TIER_LABEL } from '../data/clubs';
import { getNation } from '../international';
import { useCareerStore } from '../store';
import { CLUB_TRIAL_GAMES, trialGoalsNeeded, trialRatioRequired, TRIALS_AT_LEVEL } from '../trial';
import { rejectedIdsAtTier, remainingTrialClubIds } from '../openingFlow';
import { tierForRatio } from '../transfers';

export default function OpeningBriefScreen() {
  const opening = useCareerStore((s) => s.openingCampaign);
  const nationality = useCareerStore((s) => s.nationality);
  const pendingTransfer = useCareerStore((s) => s.pendingTransfer);
  const startOpeningTrial = useCareerStore((s) => s.startOpeningTrial);
  const chooseOpeningTrialClub = useCareerStore((s) => s.chooseOpeningTrialClub);

  const nation = nationality ? getNation(nationality) : undefined;
  const rejectedId = opening?.rejectedClubIds[opening.rejectedClubIds.length - 1];
  const rejected = rejectedId ? getClub(rejectedId) : undefined;
  const afterYouth = opening?.kind === 'youth-tournament';
  const offersReady = Boolean(pendingTransfer) && opening?.kind === 'club-trial';
  const youthGoals = opening?.youthGoals ?? opening?.goals ?? 0;
  const youthGames = afterYouth ? (opening?.gamesPlayed ?? 0) : null;
  const youthRatio = youthGames && youthGames > 0 ? youthGoals / youthGames : 0;
  const trialRatio = opening && opening.gamesPlayed > 0 ? opening.goals / opening.gamesPlayed : 0;
  const remainingIds = opening ? remainingTrialClubIds(opening) : [];
  const remainingClubs = remainingIds.map(getClub).filter((club): club is NonNullable<ReturnType<typeof getClub>> => club != null);
  const levelTier = opening?.trialTier ?? remainingClubs[0]?.tier ?? null;
  const looksUsedAtLevel = opening && levelTier != null ? rejectedIdsAtTier(opening, levelTier).length : 0;
  const steppedDown = Boolean(rejected && levelTier != null && rejected.tier < levelTier);
  const bestRatio = opening?.bestTrialRatio ?? trialRatio;
  const offerTier = tierForRatio(bestRatio);
  const offerBand = TIER_LABEL[offerTier].toLowerCase();
  const bandLabel = levelTier != null ? TIER_LABEL[levelTier] : TIER_LABEL[offerTier];

  return (
    <div className="flex h-full w-full flex-col items-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div>
        <p className="text-sm text-white/50">
          {afterYouth
            ? opening?.youthName ?? 'Youth Championship'
            : offersReady
              ? 'Trials complete'
              : steppedDown
                ? `Next level · ${bandLabel}`
                : `${bandLabel} trials`}
        </p>
        <h1 className="font-display text-2xl font-bold">
          {afterYouth
            ? youthGames != null
              ? `${youthGoals} goal${youthGoals === 1 ? '' : 's'} in ${youthGames} game${youthGames === 1 ? '' : 's'}`
              : `${youthGoals} goal${youthGoals === 1 ? '' : 's'} for ${nation?.name ?? 'your country'}`
            : offersReady
              ? `${opening?.goals ?? 0} goal${opening?.goals === 1 ? '' : 's'} in ${opening?.gamesPlayed ?? CLUB_TRIAL_GAMES} games`
              : `${rejected?.name ?? 'The club'} turned you down`}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">
          {afterYouth
            ? `${nation?.name ?? 'You'} scored ${youthRatio.toFixed(2)} goals/game at the ${opening?.youthName}. ${bandLabel} clubs want to trial you — pick who you start with. Fail a look and you choose from the clubs that remain.`
            : offersReady
              ? `Your best trial ratio was ${bestRatio.toFixed(2)}. ${TIER_LABEL[offerTier]} clubs want to sign you.`
              : remainingClubs.length > 0
                ? steppedDown
                  ? `No club at that level signed you. These ${remainingClubs.length} ${bandLabel.toLowerCase()} clubs are next — pick who you trial with.`
                  : `Pick from the remaining ${remainingClubs.length} club${remainingClubs.length === 1 ? '' : 's'} at this level. ${looksUsedAtLevel} of ${TRIALS_AT_LEVEL} looks used.`
                : `You did not hit the goal ratio they needed.`}
        </p>
      </div>

      {!offersReady && remainingClubs.map((club) => {
        const needed = trialGoalsNeeded(club);
        const required = trialRatioRequired(club);
        return (
          <button
            key={club.id}
            type="button"
            onClick={() => chooseOpeningTrialClub(club.id)}
            className="w-full max-w-sm rounded-2xl bg-white/5 p-4 text-left backdrop-blur transition active:scale-[0.98]"
            style={{ borderLeft: `4px solid ${club.color}` }}
          >
            <p className="text-xs uppercase tracking-wide text-white/40">
              {afterYouth ? 'Trial offer' : steppedDown ? 'Next level' : 'Still available'}
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
              {needed === 1 ? '' : 's'} ({required.toFixed(2)} per game) to start Season 1 as a Rising star.
            </p>
            <p className="mt-3 text-sm font-semibold text-emerald-300">Trial at {club.name}</p>
          </button>
        );
      })}

      {offersReady && (
        <div className="w-full max-w-sm rounded-2xl bg-white/5 p-4 text-left">
          <p className="text-xs uppercase tracking-wide text-white/40">What happens next</p>
          <p className="mt-2 text-sm text-white/70">
            Offers come from {offerBand} clubs only — the band your best ratio earned. You sign a
            2-year Rising star deal at 10% of that club’s top wage, then Season 1 starts.
          </p>
        </div>
      )}

      {offersReady && (
        <button
          type="button"
          onClick={startOpeningTrial}
          className="w-full max-w-sm rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
        >
          See transfer offers
        </button>
      )}
    </div>
  );
}
