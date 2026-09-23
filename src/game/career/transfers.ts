import { CLUBS, clubsInCountry, clubsInLeague, earnedPromotion, getClub, goalRatioFromStrength, promotionTarget, SECOND_DIVISIONS, secondDivisionOf, TIER_LABEL, type Club, type ClubTier } from './data/clubs';
import { countryForNationality, pickClubsBiasedToCountry, nearbyTierClubs, tierPool } from './clubOffers';
import { trialDestinationCountries } from './trialGeography';
import { shuffle } from './util';
import {
  clubTransferBudget,
  consecutiveSeasonsBelow,
  DEFAULT_CONTRACT_YEARS,
  FIRST_CONTRACT_YEARS,
  RESERVE_CONTRACT_YEARS,
  ELITE_TRANSFER_VALUE_FLOOR,
  formAdjustedRatio,
  leagueValueWeight,
  MIN_ACCEPTED_FEE_RATIO,
  newContractYears,
  playerMarketValueFromSeasons,
  seasonCountsTowardForm,
  tierForMarketValue,
  TOP_LEAGUES,
  transferFeeFromValue,
  weeklyWageForClub,
  weeklyWageForSquadStatus,
} from './playerValue';
import { displaySeasonNumber, isFirstPublicSeason } from './seasonDisplay';
import {
  defaultSquadStatus,
  nextSquadStatusAfterSeason,
  openingSquadStatus,
  RISING_STAR_MIN_RATIO,
  seasonOverridesRatioBar,
  seasonRatioClearsBar,
  SQUAD_STATUS_LABEL,
  squadStatusOnArrival,
} from './squadStatus';
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
 * Last-season or career ratio decides the club band. A high market value
 * alone cannot pull Elite/Strong bids when the player has not hit that
 * ratio this season or on aggregate. Paid elite bids still need the €50m floor.
 */
export function offerTierFromStanding(params: {
  ratio?: number;
  careerRatio: number;
  marketValue?: number;
  currentTier?: ClubTier;
  blockElite?: boolean;
  fee?: number;
}): ClubTier {
  const last = params.ratio ?? 0;
  const career = params.careerRatio ?? 0;
  const best = Math.max(last, career);
  let tier = tierForRatio(best);
  if (params.blockElite) tier = Math.max(tier, 2) as ClubTier;
  const paid = (params.fee ?? 1) > 0;
  if (paid && (params.marketValue ?? Number.POSITIVE_INFINITY) < ELITE_TRANSFER_VALUE_FLOOR) {
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

export const LOAN_OFFER_COUNT = 3;
export const TRANSFER_OFFER_COUNT = 6;
/** Two of the three loans prefer the player's nation, or trial geography when that nation has no league. */
const GEO_LOAN_COUNT = 2;

function geographicLoanCountries(nationality: string | null | undefined): string[] {
  return trialDestinationCountries(nationality);
}

function takeGeographicLoans(
  pool: Club[],
  nationality: string | null | undefined,
  count: number,
  seen: Set<string>,
): Club[] {
  const countries = new Set(geographicLoanCountries(nationality));
  if (countries.size === 0 || count <= 0) return [];
  return takeShuffled(pool.filter((club) => countries.has(club.country)), count, seen);
}

/** Fill two geographic/home loans first, then the remaining slots from the rest of the pool. */
function withGeographicLoanBias(
  qualityPool: Club[],
  nationality: string | null | undefined,
  count: number,
  excludeIds: string[],
  extraFill: Club[] = [],
  lastFill: Club[] = [],
): Club[] {
  const seen = new Set<string>(excludeIds.filter(Boolean));
  const picked: Club[] = [];
  const destWanted = Math.min(GEO_LOAN_COUNT, count);
  picked.push(...takeGeographicLoans(qualityPool, nationality, destWanted, seen));
  if (picked.length < destWanted) {
    picked.push(...takeGeographicLoans(extraFill, nationality, destWanted - picked.length, seen));
  }
  if (picked.length < destWanted) {
    picked.push(...takeGeographicLoans(lastFill, nationality, destWanted - picked.length, seen));
  }
  picked.push(...takeShuffled(qualityPool, count - picked.length, seen));
  picked.push(...takeShuffled(extraFill, count - picked.length, seen));
  picked.push(...takeShuffled(lastFill, count - picked.length, seen));
  return picked.slice(0, count);
}

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
      .filter((club): club is Club => club != null && !excludeIds.includes(club.id)),
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
  const giants = TWILIGHT_SAUDI_CLUB_IDS
    .map((id) => getClub(id))
    .filter((club): club is Club => club != null && !excludeIds.includes(club.id));
  const sameTier = CLUBS.filter(
    (club) =>
      isSaudiClub(club) &&
      club.playable !== false &&
      club.tier === qualityTier &&
      !excludeIds.includes(club.id),
  );
  const nearby = CLUBS.filter(
    (club) =>
      isSaudiClub(club) &&
      club.playable !== false &&
      Math.abs(club.tier - qualityTier) <= 1 &&
      !excludeIds.includes(club.id),
  );
  const saudi = shuffle(giants)[0] ?? shuffle(sameTier)[0] ?? shuffle(nearby)[0];
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

export function canLoanToSameDivision(playerRatio: number, club: Club): boolean {
  return playerRatio >= club.firstTeamGoalRatio;
}

/** MLS is the floor for second-division and lower-league-country loans. */
const MLS_LOAN_FLOOR_WEIGHT = leagueValueWeight('MLS');

function isPlayableLoanClub(club: Club, excludeIds: string[]): boolean {
  return club.playable !== false && !excludeIds.includes(club.id);
}

function lowerLeagueCountryPool(originCountry: string, excludeIds: string[]): Club[] {
  return CLUBS.filter(
    (c) =>
      isPlayableLoanClub(c, excludeIds) &&
      !TOP_LEAGUES.has(c.league) &&
      !SECOND_DIVISIONS.has(c.league) &&
      leagueValueWeight(c.league) + 1e-9 >= MLS_LOAN_FLOOR_WEIGHT &&
      c.country !== originCountry,
  );
}

/**
 * Rising-star (0.33+) loans follow the origin club, not the destination
 * first-team bar. Elite/Strong top-flight sides send the player to lower-scale
 * clubs in the same division; medium-or-lower top-flight sides send them to
 * the domestic second division; a second-division origin loans to a weaker
 * country's top flight, with MLS as the floor.
 */
export function pickLoanClubsFromOrigin(
  fromClub: Club,
  count: number = LOAN_OFFER_COUNT,
  excludeIds: string[] = [],
  nationality?: string | null,
): Club[] {
  const exclude = [...excludeIds.filter(Boolean), fromClub.id];
  const fromLeague = fromClub.league;
  const eliteOrStrong = fromClub.tier <= 2;
  const sameLeagueLower = (minTier: ClubTier) =>
    clubsInLeague(fromLeague).filter((c) => isPlayableLoanClub(c, exclude) && c.tier >= minTier);
  const otherTopFlightLower = () =>
    CLUBS.filter(
      (c) =>
        isPlayableLoanClub(c, exclude) &&
        TOP_LEAGUES.has(c.league) &&
        c.league !== fromLeague &&
        c.tier >= 3,
    );
  const floorAway = () => lowerLeagueCountryPool(fromClub.country, exclude);
  const mls = clubsInLeague('MLS').filter((c) => isPlayableLoanClub(c, exclude));

  let quality: Club[] = [];
  let extra: Club[] = [];
  if (SECOND_DIVISIONS.has(fromLeague)) {
    quality = floorAway();
    extra = mls;
  } else if (TOP_LEAGUES.has(fromLeague) && eliteOrStrong) {
    quality = sameLeagueLower(3);
    extra = otherTopFlightLower();
  } else if (TOP_LEAGUES.has(fromLeague)) {
    const second = secondDivisionOf(fromLeague);
    quality = second
      ? clubsInLeague(second).filter((c) => c.country === fromClub.country && isPlayableLoanClub(c, exclude))
      : [];
    extra = CLUBS.filter((c) => SECOND_DIVISIONS.has(c.league) && isPlayableLoanClub(c, exclude));
  } else if (eliteOrStrong) {
    quality = sameLeagueLower(3);
    extra = [...floorAway().filter((c) => c.tier >= 3), ...mls];
  } else {
    quality = floorAway();
    extra = mls;
  }
  return withGeographicLoanBias(withoutSaudi(quality), nationality, count, exclude, withoutSaudi(extra));
}

function pickSeasonLoanClubs(
  lastRatio: number,
  formRatio: number,
  nationality: string | null | undefined,
  excludeIds: string[],
  fromClub: Club | undefined,
  extras: LoanPickExtras = {},
): Club[] {
  if (fromClub && (extras.honoursOverride || lastRatio >= RISING_STAR_MIN_RATIO)) {
    return pickLoanClubsFromOrigin(fromClub, LOAN_OFFER_COUNT, excludeIds, nationality);
  }
  return pickLoanClubsForMiss(
    formRatio,
    nationality,
    LOAN_OFFER_COUNT,
    excludeIds,
    fromClub?.id,
    extras,
  );
}

/** Who bids follows last-season or career ratio; value only enforces the elite floor. */
export function transferOfferTier(params: {
  marketValue: number;
  lastRatio?: number;
  careerRatio?: number;
  blockElite?: boolean;
  fee?: number;
}): ClubTier {
  return offerTierFromStanding({
    ratio: params.lastRatio,
    careerRatio: params.careerRatio ?? 0,
    marketValue: params.marketValue,
    blockElite: params.blockElite,
    fee: params.fee,
  });
}

export interface LoanPickExtras {
  marketValue?: number;
  honoursOverride?: boolean;
  consecutivePoor?: number;
}

/**
 * Same-division loans come first when the player's ratio already meets that
 * club's first-team bar (or a league/tournament honour overrode the bar).
 * Second-division loans are the fallback. A high market value never dumps
 * the player into a second division.
 */
export function pickLoanClubsForMiss(
  ratio: number,
  nationality: string | null | undefined,
  count: number = LOAN_OFFER_COUNT,
  excludeIds: string[] = [],
  parentClubId?: string | null,
  extras: LoanPickExtras = {},
): Club[] {
  const parent = parentClubId ? getClub(parentClubId) : undefined;
  const parentCountry = parent?.country ?? null;
  const parentLeague = parent?.league ?? null;
  const parentAlreadySecond = Boolean(parentLeague && SECOND_DIVISIONS.has(parentLeague));
  const natCountry = countryForNationality(nationality);
  const exclude = excludeIds.filter(Boolean);
  const leagueBars = parentLeague
    ? clubsInLeague(parentLeague).map((c) => c.firstTeamGoalRatio)
    : [];
  const effectiveRatio = extras.honoursOverride && leagueBars.length > 0
    ? Math.max(ratio, ...leagueBars)
    : ratio;
  const sameDivision = parentLeague
    ? withoutSaudi(CLUBS.filter(
        (c) =>
          c.playable !== false &&
          c.league === parentLeague &&
          !exclude.includes(c.id) &&
          canLoanToSameDivision(effectiveRatio, c),
      ))
    : [];
  const otherTopFlight = withoutSaudi(CLUBS.filter(
    (c) =>
      c.playable !== false &&
      !SECOND_DIVISIONS.has(c.league) &&
      c.league !== parentLeague &&
      !exclude.includes(c.id) &&
      canLoanToSameDivision(effectiveRatio, c),
  ));
  const skipSecond = parentAlreadySecond;
  const secondIn = (country: string | null) =>
    country
      ? withoutSaudi(CLUBS.filter(
          (c) =>
            c.playable !== false &&
            SECOND_DIVISIONS.has(c.league) &&
            c.country === country &&
            !exclude.includes(c.id),
        ))
      : [];
  const homeSecond = parentAlreadySecond || skipSecond ? [] : secondIn(parentCountry);
  const natSecond =
    skipSecond || parentAlreadySecond
      ? []
      : natCountry && natCountry !== parentCountry
        ? secondIn(natCountry)
        : [];
  const worldSecond = skipSecond || parentAlreadySecond
    ? []
    : withoutSaudi(CLUBS.filter(
        (c) => c.playable !== false && SECOND_DIVISIONS.has(c.league) && !exclude.includes(c.id),
      ));

  const quality = sameDivision.length > 0 ? sameDivision : otherTopFlight;
  const extra = sameDivision.length > 0 ? otherTopFlight : [];
  const last = [...homeSecond, ...natSecond, ...worldSecond];
  return withGeographicLoanBias(quality, nationality, count, exclude, extra, last);
}

function canPayFee(club: Club, fee: number): boolean {
  return fee <= 0 || clubTransferBudget(club) >= fee * MIN_ACCEPTED_FEE_RATIO;
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
  if (fee > 0 && qualityTier === 1 && (marketValue ?? 0) < ELITE_TRANSFER_VALUE_FLOOR) {
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
  if (fee <= 0) {
    return attachOneSaudiOffer(
      pickClubsFromTier(qualityTier, TRANSFER_OFFER_COUNT, excludeIds, nationality),
      qualityTier,
      excludeIds,
      age,
    );
  }
  const affordable = (tier: ClubTier) =>
    withoutSaudi(tierPool(tier, excludeIds).filter((c) => canPayFee(c, fee)));
  const allIn = (tier: ClubTier) => withoutSaudi(tierPool(tier, excludeIds));
  const fillFrom = (into: Club[], source: Club[], count: number) => {
    const seen = new Set(into.map((c) => c.id));
    for (const club of source) {
      if (into.length >= count) break;
      if (seen.has(club.id)) continue;
      into.push(club);
      seen.add(club.id);
    }
    return into;
  };
  let pool = affordable(qualityTier);
  if (pool.length === 0 && fee > 0) {
    for (let tier = (qualityTier + 1) as ClubTier; tier <= 5; tier = (tier + 1) as ClubTier) {
      pool = affordable(tier);
      if (pool.length > 0) break;
    }
  }
  if (fee <= 0 && pool.length < TRANSFER_OFFER_COUNT) {
    pool = fillFrom(pool, allIn(qualityTier), TRANSFER_OFFER_COUNT);
  }
  if (pool.length < TRANSFER_OFFER_COUNT && qualityTier === 1) {
    const seen = new Set(pool.map((club) => club.id));
    for (const club of withoutSaudi(tierPool(1, excludeIds))) {
      if (seen.has(club.id) || !canPayFee(club, fee)) continue;
      pool.push(club);
      if (pool.length >= TRANSFER_OFFER_COUNT) break;
    }
  }
  if (pool.length === 0) {
    return attachOneSaudiOffer([], qualityTier, excludeIds, age);
  }
  const extraHome = withoutSaudi(nearbyTierClubs(qualityTier, excludeIds).filter(
    (c) => canPayFee(c, fee),
  ));
  const minHome = country && pool.some((c) => c.country === country) ? 1 : 0;
  return attachOneSaudiOffer(
    pickClubsBiasedToCountry(
      pool,
      Math.min(TRANSFER_OFFER_COUNT, pool.length),
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
  /** Playing-time role at the destination. Loan wages follow that club's starter band. */
  squadStatus?: SquadStatus;
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
  /** Current weekly wage — loan clubs pay this rather than their starter band. */
  weeklyWage?: number;
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
/** Saudi can join a packed elite list above this asking price. Not a cap on player value. */
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
    const dest = getClub(id);
    const listed = dest ? Math.min(fee, clubTransferBudget(dest)) : fee;
    if (existing) {
      existing.weeklyWage = Math.max(existing.weeklyWage, wage);
      if (existing.move === 'permanent') existing.fee = listed;
      continue;
    }
    offers.push({
      clubId: id,
      move: 'permanent',
      fee: listed,
      weeklyWage: wage,
      contractYears: years,
      squadStatus: 'starter',
    });
  }
}

interface OfferTermExtras {
  currentWeeklyWage?: number;
  originClub?: Club | null;
  playerRatio?: number;
  allowRisingStar?: boolean;
}

function destinationSquadStatus(
  club: Club,
  playerRatio: number | undefined,
  allowRisingStar: boolean,
): SquadStatus {
  return squadStatusOnArrival({
    fromClub: null,
    toClub: club,
    move: 'permanent',
    nextIfStay: 'starter',
    playerRatio,
    allowRisingStar,
  });
}

function offerTerms(
  clubs: Club[],
  move: ClubOfferTerms['move'],
  value: number,
  fee: number,
  age: number,
  _contractYears?: number,
  extras?: OfferTermExtras,
): ClubOfferTerms[] {
  const allowRisingStar = extras?.allowRisingStar !== false;
  return clubs.map((club) => {
    if (move === 'loan') {
      return {
        clubId: club.id,
        move,
        fee: 0,
        weeklyWage: weeklyWageForSquadStatus(club, value, 'starter', club.league),
        contractYears: 1,
        squadStatus: 'starter' as const,
      };
    }
    const status = destinationSquadStatus(club, extras?.playerRatio, allowRisingStar);
    const years = status === 'reserve' ? RESERVE_CONTRACT_YEARS : newContractYears(age);
    return {
      clubId: club.id,
      move,
      fee: Math.min(fee, clubTransferBudget(club)),
      weeklyWage: weeklyWageForSquadStatus(club, value, status),
      contractYears: years,
      squadStatus: status,
    };
  });
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
  loanHonours = false,
  lastRatio = loanRatio,
  extras?: OfferTermExtras,
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
  const originClub = (parentClubId ? getClub(parentClubId) : undefined)
    ?? (excludeIds[0] ? getClub(excludeIds[0]) : undefined);
  const loans = includeLoans
    ? pickSeasonLoanClubs(
        lastRatio,
        loanRatio,
        nationality,
        excludeIds,
        originClub,
        { marketValue: value, honoursOverride: loanHonours },
      )
    : [];
  const offers = withTwilightMlsOffers(
    [
      ...offerTerms(loans, 'loan', value, 0, age, loanYears, extras),
      ...offerTerms(transfers, 'permanent', value, fee, age, permYears, extras),
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
        ? 'Loan destinations follow the club you are leaving. Loan wages follow each destination. Permanent fees follow your market value.'
        : fee <= 0
          ? 'Out of contract: more clubs can bid because there is no fee.'
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
  const formRatio = offerFormRatio({ lastSeason: season, careerGoals, careerGames });
  const value = playerValueFromParams(params, role === 'loan' ? getClub(parentClubId) ?? club : club);
  const fee = transferFeeFromValue(value, yearsLeft);
  const blockElite = consecutiveSeasonsBelow(seasons, 0.5) >= 2;
  const currentLeague = params.clubLeague ?? club.league;
  const promoted = role === 'first-team' && earnedPromotion(currentLeague, params.leaguePosition);
  const nextLeague = promoted ? (promotionTarget(currentLeague) ?? currentLeague) : currentLeague;
  const honoursClear = seasonOverridesRatioBar(season);
  const currentStatus = params.squadStatus ?? defaultSquadStatus(role);
  const publicSeason = displaySeasonNumber(season.seasonNumber, {
    role,
    careerStart: params.careerStart,
  });
  const allowRisingStar = publicSeason === 1;
  const stayBar = requiredGoalRatio(role, club, getClub(parentClubId));
  const nextIfStay = nextSquadStatusAfterSeason({
    role: role === 'reserve' ? 'first-team' : role,
    current: role === 'reserve' ? 'rising-star' : currentStatus,
    ratio,
    gamesPlayed: season.gamesPlayed,
    bar: stayBar,
    honoursClear,
    allowRisingStar,
  });
  const stayOn = (extra: Partial<SeasonTransitionImmediate> = {}): SeasonTransitionImmediate => {
    const stay: SeasonTransitionImmediate = {
      clubId,
      parentClubId,
      role: role === 'reserve' ? 'first-team' : 'first-team',
      seasonsAtCurrentClub: seasonsAtCurrentClub + 1,
      contractYearsRemaining: Math.max(0, yearsLeft - 1),
      clubLeague: nextLeague,
      squadStatus: role === 'reserve' ? 'rising-star' : nextIfStay,
      ...extra,
    };
    if (stay.weeklyWage == null) {
      stay.weeklyWage = params.weeklyWage;
    }
    return stay;
  };
  const loanPick = (exclude: string[], origin: Club) =>
    pickSeasonLoanClubs(ratio, formRatio, nationality, exclude, origin, {
      marketValue: value,
      honoursOverride: honoursClear,
      consecutivePoor: consecutiveSeasonsBelow(seasons, 0.25),
    });
  const withTwilight = (offers: ClubOfferTerms[]) =>
    withTwilightMlsOffers(offers, age, value, fee, [club.id, parentClubId]);
  const permYears = newContractYears(age);
  const loanYears = 1;
  const careerRatio = careerGames > 0 ? careerGoals / careerGames : 0;
  const transferTier = transferOfferTier({
    marketValue: value,
    lastRatio: ratio,
    careerRatio,
    blockElite,
    fee,
  });
  const parentYears = params.homeContractYearsRemaining;
  const canOfferLoans = (
    role === 'loan' && parentYears != null
      ? transferFeeFromValue(value, parentYears)
      : fee
  ) > 0;
  const offerExtras: OfferTermExtras = {
    currentWeeklyWage: params.weeklyWage,
    originClub: club,
    playerRatio: ratio,
    allowRisingStar,
  };

  if (role === 'reserve') {
    const threshold = club.reserveGoalRatio;
    if (ratio >= threshold || honoursClear) {
      const honoursOnly = honoursClear && ratio + 1e-9 < threshold;
      return {
        headline: 'Promoted to the First Team!',
        detail: honoursOnly
          ? `A league or tournament honour this season counted as meeting ${club.name}'s ${threshold.toFixed(2)} reserve bar (${ratio.toFixed(2)} goals/game). They want you in the first-team squad now as a Rising star.`
          : `You met the ${threshold.toFixed(2)} goals/game reserve bar (${ratio.toFixed(2)} this season) — ${club.name} want you in the first-team squad now as a Rising star.`,
        immediate: stayOn({
          role: 'first-team',
          contractYearsRemaining: FIRST_CONTRACT_YEARS,
          squadStatus: openingSquadStatus('first-team'),
        }),
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
          weeklyWage: weeklyWageForSquadStatus(c, value, 'starter', c.league),
          contractYears: 1,
          squadStatus: 'starter' as const,
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
    if (parentClub && (ratio >= returnBar || honoursClear)) {
      const recallStatus = squadStatusOnArrival({
        fromClub: club,
        toClub: parentClub,
        move: 'recall',
        nextIfStay,
        playerRatio: ratio,
      });
      const recallLabel = SQUAD_STATUS_LABEL[recallStatus].toLowerCase();
      const honoursOnly = honoursClear && ratio + 1e-9 < returnBar;
      return parallelTransfers(
        `${parentClub.name} want you back — into the first-team squad as a ${recallLabel}.`,
        honoursOnly
          ? `A league or tournament honour this season overrode ${parentClub.name}'s ${returnBar.toFixed(2)} first-team bar.`
          : `${ratio.toFixed(2)} goals/game on loan cleared ${parentClub.name}'s first-team bar of ${returnBar.toFixed(2)}.`,
        stayOn({
          clubId: parentClubId,
          parentClubId,
          role: 'first-team',
          seasonsAtCurrentClub: 0,
          contractYearsRemaining: recalledYears,
          clubLeague: parentClub.league,
          squadStatus: recallStatus,
        }),
        value,
        fee,
        nationality,
        [club.id, parentClubId],
        transferTier,
        false,
        age,
        false,
        loanYears,
        permYears,
        0,
        parentClubId,
        parentClub.league,
        false,
        ratio,
        offerExtras,
      );
    }

    const exclude = [club.id, parentClub?.id ?? ''];
    const transfers = pickPermanentClubs(transferTier, fee, exclude, nationality, blockElite, club.league, value, age);
    const canLoanAgain = canOfferLoans && loansUsed < MAX_CONSECUTIVE_LOANS;
    const loans = canLoanAgain
      ? loanPick(exclude, club)
      : [];
    const offers = withTwilight([
      ...offerTerms(loans, 'loan', value, 0, age, loanYears, offerExtras),
      ...offerTerms(transfers, 'permanent', value, fee, age, permYears, offerExtras),
    ]);
    if (canLoanAgain && loans.length > 0) {
      return {
        headline: `${parentClub?.name ?? 'Your parent club'} will not bring you back into the first team`,
        detail: `${ratio.toFixed(2)} goals/game was below their ${returnBar.toFixed(2)} first-team bar. Choose another loan or a permanent move.`,
        pendingTransfer: pendingFromOffers(
          'loan-or-transfer',
          loansUsed < 1
            ? 'A first loan can be followed by one more. After two consecutive loans you must move permanently.'
            : 'A second consecutive loan is the last one at this club. After that you must move permanently.',
          offers,
          false,
        ),
      };
    }
    return {
      headline: loansUsed >= MAX_CONSECUTIVE_LOANS
        ? 'Two consecutive loans - you are being sold'
        : `${parentClub?.name ?? 'Your parent club'} are selling you`,
      detail: loansUsed >= MAX_CONSECUTIVE_LOANS
        ? `${parentClub?.name ?? 'Your parent club'} will not send you on a third consecutive loan. They are selling you.`
        : `${parentClub?.name ?? 'Your parent club'} will not bring you back into the first team.`,
      pendingTransfer: pendingFromOffers(
        'sold',
        fee <= 0
          ? 'Out of contract: these clubs can bid without a transfer fee.'
          : 'These clubs can pay the transfer fee.',
        withTwilight(offerTerms(transfers, 'permanent', value, fee, age, permYears, offerExtras)),
        false,
      ),
    };
  }

  // role === 'first-team'
  const threshold = club.firstTeamGoalRatio;
  const ratioMet = seasonRatioClearsBar({
    ratio,
    gamesPlayed: season.gamesPlayed,
    bar: threshold,
    season,
  });
  const graceActive = seasonsAtCurrentClub === 0 && params.careerStart !== 'favourite-first-team';
  const firstPublic = isFirstPublicSeason(season.seasonNumber, {
    role,
    careerStart: params.careerStart,
  });
  const firstSeasonStayStatus: SquadStatus = nextSquadStatusAfterSeason({
    role: 'first-team',
    current: currentStatus,
    ratio,
    gamesPlayed: season.gamesPlayed,
    bar: threshold,
    honoursClear,
    allowRisingStar: true,
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
      transferTier,
      canOfferLoans,
      age,
      blockElite,
      loanYears,
      permYears,
      formRatio,
      club.id,
      currentLeague,
      honoursClear,
      ratio,
      offerExtras,
    );
  }

  if (firstPublic) {
    const transfers = pickPermanentClubs(transferTier, fee, [club.id], nationality, blockElite, currentLeague, value, age);
    const loans = canOfferLoans && !ratioMet ? loanPick([club.id], club) : [];
    const offers = withTwilight([
      ...offerTerms(loans, 'loan', value, 0, age, loanYears, offerExtras),
      ...offerTerms(transfers, 'permanent', value, fee, age, permYears, offerExtras),
    ]);
    const stay = stayOn({ squadStatus: firstSeasonStayStatus });
    const honoursOnly = honoursClear && !(season.gamesPlayed > 0 && ratio + 1e-9 >= threshold);
    const stayLabel = SQUAD_STATUS_LABEL[firstSeasonStayStatus];
    const headline = ratioMet
      ? honoursOnly
        ? 'Honours overrode the finishing ratio'
        : 'Place secured'
      : firstSeasonStayStatus === 'reserve'
        ? 'Stay as a Reserve — or move on'
        : `Stay as ${stayLabel === 'Impact' ? 'an Impact player' : `a ${stayLabel}`} — or move on`;
    const detail = ratioMet
      ? honoursOnly
        ? `Top goalscorer or player of the league/tournament this season counted as meeting ${club.name}'s ${threshold.toFixed(2)} bar.`
        : `You maintained ${threshold.toFixed(2)} goals/game at ${club.name}.`
      : firstSeasonStayStatus === 'reserve'
        ? `${ratio.toFixed(2)} goals/game was below the ${RISING_STAR_MIN_RATIO.toFixed(2)} Season 1 line — Reserve next season, every second game.`
        : `${ratio.toFixed(2)} goals/game is enough to keep ${stayLabel} (minimum ${RISING_STAR_MIN_RATIO.toFixed(2)}).`;
    return attachCurrentClubRenewal(
      {
        headline,
        detail,
        pendingTransfer: pendingFromOffers(
          loans.length > 0 ? 'loan-or-transfer' : 'end-of-season',
          loans.length > 0
            ? 'Compare weekly wages. Stay on the current deal, take a loan, or move.'
            : fee <= 0
              ? 'Compare weekly wages. Stay or move as a free agent.'
              : 'Compare weekly wages. Stay on the current deal, or move.',
          offers,
          Boolean(stay),
          stay,
        ),
      },
      params,
      club,
      value,
      ratioMet,
      firstSeasonStayStatus,
    );
  }

  if (!ratioMet && !graceActive) {
    const transfers = pickPermanentClubs(transferTier, fee, [club.id], nationality, blockElite, currentLeague, value, age);
    const canLoan = canOfferLoans && loansUsed < MAX_CONSECUTIVE_LOANS;
    const loans = canLoan ? loanPick([club.id], club) : [];
    const offers = withTwilight([
      ...offerTerms(loans, 'loan', value, 0, age, loanYears, offerExtras),
      ...offerTerms(transfers, 'permanent', value, fee, age, permYears, offerExtras),
    ]);
    if (canLoan && loans.length > 0) {
      return {
        headline: `${club.name} have put you up for sale`,
        detail: `Your ratio slipped to ${ratio.toFixed(2)} goals/game, below the ${threshold.toFixed(2)} they expect. A loan keeps ${club.name} as your parent club so you can win your place back.`,
        pendingTransfer: pendingFromOffers(
          'loan-or-transfer',
          'Loan destinations follow the club you are leaving. Permanent fees follow your market value.',
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
        withTwilight(offerTerms(transfers, 'permanent', value, fee, age, permYears, offerExtras)),
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
          withTwilight(offerTerms(offers, 'permanent', value, fee, age, permYears, offerExtras)),
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
      transferTier,
      canOfferLoans && graceActive && !ratioMet,
      age,
      blockElite,
      loanYears,
      permYears,
      formRatio,
      club.id,
      currentLeague,
      honoursClear,
      ratio,
      offerExtras,
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
  stayStatus?: SquadStatus,
): SeasonTransitionResult {
  if (params.role === 'reserve' || params.role === 'loan') return result;
  if (!ratioMet) return result;
  const yearsLeft = params.contractYearsRemaining ?? 0;
  if (yearsLeft < 1 || yearsLeft > 3) return result;
  const years = newContractYears(params.age);
  const wage = weeklyWageForSquadStatus(
    club,
    value,
    stayStatus ?? params.squadStatus ?? 'starter',
    params.clubLeague,
  );
  const renewal = {
    clubId: club.id,
    move: 'permanent' as const,
    fee: 0,
    weeklyWage: wage,
    contractYears: years,
    renewal: true,
    squadStatus: stayStatus,
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
    const bestPermTier = Math.min(
      ...next
        .filter((offer) => offer.move === 'permanent' && !offer.renewal)
        .map((offer) => getClub(offer.clubId)?.tier ?? 5),
      5,
    );
    const wantGiant =
      value > TRANSFER_MARKET_CAP ||
      age >= 32 ||
      (value >= ELITE_TRANSFER_VALUE_FLOOR && bestPermTier <= 2);
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
            fee: Math.min(fee, clubTransferBudget(saudi)),
            weeklyWage: twilightStarWage(value),
            contractYears: newContractYears(age),
            squadStatus: 'starter',
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
 * Forced sales, free transfers, loans, and expiring deals go through.
 * A starter with years left can have a short-fee peer bid vetoed — but
 * never the last remaining permanent offer, and never while the player
 * is already out on loan.
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
  /** Permanent bids still on the table after this one. 0 means this is the last. */
  remainingPermanentOffers?: number;
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
  if (params.offer.move === 'loan' || params.role === 'loan') {
    return { accepted: true, detail: '' };
  }
  if (params.offer.fee <= 0 || params.contractYearsLeft <= 1 || params.role === 'reserve') {
    return { accepted: true, detail: '' };
  }

  const feeLine = `€${Math.round(params.offer.fee / 1_000_000)}m bid`;

  if (params.squadStatus === 'impact') {
    return { accepted: true, detail: '' };
  }

  const asking = transferFeeFromValue(params.playerValue, params.contractYearsLeft);
  const meetsAsking = asking <= 0 || params.offer.fee + 1e-6 >= asking * MIN_ACCEPTED_FEE_RATIO;
  if (meetsAsking) {
    return { accepted: true, detail: '' };
  }
  return {
    accepted: false,
    detail: `You agreed terms with ${destName}. ${clubName} rejected the ${feeLine} — you are too expensive for that bid.`,
  };
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
    `Your best trial ratio was ${params.bestRatio.toFixed(2)}. ${band} clubs want to sign you as a Rising star on a ${FIRST_CONTRACT_YEARS}-year deal.`,
    clubs.map((club) => ({
      clubId: club.id,
      move: 'permanent' as const,
      fee: 0,
      weeklyWage: weeklyWageForSquadStatus(club, 0, 'rising-star'),
      contractYears: FIRST_CONTRACT_YEARS,
      squadStatus: 'rising-star' as const,
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
  const options = pickLoanClubsForMiss(
    params.ratio ?? 0,
    params.nationality,
    LOAN_OFFER_COUNT,
    [club.id],
    club.id,
  );
  if (options.length === 0) return null;
  return pendingFromOffers(
    'loan',
    `${club.name} have lined up a loan move for you. Hit their first-team ratio out on loan to earn a return.`,
    options.map((c) => ({
      clubId: c.id,
      move: 'loan' as const,
      fee: 0,
      weeklyWage: weeklyWageForSquadStatus(c, 0, 'starter', c.league),
      contractYears: 1,
      squadStatus: 'starter' as const,
    })),
    false,
  );
}

