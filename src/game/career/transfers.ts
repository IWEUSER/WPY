import { CLUBS, getClub, loanCandidates, type Club, type ClubTier } from './data/clubs';
import { shuffle } from './util';
import type { PlayerRole, SeasonRecord } from './types';

/** Maps a goals-per-game ratio onto the club tier it's good enough for,
 * calibrated against first-team expectations (see data/clubs.ts). */
export function tierForRatio(ratio: number): ClubTier {
  if (ratio >= 0.5) return 1;
  if (ratio >= 0.42) return 2;
  if (ratio >= 0.35) return 3;
  if (ratio >= 0.28) return 4;
  return 5;
}

function pickClubsFromTier(tier: ClubTier, count: number, excludeIds: string[]): Club[] {
  let pool = CLUBS.filter((c) => c.tier === tier && !excludeIds.includes(c.id));
  if (pool.length < count) {
    const fallback = CLUBS.filter((c) => !excludeIds.includes(c.id) && Math.abs(c.tier - tier) === 1);
    pool = [...pool, ...fallback];
  }
  return shuffle(pool).slice(0, count);
}

export type TransferKind = 'loan' | 'sold' | 'promotion-offer';

export interface PendingTransfer {
  kind: TransferKind;
  detail: string;
  clubIds: string[];
  /** Only 'promotion-offer' allows turning it down and staying put. */
  allowDecline: boolean;
}

export interface SeasonTransitionImmediate {
  clubId: string;
  parentClubId: string;
  role: PlayerRole;
  seasonsAtCurrentClub: number;
}

export interface SeasonTransitionResult {
  headline: string;
  detail: string;
  /** Set when the outcome is automatic - no club choice required. */
  immediate?: SeasonTransitionImmediate;
  /** Set when the player needs to pick from (or decline) a set of clubs. */
  pendingTransfer?: PendingTransfer;
}

export interface SeasonTransitionParams {
  season: SeasonRecord;
  role: PlayerRole;
  clubId: string;
  parentClubId: string;
  seasonsAtCurrentClub: number;
  age: number;
  careerGoals: number;
  careerGames: number;
}

/**
 * Pure function deciding what happens between seasons: reserve promotion,
 * loan-out, the loan return-or-sale decision, and the ongoing first-team
 * transfer market (sold for underperforming, courted for overperforming).
 * Doesn't mutate anything - the store applies whichever branch fires.
 */
export function resolveSeasonTransition(params: SeasonTransitionParams): SeasonTransitionResult {
  const { season, role, clubId, parentClubId, seasonsAtCurrentClub, age, careerGoals, careerGames } = params;
  const club = getClub(clubId);
  if (!club) {
    return { headline: 'Season complete', detail: '' };
  }
  const ratio = season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;

  if (role === 'reserve') {
    const threshold = club.reserveGoalRatio;
    if (ratio >= threshold) {
      return {
        headline: 'Promoted to the First Team!',
        detail: `You hit ${threshold.toFixed(2)} goals/game in the reserves - ${club.name} want you in the first-team squad now.`,
        immediate: { clubId, parentClubId, role: 'first-team', seasonsAtCurrentClub: seasonsAtCurrentClub + 1 },
      };
    }
    const options = shuffle(loanCandidates(club)).slice(0, 2);
    return {
      headline: 'Ratio not met - a loan move is coming',
      detail: `${ratio.toFixed(2)} goals/game wasn't enough to convince ${club.name}. You're being sent out on loan to get regular first-team football.`,
      pendingTransfer: {
        kind: 'loan',
        detail: `${club.name} have lined up a loan move for you.`,
        clubIds: options.map((c) => c.id),
        allowDecline: false,
      },
    };
  }

  if (role === 'loan') {
    const parentClub = getClub(parentClubId);
    if (parentClub && ratio >= parentClub.reserveGoalRatio) {
      return {
        headline: `${parentClub.name} want you back - straight into the first team!`,
        detail: `${ratio.toFixed(2)} goals/game on loan was even enough to clear ${parentClub.name}'s own promotion bar.`,
        immediate: { clubId: parentClubId, parentClubId, role: 'first-team', seasonsAtCurrentClub: 0 },
      };
    }
    if (ratio >= club.reserveGoalRatio) {
      return {
        headline: `Loan spell over - back to ${parentClub?.name ?? 'your parent club'}`,
        detail: `You did enough at ${club.name} to earn a recall, but not enough to skip straight to the first team. Back to the reserves to try again.`,
        immediate: { clubId: parentClubId, parentClubId, role: 'reserve', seasonsAtCurrentClub: 0 },
      };
    }
    const saleTier = Math.max(tierForRatio(ratio), club.tier) as ClubTier;
    const offers = pickClubsFromTier(saleTier, 3, [club.id, parentClub?.id ?? '']);
    return {
      headline: 'Loan unsuccessful - you are being sold',
      detail: `${ratio.toFixed(2)} goals/game wasn't enough even for ${club.name}. ${parentClub?.name ?? 'Your parent club'} have decided to cash in.`,
      pendingTransfer: {
        kind: 'sold',
        detail: 'These clubs have matched your recent form and made an offer.',
        clubIds: offers.map((c) => c.id),
        allowDecline: false,
      },
    };
  }

  // role === 'first-team'
  const threshold = club.firstTeamGoalRatio;
  const ratioMet = ratio >= threshold;
  const graceActive = seasonsAtCurrentClub === 0;

  if (!ratioMet && !graceActive) {
    const saleTier = Math.max(tierForRatio(ratio), club.tier) as ClubTier;
    const offers = pickClubsFromTier(saleTier, 3, [club.id]);
    return {
      headline: `${club.name} have put you up for sale`,
      detail: `Your ratio slipped to ${ratio.toFixed(2)} goals/game, below the ${threshold.toFixed(2)} they expect.`,
      pendingTransfer: {
        kind: 'sold',
        detail: 'These clubs have matched your recent form and made an offer.',
        clubIds: offers.map((c) => c.id),
        allowDecline: false,
      },
    };
  }

  const effectiveRatio = age < 28 ? (careerGames > 0 ? careerGoals / careerGames : 0) : ratio;
  const betterTier = tierForRatio(effectiveRatio);
  if (betterTier < club.tier) {
    const offers = pickClubsFromTier(betterTier, 3, [club.id]);
    const basis = age < 28 ? 'career' : "last season's";
    return {
      headline: 'A bigger club has come calling',
      detail: `Your ${basis} ratio of ${effectiveRatio.toFixed(2)} goals/game has attracted transfer interest.`,
      pendingTransfer: {
        kind: 'promotion-offer',
        detail: 'These clubs want to sign you - or stay put and keep building at your current club.',
        clubIds: offers.map((c) => c.id),
        allowDecline: true,
      },
    };
  }

  return {
    headline: ratioMet ? 'Place secured' : 'Given more time to settle in',
    detail: ratioMet
      ? `You maintained ${threshold.toFixed(2)} goals/game at ${club.name} - your place is safe.`
      : `${club.name} are giving you a fair run before judging your ratio.`,
    immediate: { clubId, parentClubId, role: 'first-team', seasonsAtCurrentClub: seasonsAtCurrentClub + 1 },
  };
}
