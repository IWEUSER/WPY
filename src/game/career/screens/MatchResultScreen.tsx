import { playerGoalsLine, sitOutRecapLine } from '../matchBriefing';
import {
  hasMilestone,
  penaltyOutcomeCopy,
  titleCopyFor,
  tournamentWinFlavour,
  trophyClass,
  trophyMilestoneId,
} from '../careerBeatCopy';
import { useCareerStore } from '../store';
import { HonourArt } from './HonourArt';

export default function MatchResultScreen() {
  const result = useCareerStore((s) => s.lastMatchResult);
  const acknowledgeMatchResult = useCareerStore((s) => s.acknowledgeMatchResult);
  const seenBeatKinds = useCareerStore((s) => s.seenBeatKinds);
  const seenMilestones = useCareerStore((s) => s.seenMilestones);

  if (!result) return null;

  const celebrate = result.isFinal && result.won && result.trophyName;
  const firstCareerTitle = Boolean(celebrate && !(seenBeatKinds ?? []).includes('first-title'));
  const klass = trophyClass(result.trophyName);
  const firstCategory = Boolean(celebrate && !hasMilestone(seenMilestones, trophyMilestoneId(klass)));
  const headline = result.headline ?? result.summary;
  const playerLine =
    result.playerGoals != null && result.chances != null
      ? playerGoalsLine(result.playerGoals, result.chances)
      : null;
  const sitOutLine = sitOutRecapLine(result.sitOutReason);
  const flavour = celebrate
    ? tournamentWinFlavour({
        first: firstCategory,
        playerGoals: result.playerGoals ?? 0,
        winningGoal: Boolean(result.winningGoal),
        penaltyKick: Boolean(result.penaltyKick),
        penaltyScored: Boolean(result.penaltyScored),
        penaltiesWon: result.penaltiesWon ?? null,
      })
    : penaltyOutcomeCopy({
        penaltyKick: Boolean(result.penaltyKick),
        penaltyScored: Boolean(result.penaltyScored),
        penaltiesWon: result.penaltiesWon ?? null,
        first: true,
      });
  const titleLine = celebrate ? titleCopyFor(klass, firstCategory) : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      {celebrate ? (
        <div className="beat-card w-full max-w-sm rounded-3xl bg-gradient-to-b from-amber-300/30 via-emerald-400/15 to-transparent px-5 py-8 shadow-lg shadow-amber-400/20">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-200">{firstCareerTitle ? 'First title' : 'Champions'}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-amber-100">You won the {result.trophyName}</h1>
          <HonourArt name={result.trophyName} caption="Trophy" />
          <p className="mt-4 text-lg font-semibold text-white/90">
            {headline.replace(/\s·\s.*\b(?:are out|out of the [^.]+)$/i, '')}
          </p>
          {playerLine && <p className="mt-2 text-sm text-white/70">{playerLine}</p>}
          {sitOutLine && (
            <p className="mt-2 text-sm font-semibold text-amber-200">
              {sitOutLine}
            </p>
          )}
          {result.aggregateLine && <p className="mt-2 text-sm font-semibold text-emerald-200">{result.aggregateLine}</p>}
          {result.nextLine && <p className="mt-2 text-sm text-white/70">{result.nextLine}</p>}
          {flavour && <p className="mt-3 text-sm font-semibold text-amber-100">{flavour}</p>}
          <p className="mt-3 text-sm text-amber-100/80">{titleLine}</p>
        </div>
      ) : (
        <div className="beat-card w-full max-w-sm rounded-3xl bg-white/5 px-5 py-8">
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
          {flavour && <p className="mt-3 text-sm font-semibold text-amber-100/90">{flavour}</p>}
          {result.isFinal && result.trophyName && !result.won && (
            <p className="mt-3 text-sm text-white/60">So close — {result.trophyName} slips away.</p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={acknowledgeMatchResult}
        className={`continue-pop rounded-2xl px-6 py-4 text-lg font-bold shadow-lg transition active:scale-[0.98] ${
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
