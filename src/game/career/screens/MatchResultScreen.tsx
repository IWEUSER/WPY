import { getClub } from '../data/clubs';
import { getNation } from '../international';
import { playerGoalsLine, sitOutRecapLine } from '../matchBriefing';
import { useCareerStore } from '../store';
import { PlayerKitPortrait } from './PlayerKitPortrait';

export default function MatchResultScreen() {
  const result = useCareerStore((s) => s.lastMatchResult);
  const acknowledgeMatchResult = useCareerStore((s) => s.acknowledgeMatchResult);
  const seenBeatKinds = useCareerStore((s) => s.seenBeatKinds);
  const playerName = useCareerStore((s) => s.playerName);
  const clubId = useCareerStore((s) => s.clubId);
  const nationality = useCareerStore((s) => s.nationality);
  const playerSkin = useCareerStore((s) => s.playerSkin);
  const playerHair = useCareerStore((s) => s.playerHair);

  if (!result) return null;

  const celebrate = result.isFinal && result.won && result.trophyName;
  const firstTitle = Boolean(celebrate && !(seenBeatKinds ?? []).includes('first-title'));
  const headline = result.headline ?? result.summary;
  const playerLine =
    result.playerGoals != null && result.chances != null
      ? playerGoalsLine(result.playerGoals, result.chances)
      : null;
  const sitOutLine = sitOutRecapLine(result.sitOutReason);
  const club = clubId ? getClub(clubId) : undefined;
  const nation = nationality ? getNation(nationality) : undefined;
  const look = playerSkin && playerHair ? { skin: playerSkin, hair: playerHair } : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      {celebrate ? (
        <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-amber-300/30 via-emerald-400/15 to-transparent px-5 py-8 shadow-lg shadow-amber-400/20">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-200">{firstTitle ? 'First title' : 'Champions'}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-amber-100">You won the {result.trophyName}</h1>
          {firstTitle && (
            <PlayerKitPortrait
              name={playerName?.trim() || 'You'}
              club={club}
              nation={nation}
              look={look}
            />
          )}
          <p className="mt-4 text-lg font-semibold text-white/90">{headline}</p>
          {playerLine && <p className="mt-2 text-sm text-white/70">{playerLine}</p>}
          {sitOutLine && (
            <p className="mt-2 text-sm font-semibold text-amber-200">
              {sitOutLine}
            </p>
          )}
          {result.aggregateLine && <p className="mt-2 text-sm font-semibold text-emerald-200">{result.aggregateLine}</p>}
          {result.nextLine && <p className="mt-2 text-sm text-white/70">{result.nextLine}</p>}
          <p className="mt-3 text-sm text-amber-100/80">
            {firstTitle
              ? 'The first one is the one you remember. The dressing room will never be this new again.'
              : 'A night to remember. The dressing room is bouncing.'}
          </p>
        </div>
      ) : (
        <div className="w-full max-w-sm rounded-3xl bg-white/5 px-5 py-8">
          <p className="text-xs uppercase tracking-wide text-white/40">
            {result.isFinal ? 'Final' : 'Full time'}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold">{headline}</h1>
          {playerLine && <p className="mt-3 text-sm text-white/70">{playerLine}</p>}
          {sitOutLine && (
            <p className="mt-2 text-sm font-semibold text-amber-200">
              {sitOutLine}
            </p>
          )}
          {result.aggregateLine && <p className="mt-2 text-sm font-semibold text-emerald-200">{result.aggregateLine}</p>}
          {result.nextLine && <p className="mt-2 text-sm text-white/70">{result.nextLine}</p>}
          {result.isFinal && result.trophyName && !result.won && (
            <p className="mt-3 text-sm text-white/60">So close — {result.trophyName} slips away.</p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={acknowledgeMatchResult}
        className={`rounded-2xl px-6 py-4 text-lg font-bold shadow-lg transition active:scale-[0.98] ${
          celebrate
            ? 'bg-amber-300 text-black shadow-amber-400/30'
            : 'bg-emerald-500 text-black shadow-emerald-500/20'
        }`}
      >
        Continue
      </button>
    </div>
  );
}
