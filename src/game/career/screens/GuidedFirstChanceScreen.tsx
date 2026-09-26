import { useCareerStore } from '../store';

export default function GuidedFirstChanceScreen() {
  const markGuidedChanceSeen = useCareerStore((s) => s.markGuidedChanceSeen);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-white/10 via-white/5 to-transparent px-5 py-8">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-200/80">First chance</p>
        <h1 className="mt-3 font-display text-3xl font-black tracking-tight">How you shoot</h1>
        <ul className="mt-6 space-y-3 text-left text-sm leading-relaxed text-white/75">
          <li className="rounded-2xl bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Knock sideways</p>
            <p className="mt-1">Swipe the ball left or right to find space before the defender closes.</p>
          </li>
          <li className="rounded-2xl bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Swipe up</p>
            <p className="mt-1">Jab, drive, or loft — one swipe type. How hard and how you finish it is the shot.</p>
          </li>
          <li className="rounded-2xl bg-white/5 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Take it off the roll</p>
            <p className="mt-1">The ball is already moving. Time the swipe as it comes onto your foot.</p>
          </li>
        </ul>
      </div>
      <button
        type="button"
        onClick={markGuidedChanceSeen}
        className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        Play the first game
      </button>
    </div>
  );
}
