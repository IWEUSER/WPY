import { CLUBS, clubsInCountry, clubsInLeague, earnedPromotion, getClub, goalRatioFromStrength, promotionTarget, SECOND_DIVISIONS, TIER_LABEL, type Club, type ClubTier } from './data/clubs';
import { countryForNationality, pickClubsBiasedToCountry, nearbyTierClubs, tierPool } from './clubOffers';
import { shuffle } from './util';
import {
  clubTransferBudget,
  consecutiveSeasonsBelow,
  DEFAULT_CONTRACT_YEARS,
  FIRST_CONTRACT_YEARS,
  ELITE_TRANSFER_VALUE_FLOOR,
  MEGA_CLUB_IDS,
  MEGA_TRANSFER_FEE,
  formAdjustedRatio,
  loanContractYearsRemaining,
  newContractYears,
  playerMarketValueFromSeasons,
  RESERVE_WEEKLY_WAGE,
  seasonCountsTowardForm,
  tierForMarketValue,
  transferFeeFromValue,
  weeklyWageForClub,
} from './playerValue';
import { defaultSquadStatus, nextSquadStatusAfterSeason, squadStatusOnArrival } from './squadStatus';
import type { PlayerRole, SeasonRecord, SquadStatus } from './types';

export const MAX_CONSECUTIVE_LOANS = 2;
/** @deprecated Use consecutiveLoanSpells — kept so older tests still compile. */
export const MAX_LOAN_SPELLS = MAX_CONSECUTIVE_LOANS;

/** Maps a goals-per-game ratio onto the club tier it's good enough for.
 * Calibrated against the 0.75 (elite) → 0.25 (lower level) first-team bars. */
export function tierForRatio(ratio: number): ClubTier {
  if (ratio >= goalRatioFromStrength(90)) return 1;
  if (ratio >= goalRatioFromStrength(81)) return 2;
  if (ratio >= goalRatioFromStrength(73)) return 3;
  if (ratio >= goalRatioFromStrength(64)) return 4;
  return 5;
}

/**
 * Who wants the player follows the goals-per-game ratio, never a better
 * club than that ratio has earned. Career and last-season ratios both
 * cap the band — the worse of the two wins.
 */
export function offerTierFromStanding(params: {
  ratio?: number;
  careerRatio: number;
  marketValue?: number;
  currentTier?: ClubTier;
  blockElite?: boolean;
}): ClubTier {
  const last = params.ratio ?? params.careerRatio;
  let tier = Math.max(tierForRatio(last), tierForRatio(params.careerRatio)) as ClubTier;
  if (params.blockElite) tier = Math.max(tier, 2) as ClubTier;
  if ((params.marketValue ?? Number.POSITIVE_INFINITY) < ELITE_TRANSFER_VALUE_FLOOR) {
    tier = Math.max(tier, 2) as ClubTier;
  }
  return tier;
}

/**
 * Same sample rule as market value: ignore a last season with fewer than
 * 15 games, otherwise blend career with that season. Loans and transfers
 * both use this so a 13-game blank cannot dump the player to League Two
 * while Real Madrid are still bidding.
 */
export function offerFormRatio(params: {
  lastSeason: SeasonRecord;
  careerGoals: number;
  careerGames: number;
}): number {
  const last = params.lastSeason;
  const lastCounts = seasonCountsTowardForm(last);
  let goals = params.careerGoals;
  let games = params.careerGames;
  if (!lastCounts) {
    goals -= last.goals;
    games -= last.gamesPlayed;
  }
  const careerRatio = games > 0 ? goals / games : 0;
  if (!lastCounts) return careerRatio;
  const lastRatio = last.gamesPlayed > 0 ? last.goals / last.gamesPlayed : 0;
  return formAdjustedRatio(careerRatio, lastRatio);
}

function sameTierInCountry(tier: ClubTier, country: string | null, excludeIds: string[]): Club[] {
  if (!country) return nearbyTierClubs(tier, excludeIds);
  return clubsInCountry(country).filter(
    (c) => !excludeIds.includes(c.id) && c.playable !== false && c.tier === tier,
  );
}

function pickClubsFromTier(
  tier: ClubTier,
  count: number,
  excludeIds: string[],
  nationality?: string | null,
  minFromCountry = 1,
  homeCountry?: string | null,
): Club[] {
  const preferred = withoutSaudi(tierPool(tier, excludeIds));
  const country = homeCountry ?? countryForNationality(nationality);
  const extraHome = withoutSaudi(sameTierInCountry(tier, country, excludeIds));
  const minHome = country && extraHome.length > 0 ? Math.min(minFromCountry, count) : 0;
  return withoutSaudi(pickClubsBiasedToCountry(preferred, count, country, minHome, extraHome));
}

export const LOAN_OFFER_COUNT = 6;
export const TRANSFER_OFFER_COUNT = 6;

export function isSaudiClub(club: Club | undefined | null): boolean {
  return Boolean(club && (club.league === 'Saudi Pro League' || club.country === 'Saudi Arabia'));
}

function withoutSaudi(clubs: Club[]): Club[] {
  return clubs.filter((club) => !isSaudiClub(club));
}

function pickSaudiOfferClub(excludeIds: string[]): Club | undefined {
  return shuffle(
    TWILIGHT_SAUDI_CLUB_IDS
      .map((id) => getClub(id))
      .filter((club): club is Club => Boolean(club) && !excludeIds.includes(club.id)),
  )[0];
}

/** At most one Saudi bid, and never before age 20. */
function attachOneSaudiOffer(
  picked: Club[],
  qualityTier: ClubTier,
  excludeIds: string[],
  age: number,
): Club[] {
  const without = withoutSaudi(picked);
  if (age < SAUDI_OFFER_MIN_AGE) {
    return without;
  }
  const pool = CLUBS.filter(
    (club) =>
      isSaudiClub(club) &&
      club.playable !== false &&
      club.tier === qualityTier &&
      !excludeIds.includes(club.id),
  );
  const saudi = shuffle(pool)[0];
  if (!saudi) {
    return without;
  }
  if (without.some((club) => club.id === saudi.id)) {
    return without.slice(0, TRANSFER_OFFER_COUNT);
  }
  if (without.length >= TRANSFER_OFFER_COUNT) {
    return [...without.slice(0, TRANSFER_OFFER_COUNT - 1), saudi];
  }
  return [...without, saudi];
}

function takeShuffled(pool: Club[], count: number, seen: Set<string>): Club[] {
  const out: Club[] = [];
  for (const club of shuffle(pool)) {
    if (out.length >= count) break;
    if (seen.has(club.id)) continue;
    seen.add(club.id);
    out.push(club);
  }
  return out;
}

/**
 * Six loan destinations at the ratio-appropriate level:
 * parent-country clubs first, then nationality when that country can
 * supply them, then the rest of the world. If nationality cannot supply
 * two, five come from the parent country.
 */
export function pickLoanClubsForMiss(
  ratio: number,
  nationality: string | null | undefined,
  count: number = LOAN_OFFER_COUNT,
  excludeIds: string[] = [],
  parentClubId?: string | null,
): Club[] {
  const tier = tierForRatio(ratio);
  const parent = parentClubId ? getClub(parentClubId) : undefined;
  const parentCountry = parent?.country ?? null;
  const natCountry = countryForNationality(nationality);
  const exclude = excludeIds.filter(Boolean);
  const atTierIn = (country: string | null) =>
    country
      ? withoutSaudi(CLUBS.filter(
          (c) => c.playable !== false && c.tier === tier && c.country === country && !exclude.includes(c.id),
        ))
      : [];
  const seen = new Set<string>(exclude);
  const picked: Club[] = [];
  const natPool = atTierIn(natCountry);
  const sameCountry = Boolean(parentCountry && natCountry && parentCountry === natCountry);
  if (sameCountry || natPool.length < 2) {
    picked.push(...takeShuffled(atTierIn(parentCountry), 5, seen));
  } else {
    picked.push(...takeShuffled(atTierIn(parentCountry), 3, seen));
    picked.push(...takeShuffled(natPool, 2, seen));
  }
  const world = withoutSaudi(CLUBS.filter((c) => c.playable !== false && c.tier === tier && !seen.has(c.id)));
  picked.push(...takeShuffled(world, count - picked.length, seen));
  return picked.slice(0, count);
}

function canPayFee(club: Club, fee: number): boolean {
  return fee <= 0 || clubTransferBudget(club) >= fee;
}

/**
 * Second-division windows stay in that league. A high market value
 * (mid-table band and above) also opens the promotion-target top flight.
 * Clubs one band better can bid only when the ratio has earned that band.
 */
function pickSecondDivisionClubs(
  fromLeague: string,
  fee: number,
  excludeIds: string[],
  marketValue: number,
  blockElite: boolean,
  qualityTier: ClubTier,
): Club[] {
  const seen = new Set<string>(excludeIds);
  const sameAll = withoutSaudi(clubsInLeague(fromLeague).filter(
    (c) => !seen.has(c.id) && c.playable !== false && c.tier === qualityTier,
  ));
  const sameAfford = sameAll.filter((c) => canPayFee(c, fee));
  const higherLeague = promotionTarget(fromLeague);
  const valueTier = tierForMarketValue(marketValue);
  const minHigher = (blockElite ? Math.max(2, valueTier) : valueTier) as ClubTier;
  const higherAll = higherLeague
    ? withoutSaudi(clubsInLeague(higherLeague).filter(
        (c) => !seen.has(c.id) && c.playable !== false && c.tier === qualityTier,
      ))
    : [];
  const higherAtBand = higherAll.filter((c) => canPayFee(c, fee) && c.tier >= minHigher);
  const stepUpTier = minHigher > 1 ? ((minHigher - 1) as ClubTier) : null;
  const higherStepUp =
    stepUpTier && qualityTier <= stepUpTier && !blockElite
      ? higherAll.filter((c) => canPayFee(c, fee) && c.tier === stepUpTier)
      : [];
  const warrantHigher = valueTier <= 3 && (higherAtBand.length > 0 || higherStepUp.length > 0);
  const picked: Club[] = [];
  const add = (pool: Club[], n: number) => {
    picked.push(...takeShuffled(pool, Math.max(0, n), seen));
  };
  if (warrantHigher) {
    add(sameAfford, 3);
    add(higherAtBand, TRANSFER_OFFER_COUNT - picked.length);
    add(sameAfford, TRANSFER_OFFER_COUNT - picked.length);
    add(higherStepUp, TRANSFER_OFFER_COUNT - picked.length);
    add(sameAll, TRANSFER_OFFER_COUNT - picked.length);
  } else {
    add(sameAfford, TRANSFER_OFFER_COUNT);
    add(sameAll, TRANSFER_OFFER_COUNT - picked.length);
    if (picked.length < TRANSFER_OFFER_COUNT) add(higherAtBand, TRANSFER_OFFER_COUNT - picked.length);
  }
  return picked.slice(0, TRANSFER_OFFER_COUNT);
}

/** Paid bids need a budget. A free agent still draws quality clubs — just more of them. */
export function pickPermanentClubs(
  qualityTier: ClubTier,
  fee: number,
  excludeIds: string[],
  nationality?: string | null,
  blockElite = false,
  fromLeague?: string | null,
  marketValue?: number,
  age = 99,
): Club[] {
  if ((marketValue ?? 0) > TRANSFER_MARKET_CAP) {
    if (age < SAUDI_OFFER_MIN_AGE) return [];
    const saudi = pickSaudiOfferClub(excludeIds);
    return saudi ? [saudi] : [];
  }
  if (qualityTier === 1 && (marketValue ?? 0) < ELITE_TRANSFER_VALUE_FLOOR) {
    qualityTier = 2;
  }
  if (fromLeague && SECOND_DIVISIONS.has(fromLeague)) {
    const local = pickSecondDivisionClubs(
      fromLeague,
      fee,
      excludeIds,
      marketValue ?? 0,
      blockElite,
      qualityTier,
    ).filter((c) => c.tier === qualityTier);
    if (local.length >= TRANSFER_OFFER_COUNT) {
      return attachOneSaudiOffer(local.slice(0, TRANSFER_OFFER_COUNT), qualityTier, excludeIds, age);
    }
    if (local.length > 0) {
      const fill = pickClubsFromTier(qualityTier, TRANSFER_OFFER_COUNT, [...excludeIds, ...local.map((c) => c.id)], nationality);
      return attachOneSaudiOffer([...local, ...fill].slice(0, TRANSFER_OFFER_COUNT), qualityTier, excludeIds, age);
    }
  }
  const country = countryForNationality(nationality);
  if (fee >= MEGA_TRANSFER_FEE && !blockElite && qualityTier === 1) {
    const megas = CLUBS.filter((c) => MEGA_CLUB_IDS.has(c.id) && !excludeIds.includes(c.id));
    return attachOneSaudiOffer(
      pickClubsBiasedToCountry(megas, Math.min(TRANSFER_OFFER_COUNT, megas.length), country, 0),
      qualityTier,
      excludeIds,
      age,
    );
  }
  if (fee <= 0) {
    return attachOneSaudiOffer(
      pickClubsFromTier(qualityTier, TRANSFER_OFFER_COUNT, excludeIds, nationality),
      qualityTier,
      excludeIds,
      age,
    );
  }
  const affordable = (tier: ClubTier) =>
    withoutSaudi(tierPool(tier, excludeIds).filter((c) => clubTransferBudget(c) >= fee));
  let pool = affordable(qualityTier);
  if (pool.length === 0) {
    pool = withoutSaudi(tierPool(qualityTier, excludeIds));
  }
  const extraHome = withoutSaudi(nearbyTierClubs(qualityTier, excludeIds).filter(
    (c) => clubTransferBudget(c) >= fee,
  ));
  const minHome = country && pool.some((c) => c.country === country) ? 1 : 0;
  return attachOneSaudiOffer(
    pickClubsBiasedToCountry(
      pool,
      Math.min(TRANSFER_OFFER_COUNT, Math.max(pool.length, 1)),
      country,
      minHome,
      extraHome,
    ),
    qualityTier,
    excludeIds,
    age,
  );
}

export type TransferKind = 'loan' | 'sold' | 'promotion-offer' | 'loan-or-transfer' | 'end-of-season' | 'trial-offers';

export interface ClubOfferTerms {
  clubId: string;
  move: 'loan' | 'permanent';
  fee: number;
  weeklyWage: number;
  contractYears: number;
  /** Current-club re-sign. Stay without this offer ticks the existing deal down one year. */
  renewal?: boolean;
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
  /** Shown after the selling club vetoes a bid the player already accepted. */
  rejectionDetail?: string;
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
  /** Playing-time status for the season about to start. */
  squadStatus?: SquadStatus;
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
  /** Parent-club years remaining while out on a later-career loan. Null on the first youth loan. */
  homeContractYearsRemaining?: number | null;
  careerStart?: string | null;
  squadStatus?: SquadStatus;
}

/** Ratio the player is judged against this season. On loan that's the parent first-team bar. */
export function requiredGoalRatio(
  role: PlayerRole,
  club: Club,
  parentClub?: Club | null,
): number {
  if (role === 'loan') return parentClub?.firstTeamGoalRatio ?? club.firstTeamGoalRatio;
  if (role === 'first-team') return club.firstTeamGoalRatio;
  return club.reserveGoalRatio;
}

export function countLoanSpells(history: SeasonRecord[], current?: SeasonRecord | null): number {
  return consecutiveLoanSpells(history, current);
}

/** Trailing loan seasons — two in a row at a club blocks a third until you transfer. */
export function consecutiveLoanSpells(history: SeasonRecord[], current?: SeasonRecord | null): number {
  const seasons = [...history, ...(current ? [current] : [])];
  let n = 0;
  for (let i = seasons.length - 1; i >= 0; i--) {
    if (seasons[i].role !== 'loan') break;
    n += 1;
  }
  return n;
}

/** Late-career "big move" destinations: Designated Player MLS sides. */
export const TWILIGHT_MLS_CLUB_IDS = ['lafc', 'inter-miami', 'nycfc', 'la-galaxy'] as const;
/** One of these four can bid — never more than one, and never before age 20. */
export const TWILIGHT_SAUDI_CLUB_IDS = ['al-hilal', 'al-nassr', 'al-ittihad', 'al-ahli'] as const;
/** Saudi money is off the table until the player turns 20. */
export const SAUDI_OFFER_MIN_AGE = 20;
/** European clubs will not bid above this asking price. */
export const TRANSFER_MARKET_CAP = 250_000_000;

/** Top-tier European weekly wage, used for twilight MLS and Saudi bids. */
export function twilightStarWage(marketValue: number): number {
  const elite = getClub('man-city') ?? getClub('real-madrid') ?? getClub('barcelona');
  if (!elite) return 180_000;
  return weeklyWageForClub(elite, marketValue, 'Premier League');
}

function applyTwilightDestinations(
  offers: ClubOfferTerms[],
  clubIds: readonly string[],
  value: number,
  fee: number,
  age: number,
  excludeIds: Set<string>,
): void {
  const years = newContractYears(age);
  const wage = twilightStarWage(value);
  for (const id of clubIds) {
    if (excludeIds.has(id) || !getClub(id)) continue;
    const existing = offers.find((offer) => offer.clubId === id);
    if (existing) {
      existing.weeklyWage = Math.max(existing.weeklyWage, wage);
      if (existing.move === 'permanent') existing.fee = fee;
      continue;
    }
    offers.push({
      clubId: id,
      move: 'permanent',
      fee,
      weeklyWage: wage,
      contractYears: years,
    });
  }
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
  permYears = newContractYears(age),
  loanRatio = 0,
  parentClubId?: string | null,
  fromLeague?: string | null,
): SeasonTransitionResult {
  const transfers = pickPermanentClubs(
    preferredTier,
    fee,
    excludeIds,
    nationality,
    blockElite,
    fromLeague,
    value,
    age,
  );
  const loans = includeLoans
    ? pickLoanClubsForMiss(
        loanRatio,
        nationality,
        LOAN_OFFER_COUNT,
        excludeIds,
        parentClubId,
      )
    : [];
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
    seasonNumber: params.season.seasonNumber,
    calendarWeek: 99,
    careerStart: params.careerStart,
    role: params.role,
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
  const currentStatus = params.squadStatus ?? defaultSquadStatus(role);
  const stayBar = requiredGoalRatio(role, club, getClub(parentClubId));
  const nextIfStay = nextSquadStatusAfterSeason({
    role: role === 'reserve' ? 'first-team' : role,
    current: role === 'reserve' ? 'rotation' : currentStatus,
    ratio,
    gamesPlayed: season.gamesPlayed,
    bar: stayBar,
  });
  const stayOn = (extra: Partial<SeasonTransitionImmediate> = {}): SeasonTransitionImmediate => {
    const stay: SeasonTransitionImmediate = {
      clubId,
      parentClubId,
      role: role === 'reserve' ? 'first-team' : 'first-team',
      seasonsAtCurrentClub: seasonsAtCurrentClub + 1,
      contractYearsRemaining: Math.max(0, yearsLeft - 1),
      clubLeague: nextLeague,
      squadStatus: role === 'reserve' ? 'rotation' : nextIfStay,
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
      return {
        headline: 'Promoted to the First Team!',
        detail: `You hit ${threshold.toFixed(2)} goals/game in the reserves - ${club.name} want you in the first-team squad now.`,
        immediate: stayOn({ role: 'first-team', contractYearsRemaining: FIRST_CONTRACT_YEARS, squadStatus: 'rotation' }),
      };
    }
    const options = pickLoanClubsForMiss(ratio, nationality, LOAN_OFFER_COUNT, [club.id], club.id);
    return {
      headline: 'Ratio not met - a loan move is coming',
      detail: `${ratio.toFixed(2)} goals/game wasn't enough to convince ${club.name}. You're being sent out on loan to get regular first-team football.`,
      pendingTransfer: pendingFromOffers(
        'loan',
        `${club.name} have lined up a loan move for you.`,
        options.map((c) => ({
          clubId: c.id,
          move: 'loan' as const,
          fee: 0,
          weeklyWage: RESERVE_WEEKLY_WAGE,
          contractYears: 1,
        })),
        false,
      ),
    };
  }

  if (role === 'loan') {
    const parentClub = getClub(parentClubId);
    const returnBar = parentClub?.firstTeamGoalRatio ?? club.firstTeamGoalRatio;
    const recalledYears =
      params.homeContractYearsRemaining != null && params.homeContractYearsRemaining > 0
        ? params.homeContractYearsRemaining
        : newContractYears(age);
    if (parentClub && ratio >= returnBar) {
      return parallelTransfers(
        `${parentClub.name} want you back - straight into the first team!`,
        `${ratio.toFixed(2)} goals/game on loan cleared ${parentClub.name}'s first-team bar of ${returnBar.toFixed(2)}.`,
        stayOn({
          clubId: parentClubId,
          parentClubId,
          role: 'first-team',
          seasonsAtCurrentClub: 0,
          contractYearsRemaining: recalledYears,
          clubLeague: parentClub.league,
          weeklyWage: weeklyWageForClub(parentClub, value, parentClub.league),
          squadStatus: squadStatusOnArrival({
            fromClub: club,
            toClub: parentClub,
            move: 'permanent',
            nextIfStay,
          }),
        }),
        value,
        fee,
        nationality,
        [club.id, parentClubId],
        offerTierFromStanding({
          ratio,
          careerRatio: careerGames > 0 ? careerGoals / careerGames : ratio,
          marketValue: value,
          blockElite,
        }),
        false,
        age,
        false,
        loanYears,
        recalledYears,
        0,
        parentClubId,
        parentClub.league,
      );
    }

    const exclude = [club.id, parentClub?.id ?? ''];
    const formRatio = offerFormRatio({ lastSeason: season, careerGoals, careerGames });
    const saleTier = offerTierFromStanding({
      ratio: formRatio,
      careerRatio: formRatio,
      marketValue: value,
      blockElite,
    });
    const transfers = pickPermanentClubs(saleTier, fee, exclude, nationality, blockElite, club.league, value, age);
    const canLoanAgain = loansUsed < MAX_CONSECUTIVE_LOANS;
    const loans = canLoanAgain
      ? pickLoanClubsForMiss(
          formRatio,
          nationality,
          LOAN_OFFER_COUNT,
          exclude,
          parentClubId,
        )
      : [];
    const offers = withTwilight([
      ...offerTerms(loans, 'loan', value, 0, age, loanYears),
      ...offerTerms(transfers, 'permanent', value, fee, age, permYears),
    ]);
    if (canLoanAgain && loans.length > 0) {
      return {
        headline: `${parentClub?.name ?? 'Your parent club'} will not bring you back into the first team`,
        detail: `${ratio.toFixed(2)} goals/game was below their ${returnBar.toFixed(2)} first-team bar. Choose another loan or a permanent move.`,
        pendingTransfer: pendingFromOffers(
          'loan-or-transfer',
          fee <= 0
            ? 'Out of contract: more clubs can bid for free.'
            : 'A second consecutive loan is the last one at this club. After that you must move permanently.',
          offers,
          false,
        ),
      };
    }
    return {
      headline: 'Two consecutive loans - you are being sold',
      detail: `${parentClub?.name ?? 'Your parent club'} will not send you on a third consecutive loan. They are selling you.`,
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
  const graceActive = seasonsAtCurrentClub === 0 && params.careerStart !== 'favourite-first-team';
  const formRatio = offerFormRatio({ lastSeason: season, careerGoals, careerGames });
  const ratioTier = offerTierFromStanding({
    ratio: formRatio,
    careerRatio: formRatio,
    marketValue: value,
    blockElite,
  });

  if (promoted) {
    return parallelTransfers(
      `${club.name} have been promoted to the ${nextLeague}!`,
      `Finished ${params.leaguePosition}${params.leaguePosition === 1 ? 'st' : 'nd'} in ${currentLeague}. Stay and play in the ${nextLeague} next season.`,
      stayOn(),
      value,
      fee,
      nationality,
      [club.id],
      ratioTier,
      true,
      age,
      blockElite,
      loanYears,
      permYears,
      formRatio,
      club.id,
      currentLeague,
    );
  }

  if (!ratioMet && !graceActive) {
    const transfers = pickPermanentClubs(ratioTier, fee, [club.id], nationality, blockElite, currentLeague, value, age);
    const canLoan = loansUsed < MAX_CONSECUTIVE_LOANS;
    const loans = canLoan
      ? pickLoanClubsForMiss(formRatio, nationality, LOAN_OFFER_COUNT, [club.id], club.id)
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
    const offers = pickPermanentClubs(betterTier, fee, [club.id], nationality, blockElite, currentLeague, value, age);
    const basis = age < 28 ? 'career' : "last season's";
    return attachCurrentClubRenewal(
      {
        headline: 'A bigger club has come calling',
        detail: `Your ${basis} ratio of ${effectiveRatio.toFixed(2)} goals/game has attracted transfer interest.`,
        pendingTransfer: pendingFromOffers(
          'promotion-offer',
          'These clubs want to sign you - or stay put and keep building at your current club.',
          withTwilight(offerTerms(offers, 'permanent', value, fee, age, permYears)),
          true,
          stayOn(),
        ),
      },
      params,
      club,
      value,
    );
  }

  return attachCurrentClubRenewal(
    parallelTransfers(
      ratioMet ? 'Place secured' : 'Given more time to settle in',
      ratioMet
        ? `You maintained ${threshold.toFixed(2)} goals/game at ${club.name} - your place is safe.`
        : `${club.name} are giving you a fair run before judging your ratio.`,
      stayOn(),
      value,
      fee,
      nationality,
      [club.id],
      ratioTier,
      graceActive && !ratioMet,
      age,
      blockElite,
      loanYears,
      permYears,
      formRatio,
      club.id,
      currentLeague,
    ),
    params,
    club,
    value,
    ratioMet,
  );
}

function attachCurrentClubRenewal(
  result: SeasonTransitionResult,
  params: SeasonTransitionParams,
  club: Club,
  value: number,
  ratioMet = true,
): SeasonTransitionResult {
  if (params.role === 'reserve' || params.role === 'loan') return result;
  if (!ratioMet) return result;
  const yearsLeft = params.contractYearsRemaining ?? 0;
  if (yearsLeft !== 1 && yearsLeft !== 2) return result;
  const years = newContractYears(params.age);
  const wage = weeklyWageForClub(club, value, params.clubLeague);
  const renewal = {
    clubId: club.id,
    move: 'permanent' as const,
    fee: 0,
    weeklyWage: wage,
    contractYears: years,
    renewal: true,
  };
  if (result.pendingTransfer) {
    const offers = result.pendingTransfer.offers ?? [];
    if (offers.some((o) => o.clubId === club.id && o.move === 'permanent')) return result;
    return {
      ...result,
      pendingTransfer: {
        ...result.pendingTransfer,
        offers: [renewal, ...offers],
        clubIds: [club.id, ...result.pendingTransfer.clubIds.filter((id) => id !== club.id)],
        detail: `${result.pendingTransfer.detail} ${club.name} have offered a ${years}-year contract.`,
      },
    };
  }
  if (result.immediate) {
    return {
      headline: result.headline,
      detail: `${result.detail} ${club.name} want to sign you to a ${years}-year deal.`,
      pendingTransfer: pendingFromOffers(
        'end-of-season',
        `${club.name} have tabled a ${years}-year contract. You can also keep the years left on your current deal.`,
        [renewal],
        true,
        result.immediate,
      ),
    };
  }
  return result;
}

function withTwilightMlsOffers(
  offers: ClubOfferTerms[],
  age: number,
  value: number,
  fee: number,
  excludeIds: string[],
): ClubOfferTerms[] {
  const existingSaudi = offers.filter((offer) => isSaudiClub(getClub(offer.clubId)));
  const next = offers
    .filter((offer) => !isSaudiClub(getClub(offer.clubId)))
    .map((offer) => ({ ...offer }));
  const blocked = new Set(excludeIds);
  if (age >= SAUDI_OFFER_MIN_AGE) {
    const wantGiant =
      value >= ELITE_TRANSFER_VALUE_FLOOR || value > TRANSFER_MARKET_CAP || age >= 32;
    if (wantGiant) {
      const saudi = pickSaudiOfferClub([...excludeIds, ...next.map((offer) => offer.clubId)]);
      if (saudi) {
        const permIndexes = next
          .map((offer, index) => (offer.move === 'permanent' && !offer.renewal ? index : -1))
          .filter((index) => index >= 0);
        if (permIndexes.length >= TRANSFER_OFFER_COUNT) {
          const replaceAt = permIndexes[permIndexes.length - 1]!;
          next[replaceAt] = {
            clubId: saudi.id,
            move: 'permanent',
            fee,
            weeklyWage: twilightStarWage(value),
            contractYears: newContractYears(age),
          };
        } else {
          applyTwilightDestinations(next, [saudi.id], value, fee, age, blocked);
        }
      }
    } else if (existingSaudi[0]) {
      next.push(existingSaudi[0]);
    }
  }
  if (age >= 34 && age <= 36) {
    applyTwilightDestinations(next, TWILIGHT_MLS_CLUB_IDS, value, fee, age, blocked);
  }
  return next;
}

/**
 * Two-step transfer: the player has already accepted personal terms.
 * Forced sales, free transfers, and expiring deals go through. A starter
 * with years left can have a listed-fee bid vetoed when the destination
 * is a peer or a step up — they then pick another offer.
 */
export function sellingClubAcceptsOffer(params: {
  offer: ClubOfferTerms;
  kind: TransferKind;
  allowDecline: boolean;
  currentClubId: string;
  role: PlayerRole;
  squadStatus: SquadStatus;
  contractYearsLeft: number;
  playerValue: number;
}): { accepted: boolean; detail: string } {
  const dest = getClub(params.offer.clubId);
  const current = getClub(params.currentClubId);
  const destName = dest?.name ?? 'the bidding club';
  const clubName = current?.name ?? 'Your club';

  if (params.offer.renewal || params.offer.clubId === params.currentClubId) {
    return { accepted: true, detail: '' };
  }
  if (!params.allowDecline) {
    return { accepted: true, detail: '' };
  }
  if (params.kind === 'sold' || params.kind === 'loan' || params.kind === 'trial-offers') {
    return { accepted: true, detail: '' };
  }
  if (params.offer.fee <= 0 || params.contractYearsLeft <= 1 || params.role === 'reserve') {
    return { accepted: true, detail: '' };
  }

  const feeLine = params.offer.move === 'loan'
    ? 'loan request'
    : `€${Math.round(params.offer.fee / 1_000_000)}m bid`;

  if (params.offer.move === 'loan') {
    if (params.squadStatus === 'starter' && params.contractYearsLeft > 1) {
      return {
        accepted: false,
        detail: `You agreed terms with ${destName}. ${clubName} rejected the ${feeLine} — they will not loan a starter.`,
      };
    }
    return { accepted: true, detail: '' };
  }

  if (params.squadStatus === 'impact') {
    return { accepted: true, detail: '' };
  }

  const steppingUp = Boolean(dest && current && dest.tier < current.tier);
  const peerMove = Boolean(dest && current && dest.tier <= current.tier);
  const listedFloor = params.playerValue * (params.squadStatus === 'rotation' ? 0.7 : 1.15);

  if (params.squadStatus === 'rotation') {
    if (steppingUp && params.contractYearsLeft >= 3 && params.offer.fee < listedFloor) {
      return {
        accepted: false,
        detail: `You agreed terms with ${destName}. ${clubName} rejected the ${feeLine} — they will not sell a rotation player up a level on that fee.`,
      };
    }
    return { accepted: true, detail: '' };
  }

  // Starter with years left: listed-fee moves to a peer or better club are blocked.
  if (peerMove && params.offer.fee < listedFloor) {
    return {
      accepted: false,
      detail: `You agreed terms with ${destName}. ${clubName} rejected the ${feeLine} — they will not sell a starter to ${destName} on that fee.`,
    };
  }
  return { accepted: true, detail: '' };
}

/** After both trial bands fail, clubs at the best-ratio band offer a reserve deal. */
export function trialFailTransferPending(params: {
  bestRatio: number;
  nationality: string | null;
  excludeIds?: string[];
  homeCountry?: string | null;
  minFromCountry?: number;
}): PendingTransfer {
  const tier = tierForRatio(params.bestRatio);
  const clubs = pickClubsFromTier(
    tier,
    TRANSFER_OFFER_COUNT,
    params.excludeIds ?? [],
    params.nationality,
    params.minFromCountry ?? 4,
    params.homeCountry,
  );
  const band = TIER_LABEL[tier].toLowerCase();
  return pendingFromOffers(
    'trial-offers',
    `Your best trial ratio was ${params.bestRatio.toFixed(2)}. ${band} clubs want to sign you on a 2-year reserve deal.`,
    clubs.map((club) => ({
      clubId: club.id,
      move: 'permanent' as const,
      fee: 0,
      weeklyWage: RESERVE_WEEKLY_WAGE,
      contractYears: FIRST_CONTRACT_YEARS,
    })),
    false,
  );
}

/** Forced loan after missing a reserve ratio. Sequential — no permanent offers yet. */
export function forcedLoanPending(params: {
  clubId: string;
  nationality: string | null;
  age: number;
  seasonNumber: number;
  ratio?: number;
}): PendingTransfer | null {
  const club = getClub(params.clubId);
  if (!club) return null;
  const options = pickLoanClubsForMiss(params.ratio ?? 0, params.nationality, LOAN_OFFER_COUNT, [club.id], club.id);
  if (options.length === 0) return null;
  return pendingFromOffers(
    'loan',
    `${club.name} have lined up a loan move for you. Hit their first-team ratio out on loan to earn a return.`,
    options.map((c) => ({
      clubId: c.id,
      move: 'loan' as const,
      fee: 0,
      weeklyWage: RESERVE_WEEKLY_WAGE,
      contractYears: 1,
    })),
    false,
  );
}

