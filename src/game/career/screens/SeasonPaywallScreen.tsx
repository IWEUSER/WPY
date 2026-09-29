import {
  SEASON_PAYWALL_CTA,
  SEASON_PAYWALL_EYEBROW,
  SEASON_PAYWALL_LEAD,
  SEASON_PAYWALL_POINTS,
  SEASON_PAYWALL_TITLE,
} from '../seasonPaywall';
import { useCareerStore } from '../store';

export default function SeasonPaywallScreen() {
  const continuePastSeasonPaywall = useCareerStore((s) => s.continuePastSeasonPaywall);
  const backFromSeasonPaywall = useCareerStore((s) => s.backFromSeasonPaywall);

  return (
    <div className="flex h-full w-full flex-col items-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-white">
      <div>
        <button
          type="button"
          onClick={backFromSeasonPaywall}
          className="mb-3 text-xs font-semibold text-white/50 underline underline-offset-2"
        >
          Back
        </button>
        <p className="text-sm uppercase tracking-[0.22em] text-amber-200/80">{SEASON_PAYWALL_EYEBROW}</p>
        <h1 className="mt-2 font-display text-2xl font-bold">{SEASON_PAYWALL_TITLE}</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">{SEASON_PAYWALL_LEAD}</p>
      </div>

      <ul className="flex w-full max-w-sm flex-col gap-3 text-left">
        {SEASON_PAYWALL_POINTS.map((point) => (
          <li
            key={point}
            className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm leading-relaxed text-white/75"
          >
            {point}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={continuePastSeasonPaywall}
        className="w-full max-w-sm rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        {SEASON_PAYWALL_CTA}
      </button>
    </div>
  );
}
