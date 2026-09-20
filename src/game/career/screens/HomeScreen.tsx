import { useState } from 'react';
import { GAME_LOGO_SRC, GAME_TAGLINE, GAME_TITLE, liveMenuStamp } from '../../branding';
import { getClub } from '../data/clubs';
import { displaySeasonLabel } from '../seasonDisplay';
import { useCareerStore } from '../store';

export default function HomeScreen({ onPractice }: { onPractice: () => void }) {
  const clubId = useCareerStore((s) => s.clubId);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const opening = useCareerStore((s) => s.openingCampaign);
  const role = useCareerStore((s) => s.role);
  const careerStart = useCareerStore((s) => s.careerStart);
  const startYouthChampionships = useCareerStore((s) => s.startYouthChampionships);
  const startFavouritePath = useCareerStore((s) => s.startFavouritePath);
  const resetCareer = useCareerStore((s) => s.resetCareer);
  const advance = useCareerStore((s) => s.advance);
  const [careerOpen, setCareerOpen] = useState(false);

  const club = clubId ? getClub(clubId) : undefined;
  const inProgress = Boolean(clubId || opening);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 text-center text-white">
      <div className="flex flex-col items-center">
        <img
          src={GAME_LOGO_SRC}
          alt=""
          className="h-24 w-24 rounded-[1.75rem] shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-2 ring-amber-200/35"
        />
        <h1 className="font-brand mt-5 text-4xl leading-none text-white sm:text-5xl">{GAME_TITLE}</h1>
        <p className="mt-3 text-sm text-white/55">{GAME_TAGLINE}</p>
        <p className="mt-2 text-[11px] uppercase tracking-wide text-emerald-300/80">{liveMenuStamp()}</p>
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
                : `${displaySeasonLabel(seasonNumber, { role, careerStart })} · ${club?.name ?? ''}`}
            </span>
          </button>
        )}

        {!inProgress && (
          <>
            <button
              type="button"
              onClick={() => setCareerOpen((open) => !open)}
              className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
            >
              Career mode
              <span className="mt-1 block text-xs font-medium text-black/70">
                20 seasons. Start without a club, or pick one now.
              </span>
            </button>

            {careerOpen && (
              <>
                <button
                  type="button"
                  onClick={startYouthChampionships}
                  className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3.5 text-left transition active:scale-[0.98]"
                >
                  <span className="block text-base font-bold text-white">Start as a youth player</span>
                  <span className="mt-1 block text-xs font-medium text-white/60">
                    No club yet. Play your country’s youth tournament, trial, then Season 1 as a Rising star.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => startFavouritePath('favourite-first-team')}
                  className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3.5 text-left transition active:scale-[0.98]"
                >
                  <span className="block text-base font-bold text-white">Pick a club</span>
                  <span className="mt-1 block text-xs font-medium text-white/60">
                    Join any club now as a Rising star on a 2-year deal at 10% of that club’s average wage.
                  </span>
                </button>
              </>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onPractice}
          className="rounded-2xl bg-white/8 px-6 py-3 text-sm font-semibold text-white/75 backdrop-blur transition active:scale-[0.98]"
        >
          Free practice mode
        </button>

        {inProgress && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('This will erase your current career and start over. Continue?')) {
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
