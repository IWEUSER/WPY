import { isFirstPublicSeason } from './seasonDisplay';
import type { CareerStart, CareerState, PlayerRole } from './types';

export const SEASON_PAYWALL_EYEBROW = 'Season 2';
export const SEASON_PAYWALL_TITLE = 'Unlock the rest of your career';
export const SEASON_PAYWALL_LEAD =
  'Season 1 is yours to play in full. Unlock 19 more seasons for an unlimited career, with saved game options, and no ads or extra purchases required to succeed.';
export const SEASON_PAYWALL_POINTS = [
  '19 more seasons after this one — a full 20-season career you can play without limits',
  'Saved careers, so you can park this story and start another whenever you want',
  'No ads',
  'No additional purchases required to succeed in the game',
] as const;
export const SEASON_PAYWALL_CTA = 'Unlock 19 more seasons';

export type PendingSeasonTwoChoice = { clubId: string | null };

export function finishedSeasonForPaywall(state: Pick<CareerState, 'seasonHistory' | 'currentSeason'>) {
  return state.seasonHistory.at(-1) ?? state.currentSeason;
}

/** Gate the first public Season 1 → Season 2 transfer/stay/loan pick. */
export function needsSeasonTwoPaywall(state: {
  fullCareerUnlocked?: boolean;
  pendingTransfer: CareerState['pendingTransfer'];
  seasonHistory: CareerState['seasonHistory'];
  currentSeason: CareerState['currentSeason'];
  careerStart: CareerStart | null;
  role: PlayerRole;
}): boolean {
  if (state.fullCareerUnlocked) return false;
  if (!state.pendingTransfer) return false;
  if (state.pendingTransfer.kind === 'trial-offers') return false;
  const finished = finishedSeasonForPaywall(state);
  if (!finished) return false;
  return isFirstPublicSeason(finished.seasonNumber, {
    role: finished.role,
    careerStart: state.careerStart,
  });
}
