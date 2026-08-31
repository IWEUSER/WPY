import { getClub, TIER_LABEL } from '../data/clubs';
import { CLUB_TRIAL_GAMES } from '../trial';
import { useCareerStore } from '../store';

export default function ClubOfferScreen() {
  const trial = useCareerStore((s) => s.trial);
  const opening = useCareerStore((s) => s.openingCampaign);
  const chooseClub = useCareerStore((s) => s.chooseClub);

  const goals = trial?.goals ?? 0;
  const offers = (trial?.offeredClubIds ?? []).map(getClub).filter((c) => c !== undefined);
  const fromOpeningTrial = Boolean(opening?.kind === 'club-trial' || opening?.youthGoals);
  const games = fromOpeningTrial ? CLUB_TRIAL_GAMES : null;

  return (
    <div className="flex h-full w-full flex-col items-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div>
        <p className="text-sm text-white/50">{fromOpeningTrial ? 'Trial complete' : 'Offers'}</p>
        <h1 className="font-display text-2xl font-bold">
          {games != null ? `${goals} goal${goals === 1 ? '' : 's'} in ${games} games` : `${goals} scored`}
        </h1>
        <p className="mt-2 text-sm text-white/60">
          {fromOpeningTrial
            ? 'You hit the ratio they asked for. Sign the reserve contract and start your career.'
            : goals >= 9
              ? "Scouts from Europe's biggest clubs were watching. Pick your future."
              : goals >= 7
                ? 'Solid trial - a handful of ambitious clubs want to sign you.'
                : goals >= 4
                  ? "You've done enough to earn a professional contract."
                  : goals >= 1
                    ? 'It was scrappy, but someone will take a chance on you.'
                    : "Nobody was impressed, but every career starts somewhere."}
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {offers.map((club) => (
          <button
            key={club.id}
            type="button"
            onClick={() => chooseClub(club.id)}
            className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 text-left backdrop-blur transition active:scale-[0.98]"
            style={{ borderLeft: `4px solid ${club.color}` }}
          >
            <div className="flex-1">
              <p className="font-bold">{club.name}</p>
              <p className="text-xs text-white/50">
                {club.country} · {club.league}
              </p>
              <p className="mt-1 text-xs text-white/70">2-year contract</p>
            </div>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
              {TIER_LABEL[club.tier]}
            </span>
          </button>
        ))}
      </div>

      <p className="max-w-sm text-xs text-white/40">
        You're only 16 - whichever club you join, you'll start on a 2-year reserve contract and need to hit their goal ratio to
        earn a first-team promotion.
      </p>
    </div>
  );
}
