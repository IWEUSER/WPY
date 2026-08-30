import { CLUBS, earnedPromotion, getClub, goalRatioFromStrength, promotionTarget, type Club, type ClubTier } from './data/clubs';
import { countryForNationality, pickClubsBiasedToCountry, nearbyTierClubs, tierPool } from './clubOffers';
import {
  clubTransferBudget,
  consecutiveSeasonsBelow,
  DEFAULT_CONTRACT_YEARS,
  MEGA_CLUB_IDS,
  MEGA_TRANSFER_FEE,
  loanContractYearsRemaining,
  newContractYears,
  nextContractYearsRemaining,
  playerMarketValueFromSeasons,
  tierForMarketValue,
  transferFeeFromValue,
  weeklyWageForClub,
} from './playerValue';
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

/**
 * Who wants the player follows intrinsic value, not the transfer fee.
 * A €200m star on an expiring deal is still an elite target.
 */
export function offerTierFromStanding(params: {
  careerRatio: number;
  marketValue: number;
  currentTier: ClubTier;
  blockElite?: boolean;
}): ClubTier {
  let tier = tierForMarketValue(params.marketValue);
  if (params.blockElite) tier = Math.max(tier, 2) as ClubTier;
  void params.careerRatio;
  void params.currentTier;
  return tier;
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

/** Paid bids need a budget. A free agent still draws quality clubs — just more of them. */
function pickPermanentClubs(
  qualityTier: ClubTier,
  fee: number,
  excludeIds: string[],
  nationality?: string | null,
  blockElite = false,
): Club[] {
  const country = countryForNationality(nationality);
  if (fee >= MEGA_TRANSFER_FEE && !blockElite) {
    const megas = CLUBS.filter((c) => MEGA_CLUB_IDS.has(c.id) && !excludeIds.includes(c.id));
    return pickClubsBiasedToCountry(megas, Math.min(3, megas.length), country, 0);
  }
  if (fee <= 0) {
    const primary = pickClubsFromTier(qualityTier, 3, excludeIds, nationality);
    const wider = Math.min(5, (qualityTier + 1) as ClubTier) as ClubTier;
    if (wider === qualityTier) {
      return pickClubsFromTier(qualityTier, 6, excludeIds, nationality);
    }
    const extra = pickClubsFromTier(wider, 3, [...excludeIds, ...primary.map((c) => c.id)], nationality);
    return [...primary, ...extra];
  }
  const affordable = (tier: ClubTier) =>
    tierPool(tier, excludeIds).filter((c) => clubTransferBudget(c) >= fee);
  let pool = affordable(qualityTier);
  if (pool.length < 3 && qualityTier < 5) {
    pool = [...pool, ...affordable(((qualityTier + 1) as ClubTier))];
  }
  if (pool.length === 0) {
    pool = CLUBS.filter(
      (c) =>
        !excludeIds.includes(c.id) &&
        clubTransferBudget(c) >= fee &&
        !(blockElite && c.tier === 1),
    );
  }
  const extraHome = nearbyTierClubs(qualityTier, excludeIds).filter((c) => clubTransferBudget(c) >= fee);
  const minHome = country && pool.some((c) => c.country === country) ? 1 : 0;
  return pickClubsBiasedToCountry(pool, Math.min(3, Math.max(pool.length, 1)), country, minHome, extraHome);
}

export type TransferKind = 'loan' | 'sold' | 'promotion-offer' | 'loan-or-transfer' | 'end-of-season';

export interface ClubOfferTerms {
  clubId: string;
  move: 'loan' | 'permanent';
  fee: number;
  weeklyWage: number;
  contractYears: number;
}

export interface PendingTransfer {
  kind: TransferKind;
  detail: string;
  clubIds: string[];
  offers: ClubOfferTerms[];
  /** Only declineable offers allow turning it down and staying put. */
  allowDecline: boolean;
  /** Applied when the player declines and stays. */
  stay?: SeasonTransitionImmediate;
}

export interface SeasonTransitionImmediate {
  clubId: string;
  parentClubId: string;
  role: PlayerRole;
  seasonsAtCurrentClub: number;
  contractYearsRemaining: number;
  /** League the club will play in next season (top flight after promotion). */
  clubLeague?: string;
  weeklyWage?: number;
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
  contractYearsRemaining?: number;
  leaguePosition?: number | null;
  clubLeague?: string | null;
}

export function countLoanSpells(history: SeasonRecord[], current?: SeasonRecord | null): number {
  return [...history, ...(current ? [current] : [])].filter((s) => s.role === 'loan').length;
}

/** Late-career "big move" destinations: Designated Player MLS sides. */
export const TWILIGHT_MLS_CLUB_IDS = ['lafc', 'inter-miami', 'nycfc', 'la-galaxy'] as const;
/** From age 32, the same money from the four Saudi giants. */
export const TWILIGHT_SAUDI_CLUB_IDS = ['al-hilal', 'al-nassr', 'al-ittihad', 'al-ahli'] as const;

/** Top-tier European weekly wage, used for twilight MLS and Saudi bids. */
export function twilightStarWage(marketValue: number): number {
  const elite = getClub('man-city') ?? getClub('real-madrid') ?? getClub('barcelona');
  if (!elite) return 180_000;
  return weeklyWageForClub(elite, marketValue, 'Premier League');
}

function twilightDestinationOffers(
  clubIds: readonly string[],
  value: number,
  fee: number,
  age: number,
  taken: Set<string>,
): ClubOfferTerms[] {
  const years = newContractYears(age);
  const wage = twilightStarWage(value);
  return clubIds
    .filter((id) => !taken.has(id) && getClub(id))
    .map((id) => ({
      clubId: id,
      move: 'permanent' as const,
      fee,
      weeklyWage: wage,
      contractYears: years,
    }));
}

function offerTerms(
  clubs: Club[],
  move: ClubOfferTerms['move'],
  value: number,
  fee: number,
  age: number,
  contractYears?: number,
): ClubOfferTerms[] {
  const years = contractYears ?? (move === 'loan' ? 1 : newContractYears(age));
  return clubs.map((club) => ({
    clubId: club.id,
    move,
    fee: move === 'loan' ? 0 : fee,
    weeklyWage: weeklyWageForClub(club, value),
    contractYears: years,
  }));
}

function pendingFromOffers(
  kind: TransferKind,
  detail: string,
  offers: ClubOfferTerms[],
  allowDecline: boolean,
  stay?: SeasonTransitionImmediate,
): PendingTransfer {
  return {
    kind,
    detail,
    clubIds: offers.map((o) => o.clubId),
    offers,
    allowDecline,
    stay,
  };
}

function parallelTransfers(
  headline: string,
  detail: string,
  stay: SeasonTransitionImmediate,
  value: number,
  fee: number,
  nationality: string | null | undefined,
  excludeIds: string[],
  preferredTier: ClubTier,
  includeLoans: boolean,
  age = 18,
  blockElite = false,
  loanYears = 1,
): SeasonTransitionResult {
  const transfers = pickPermanentClubs(preferredTier, fee, excludeIds, nationality, blockElite);
  const loans = includeLoans
    ? pickLoanClubsByValue(value, nationality, 3, [...excludeIds, ...transfers.map((c) => c.id)])
    : [];
  const permYears = newContractYears(age);
  const offers = withTwilightMlsOffers(
    [
      ...offerTerms(loans, 'loan', value, 0, age, loanYears),
      ...offerTerms(transfers, 'permanent', value, fee, age, permYears),
    ],
    age,
    value,
    fee,
    excludeIds,
  );
  return {
    headline,
    detail: includeLoans
      ? `${detail} Loan and transfer offers are on the table in parallel — stay, or move.`
      : `${detail} Transfer offers are on the table in parallel — stay, or move.`,
    pendingTransfer: pendingFromOffers(
      includeLoans ? 'loan-or-transfer' : 'end-of-season',
      includeLoans
        ? fee <= 0
          ? 'Out of contract: more clubs can bid because there is no fee. Loan wages still follow your value.'
          : 'Loan wages follow your value. Permanent fees follow the contract, not your market value.'
        : fee <= 0
          ? 'Out of contract: more clubs can bid because there is no fee. You can stay where you are.'
          : 'These clubs can pay the transfer fee. You can stay where you are.',
      offers,
      true,
      stay,
    ),
  };
}

function playerValueFromParams(params: SeasonTransitionParams, club: Club): number {
  return playerMarketValueFromSeasons({
    age: params.age,
    careerGoals: params.careerGoals,
    careerGames: params.careerGames,
    seasons: [...(params.seasonHistory ?? []), params.season],
    fallbackClub: club,
    contractYearsRemaining: params.contractYearsRemaining ?? DEFAULT_CONTRACT_YEARS,
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
  const yearsLeft = params.contractYearsRemaining ?? DEFAULT_CONTRACT_YEARS;
  const seasons = [...(params.seasonHistory ?? []), season];
  const value = playerValueFromParams(params, role === 'loan' ? getClub(parentClubId) ?? club : club);
  const fee = transferFeeFromValue(value, yearsLeft);
  const blockElite = consecutiveSeasonsBelow(seasons, 0.5) >= 2;
  const currentLeague = params.clubLeague ?? club.league;
  const promoted = role === 'first-team' && earnedPromotion(currentLeague, params.leaguePosition);
  const nextLeague = promoted ? (promotionTarget(currentLeague) ?? currentLeague) : currentLeague;
  const stayOn = (extra: Partial<SeasonTransitionImmediate> = {}): SeasonTransitionImmediate => {
    const stay: SeasonTransitionImmediate = {
      clubId,
      parentClubId,
      role: role === 'reserve' ? 'first-team' : 'first-team',
      seasonsAtCurrentClub: seasonsAtCurrentClub + 1,
      contractYearsRemaining: nextContractYearsRemaining(yearsLeft, age),
      clubLeague: nextLeague,
      ...extra,
    };
    const stayClub = getClub(stay.clubId) ?? club;
    stay.weeklyWage = weeklyWageForClub(stayClub, value, stay.clubLeague);
    return stay;
  };
  const withTwilight = (offers: ClubOfferTerms[]) =>
    withTwilightMlsOffers(offers, age, value, fee, [club.id, parentClubId]);
  const permYears = newContractYears(age);
  const loanYears = loanContractYearsRemaining(season.seasonNumber, yearsLeft, age);

  if (role === 'reserve') {
    const threshold = club.reserveGoalRatio;
    if (ratio >= threshold) {
      return parallelTransfers(
        'Promoted to the First Team!',
        `You hit ${threshold.toFixed(2)} goals/game in the reserves - ${club.name} want you in the first-team squad now.`,
        stayOn({ role: 'first-team', contractYearsRemaining: newContractYears(age) }),
        value,
        fee,
        nationality,
        [club.id],
        club.tier,
        true,
        age,
        false,
        loanYears,
      );
    }
    const options = pickLoanClubsByValue(value, nationality, 3, [club.id]);
    return {
      headline: 'Ratio not met - a loan move is coming',
      detail: `${ratio.toFixed(2)} goals/game wasn't enough to convince ${club.name}. You're being sent out on loan to get regular first-team football.`,
      pendingTransfer: pendingFromOffers(
        'loan',
        `${club.name} have lined up a loan move for you.`,
        offerTerms(options, 'loan', value, 0, age, loanYears),
        false,
      ),
    };
  }

  if (role === 'loan') {
    const parentClub = getClub(parentClubId);
    const returnBar = parentClub?.firstTeamGoalRatio ?? club.firstTeamGoalRatio;
    if (parentClub && ratio >= returnBar) {
      return parallelTransfers(
        `${parentClub.name} want you back - straight into the first team!`,
        `${ratio.toFixed(2)} goals/game on loan cleared ${parentClub.name}'s first-team bar of ${returnBar.toFixed(2)}.`,
        stayOn({ clubId: parentClubId, parentClubId, role: 'first-team', seasonsAtCurrentClub: 0 }),
        value,
        fee,
        nationality,
        [club.id, parentClubId],
        parentClub.tier,
        true,
        age,
        false,
        loanYears,
      );
    }

    const exclude = [club.id, parentClub?.id ?? ''];
    const careerRatio = careerGames > 0 ? careerGoals / careerGames : ratio;
    const saleTier = offerTierFromStanding({
      careerRatio,
      marketValue: value,
      currentTier: parentClub?.tier ?? club.tier,
      blockElite,
    });
    const transfers = pickPermanentClubs(saleTier, fee, exclude, nationality, blockElite);
    const canLoanAgain = loansUsed < MAX_LOAN_SPELLS;
    const loans = canLoanAgain
      ? pickLoanClubsByValue(value, nationality, 3, [...exclude, ...transfers.map((c) => c.id)])
      : [];
    const offers = withTwilight([
      ...offerTerms(loans, 'loan', value, 0, age, loanYears),
      ...offerTerms(transfers, 'permanent', value, fee, age, permYears),
    ]);
    if (canLoanAgain && loans.length > 0) {
      return {
        headline: `${parentClub?.name ?? 'Your parent club'} will not bring you back into the first team`,
        detail: `${ratio.toFixed(2)} goals/game was below their ${returnBar.toFixed(2)} first-team bar. Choose another loan (maximum ${MAX_LOAN_SPELLS} in a career) or a permanent move.`,
        pendingTransfer: pendingFromOffers(
          'loan-or-transfer',
          fee <= 0
            ? 'Out of contract: more clubs can bid for free. After two loan spells you must move permanently.'
            : 'Loan wages follow your value. Permanent fees follow the contract. After two loan spells you must move permanently.',
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
        fee <= 0
          ? 'Out of contract: these clubs can bid without a transfer fee.'
          : 'These clubs can pay the transfer fee.',
        withTwilight(offerTerms(transfers, 'permanent', value, fee, age, permYears)),
        false,
      ),
    };
  }

  // role === 'first-team'
  const threshold = club.firstTeamGoalRatio;
  const ratioMet = ratio >= threshold;
  const graceActive = seasonsAtCurrentClub === 0;

  if (promoted) {
    return parallelTransfers(
      `${club.name} have been promoted to the ${nextLeague}!`,
      `Finished ${params.leaguePosition}${params.leaguePosition === 1 ? 'st' : 'nd'} in ${currentLeague}. Stay and play in the ${nextLeague} next season.`,
      stayOn(),
      value,
      fee,
      nationality,
      [club.id],
      offerTierFromStanding({
        careerRatio: careerGames > 0 ? careerGoals / careerGames : ratio,
        marketValue: value,
        currentTier: club.tier,
        blockElite,
      }),
      true,
      age,
      blockElite,
      loanYears,
    );
  }

  if (!ratioMet && !graceActive) {
    const careerRatio = careerGames > 0 ? careerGoals / careerGames : ratio;
    const saleTier = offerTierFromStanding({
      careerRatio,
      marketValue: value,
      currentTier: club.tier,
      blockElite,
    });
    const transfers = pickPermanentClubs(saleTier, fee, [club.id], nationality, blockElite);
    const canLoan = loansUsed < MAX_LOAN_SPELLS;
    const loans = canLoan
      ? pickLoanClubsByValue(value, nationality, 3, [club.id, ...transfers.map((c) => c.id)])
      : [];
    const offers = withTwilight([
      ...offerTerms(loans, 'loan', value, 0, age, loanYears),
      ...offerTerms(transfers, 'permanent', value, fee, age, permYears),
    ]);
    if (canLoan && loans.length > 0) {
      return {
        headline: `${club.name} have put you up for sale`,
        detail: `Your ratio slipped to ${ratio.toFixed(2)} goals/game, below the ${threshold.toFixed(2)} they expect. A loan keeps ${club.name} as your parent club so you can win your place back.`,
        pendingTransfer: pendingFromOffers(
          'loan-or-transfer',
          fee <= 0
            ? 'Out of contract: more clubs can bid because there is no fee.'
            : 'Loan wages follow your value. Permanent fees follow the contract, not your market value.',
          offers,
          false,
        ),
      };
    }
    return {
      headline: `${club.name} have put you up for sale`,
      detail: `Your ratio slipped to ${ratio.toFixed(2)} goals/game, below the ${threshold.toFixed(2)} they expect.`,
      pendingTransfer: pendingFromOffers(
        'sold',
        fee <= 0
          ? 'Out of contract: these clubs can bid without a transfer fee.'
          : 'These clubs can pay the transfer fee.',
        withTwilight(offerTerms(transfers, 'permanent', value, fee, age, permYears)),
        false,
      ),
    };
  }

  const effectiveRatio = age < 28 ? (careerGames > 0 ? careerGoals / careerGames : 0) : ratio;
  const betterTier = tierForRatio(effectiveRatio);
  const valueTier = tierForMarketValue(value);
  if (betterTier < club.tier && !blockElite && valueTier <= betterTier) {
    const offers = pickPermanentClubs(betterTier, fee, [club.id], nationality, blockElite);
    const basis = age < 28 ? 'career' : "last season's";
    return {
      headline: 'A bigger club has come calling',
      detail: `Your ${basis} ratio of ${effectiveRatio.toFixed(2)} goals/game has attracted transfer interest.`,
      pendingTransfer: pendingFromOffers(
        'promotion-offer',
        'These clubs want to sign you - or stay put and keep building at your current club.',
        withTwilight(offerTerms(offers, 'permanent', value, fee, age, permYears)),
        true,
        stayOn(),
      ),
    };
  }

  return parallelTransfers(
    ratioMet ? 'Place secured' : 'Given more time to settle in',
    ratioMet
      ? `You maintained ${threshold.toFixed(2)} goals/game at ${club.name} - your place is safe.`
      : `${club.name} are giving you a fair run before judging your ratio.`,
    stayOn(),
    value,
    fee,
    nationality,
    [club.id],
    offerTierFromStanding({
      careerRatio: careerGames > 0 ? careerGoals / careerGames : ratio,
      marketValue: value,
      currentTier: club.tier,
      blockElite,
    }),
    graceActive && !ratioMet,
    age,
    blockElite,
    loanYears,
  );
}

function withTwilightMlsOffers(
  offers: ClubOfferTerms[],
  age: number,
  value: number,
  fee: number,
  excludeIds: string[],
): ClubOfferTerms[] {
  const taken = new Set([...excludeIds, ...offers.map((o) => o.clubId)]);
  const extra: ClubOfferTerms[] = [];
  if (age >= 32) {
    extra.push(...twilightDestinationOffers(TWILIGHT_SAUDI_CLUB_IDS, value, fee, age, taken));
    for (const offer of extra) taken.add(offer.clubId);
  }
  if (age >= 34 && age <= 36) {
    extra.push(...twilightDestinationOffers(TWILIGHT_MLS_CLUB_IDS, value, fee, age, taken));
  }
  return extra.length ? [...offers, ...extra] : offers;
}

function pickLoanClubsByValue(
  value: number,
  nationality: string | null | undefined,
  count: number,
  excludeIds: string[] = [],
): Club[] {
  const valueTier = tierForMarketValue(value);
  const loanTier = (valueTier === 1 ? 2 : valueTier) as ClubTier;
  return pickClubsFromTier(loanTier, count, excludeIds, nationality);
}
