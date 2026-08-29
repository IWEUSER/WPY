import { CLUBS, getClub, goalRatioFromStrength, loanCandidates, type Club, type ClubTier } from './data/clubs';
import { countryForNationality, pickClubsBiasedToCountry, nearbyTierClubs, tierPool } from './clubOffers';
import { playerMarketValueFromSeasons, weeklyWageForClub } from './playerValue';
import type { PlayerRole, SeasonRecord } from './types';

export const MAX_LOAN_SPELLS = 2;

/** Maps a goals-per-game ratio onto the club tier it's good enough for.
 * Calibrated against the 0.75 (elite) → 0.25 (smallest) first-team bars. */
export function tierForRatio(ratio: number): ClubTier {
  if (ratio >= goalRatioFromStrength(90)) return 1;
  if (ratio >= goalRatioFromStrength(81)) return 2;
  if (ratio >= goalRatioFromStrength(73)) return 3;
  if (ratio >= goalRatioFromStrength(64)) return 4;
  return 5;
}

function pickClubsFromTier(
  tier: ClubTier,
  count: number,
  excludeIds: string[],
  nationality?: string | null,
): Club[] {
  const preferred = tierPool(tier, excludeIds);
  const country = countryForNationality(nationality);
  const extraHome = nearbyTierClubs(tier, excludeIds);
  const minHome = country && CLUBS.some((c) => c.country === country && !excludeIds.includes(c.id)) ? 1 : 0;
  return pickClubsBiasedToCountry(preferred, count, country, minHome, extraHome);
}

export type TransferKind = 'loan' | 'sold' | 'promotion-offer' | 'loan-or-transfer';

export interface ClubOfferTerms {
  clubId: string;
  move: 'loan' | 'permanent';
  fee: number;
  weeklyWage: number;
}

export interface PendingTransfer {
  kind: TransferKind;
  detail: string;
  clubIds: string[];
  offers: ClubOfferTerms[];
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
  nationality?: string | null;
  /** Completed loan seasons so far, including the one just finished. */
  loansUsed: number;
  seasonHistory?: SeasonRecord[];
}

export function countLoanSpells(history: SeasonRecord[], current?: SeasonRecord | null): number {
  return [...history, ...(current ? [current] : [])].filter((s) => s.role === 'loan').length;
}

function offerTerms(
  clubs: Club[],
  move: ClubOfferTerms['move'],
  value: number,
): ClubOfferTerms[] {
  return clubs.map((club) => ({
    clubId: club.id,
    move,
    fee: move === 'loan' ? 0 : value,
    weeklyWage: weeklyWageForClub(club, value),
  }));
}

function pendingFromOffers(
  kind: TransferKind,
  detail: string,
  offers: ClubOfferTerms[],
  allowDecline: boolean,
): PendingTransfer {
  return {
    kind,
    detail,
    clubIds: offers.map((o) => o.clubId),
    offers,
    allowDecline,
  };
}

function playerValueFromParams(params: SeasonTransitionParams, club: Club): number {
  return playerMarketValueFromSeasons({
    age: params.age,
    careerGoals: params.careerGoals,
    careerGames: params.careerGames,
    seasons: [...(params.seasonHistory ?? []), params.season],
    fallbackClub: club,
  });
}

/**
 * Pure function deciding what happens between seasons: reserve promotion,
 * loan-out, the loan return-or-sale decision, and the ongoing first-team
 * transfer market (sold for underperforming, courted for overperforming).
 * Doesn't mutate anything - the store applies whichever branch fires.
 */
export function resolveSeasonTransition(params: SeasonTransitionParams): SeasonTransitionResult {
  const { season, role, clubId, parentClubId, seasonsAtCurrentClub, age, careerGoals, careerGames, nationality, loansUsed } =
    params;
  const club = getClub(clubId);
  if (!club) {
    return { headline: 'Season complete', detail: '' };
  }
  const ratio = season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
  const value = playerValueFromParams(params, role === 'loan' ? getClub(parentClubId) ?? club : club);

  if (role === 'reserve') {
    const threshold = club.reserveGoalRatio;
    if (ratio >= threshold) {
      return {
        headline: 'Promoted to the First Team!',
        detail: `You hit ${threshold.toFixed(2)} goals/game in the reserves - ${club.name} want you in the first-team squad now.`,
        immediate: { clubId, parentClubId, role: 'first-team', seasonsAtCurrentClub: seasonsAtCurrentClub + 1 },
      };
    }
    const options = pickLoanClubs(club, nationality, 3, [club.id]);
    return {
      headline: 'Ratio not met - a loan move is coming',
      detail: `${ratio.toFixed(2)} goals/game wasn't enough to convince ${club.name}. You're being sent out on loan to get regular first-team football.`,
      pendingTransfer: pendingFromOffers(
        'loan',
        `${club.name} have lined up a loan move for you.`,
        offerTerms(options, 'loan', value),
        false,
      ),
    };
  }

  if (role === 'loan') {
    const parentClub = getClub(parentClubId);
    const returnBar = parentClub?.firstTeamGoalRatio ?? club.firstTeamGoalRatio;
    if (parentClub && ratio >= returnBar) {
      return {
        headline: `${parentClub.name} want you back - straight into the first team!`,
        detail: `${ratio.toFixed(2)} goals/game on loan cleared ${parentClub.name}'s first-team bar of ${returnBar.toFixed(2)}.`,
        immediate: { clubId: parentClubId, parentClubId, role: 'first-team', seasonsAtCurrentClub: 0 },
      };
    }

    const exclude = [club.id, parentClub?.id ?? ''];
    const saleTier = Math.max(tierForRatio(ratio), club.tier) as ClubTier;
    const transfers = pickClubsFromTier(saleTier, 3, exclude, nationality);
    const canLoanAgain = loansUsed < MAX_LOAN_SPELLS;
    const loans = canLoanAgain
      ? pickLoanClubs(parentClub ?? club, nationality, 3, [...exclude, ...transfers.map((c) => c.id)])
      : [];
    const offers = [...offerTerms(loans, 'loan', value), ...offerTerms(transfers, 'permanent', value)];
    if (canLoanAgain && loans.length > 0) {
      return {
        headline: `${parentClub?.name ?? 'Your parent club'} will not bring you back into the first team`,
        detail: `${ratio.toFixed(2)} goals/game was below their ${returnBar.toFixed(2)} first-team bar. Choose another loan (maximum ${MAX_LOAN_SPELLS} in a career) or a permanent move.`,
        pendingTransfer: pendingFromOffers(
          'loan-or-transfer',
          'Three loan offers and three transfer offers. After two loan spells you must move permanently.',
          offers,
          false,
        ),
      };
    }
    return {
      headline: 'Loan limit reached - you are being sold',
      detail: `You have already been out on loan ${MAX_LOAN_SPELLS} times. ${parentClub?.name ?? 'Your parent club'} are selling you.`,
      pendingTransfer: pendingFromOffers(
        'sold',
        'These clubs have matched your recent form and made an offer.',
        offerTerms(transfers, 'permanent', value),
        false,
      ),
    };
  }

  // role === 'first-team'
  const threshold = club.firstTeamGoalRatio;
  const ratioMet = ratio >= threshold;
  const graceActive = seasonsAtCurrentClub === 0;

  if (!ratioMet && !graceActive) {
    const saleTier = Math.max(tierForRatio(ratio), club.tier) as ClubTier;
    const offers = pickClubsFromTier(saleTier, 3, [club.id], nationality);
    return {
      headline: `${club.name} have put you up for sale`,
      detail: `Your ratio slipped to ${ratio.toFixed(2)} goals/game, below the ${threshold.toFixed(2)} they expect.`,
      pendingTransfer: pendingFromOffers(
        'sold',
        'These clubs have matched your recent form and made an offer.',
        offerTerms(offers, 'permanent', value),
        false,
      ),
    };
  }

  const effectiveRatio = age < 28 ? (careerGames > 0 ? careerGoals / careerGames : 0) : ratio;
  const betterTier = tierForRatio(effectiveRatio);
  if (betterTier < club.tier) {
    const offers = pickClubsFromTier(betterTier, 3, [club.id], nationality);
    const basis = age < 28 ? 'career' : "last season's";
    return {
      headline: 'A bigger club has come calling',
      detail: `Your ${basis} ratio of ${effectiveRatio.toFixed(2)} goals/game has attracted transfer interest.`,
      pendingTransfer: pendingFromOffers(
        'promotion-offer',
        'These clubs want to sign you - or stay put and keep building at your current club.',
        offerTerms(offers, 'permanent', value),
        true,
      ),
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

function pickLoanClubs(
  club: Club,
  nationality: string | null | undefined,
  count: number,
  excludeIds: string[] = [],
): Club[] {
  const candidates = loanCandidates(club).filter((c) => !excludeIds.includes(c.id));
  const country = countryForNationality(nationality);
  return pickClubsBiasedToCountry(candidates, count, country, country ? 1 : 0, candidates);
}
