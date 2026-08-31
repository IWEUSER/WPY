import { useState } from 'react';
import { getClub } from '../data/clubs';
import { displaySeasonLabel } from '../seasonDisplay';
import { useCareerStore } from '../store';
import type { CareerStart } from '../types';

const FAVOURITE_OPTIONS: {
  kind: Exclude<CareerStart, 'youth'>;
  title: string;
  detail: string;
}[] = [
  {
    kind: 'favourite-trial',
    title: 'Trial',
    detail: 'Three academy games with empty stands. Hit the first-team ratio to sign.',
  },
  {
    kind: 'favourite-reserve',
    title: 'Reserve team contract',
    detail: 'Full league season at the academy ground. Hit the club ratio to stay.',
  },
  {
    kind: 'favourite-first-team',
    title: 'First team contract',
    detail: 'Two-year deal and the full first-team calendar. Hit the ratio to stay.',
  },
];

export default function HomeScreen({ onPractice }: { onPractice: () => void }) {
  const clubId = useCareerStore((s) => s.clubId);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const opening = useCareerStore((s) => s.openingCampaign);
  const startYouthChampionships = useCareerStore((s) => s.startYouthChampionships);
  const startFavouritePath = useCareerStore((s) => s.startFavouritePath);
  const resetCareer = useCareerStore((s) => s.resetCareer);
  const advance = useCareerStore((s) => s.advance);
  const [favouriteOpen, setFavouriteOpen] = useState(false);

  const club = clubId ? getClub(clubId) : undefined;
  const inProgress = Boolean(clubId || opening);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 px-6 text-center text-white">
      <div>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">World Player of the Year</h1>
        <p className="mt-2 text-sm text-white/55">20 seasons. One country. Every goal counts.</p>
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
          <>
            <button
              type="button"
              onClick={startYouthChampionships}
              className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
            >
              Youth Championships
              <span className="mt-1 block text-xs font-medium text-black/70">
                Pick your country, then play the continental youth tournament
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFavouriteOpen((open) => !open)}
              className="rounded-2xl bg-white/12 px-6 py-4 text-lg font-bold text-white backdrop-blur transition active:scale-[0.98]"
            >
              Play for your favourite club
              <span className="mt-1 block text-xs font-medium text-white/65">
                Skip the youth tournament and join any club
              </span>
            </button>

            {favouriteOpen &&
              FAVOURITE_OPTIONS.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => startFavouritePath(option.kind)}
                  className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3.5 text-left transition active:scale-[0.98]"
                >
                  <span className="block text-base font-bold text-white">{option.title}</span>
                  <span className="mt-1 block text-xs font-medium text-white/60">{option.detail}</span>
                </button>
              ))}
          </>
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
