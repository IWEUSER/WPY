import { getClub } from '../data/clubs';
import { displaySeasonLabel } from '../seasonDisplay';
import { useCareerStore } from '../store';

export default function HomeScreen({ onPractice }: { onPractice: () => void }) {
  const clubId = useCareerStore((s) => s.clubId);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const opening = useCareerStore((s) => s.openingCampaign);
  const startCareer = useCareerStore((s) => s.startCareer);
  const resetCareer = useCareerStore((s) => s.resetCareer);
  const advance = useCareerStore((s) => s.advance);

  const club = clubId ? getClub(clubId) : undefined;
  const inProgress = Boolean(clubId || opening);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 text-center text-white">
      <div>
        <h1 className="text-3xl font-extrabold tracking-wide sm:text-4xl">World Player of the Year</h1>
        <p className="mt-2 text-sm text-white/50">20 seasons. One country. Every goal counts.</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        {inProgress && (
          <button
            type="button"
            onClick={advance}
            className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
          >
            Continue Career
            <span className="mt-1 block text-xs font-medium text-black/70">
              {opening
                ? opening.kind === 'youth-tournament'
                  ? opening.youthName
                  : `${club?.name ?? 'Club trial'}`
                : `${displaySeasonLabel(seasonNumber)} · ${club?.name ?? ''}`}
            </span>
          </button>
        )}

        {!inProgress && (
          <button
            type="button"
            onClick={startCareer}
            className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
          >
            Start Career
            <span className="mt-1 block text-xs font-medium text-black/70">
              Pick your country, then play the Under-16 championship
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={onPractice}
          className="rounded-2xl bg-white/10 px-6 py-4 text-base font-semibold text-white/90 backdrop-blur transition active:scale-[0.98]"
        >
          Free Practice
        </button>

        {inProgress && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('This will erase your current career and start over from the Under-16 tournament. Continue?')) {
                resetCareer();
              }
            }}
            className="mt-2 text-xs text-white/40 underline underline-offset-2"
          >
            Reset career
          </button>
        )}
      </div>
    </div>
  );
}
