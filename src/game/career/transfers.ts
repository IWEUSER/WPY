import { CLUBS, clubsInCountry, clubsInLeague, earnedPromotion, getClub, goalRatioFromStrength, promotionTarget, SECOND_DIVISIONS, secondDivisionOf, TIER_LABEL, type Club, type ClubTier } from './data/clubs';
import { leagueDisplayName } from './data/leagueFormat';
import {
  countryForNationality,
  filterOfferClubs,
  nearbyTierClubs,
  offerGeography,
  pickClubsBiasedToCountry,
  pickClubsForOfferWindow,
  tierPool,
} from './clubOffers';
import { careerLeagueAppearances, selectionRatioForNation } from './international';
import { shuffle } from './util';
import {
  clubTransferBudget,
  consecutiveSeasonsBelow,
  DEFAULT_CONTRACT_YEARS,
  FIRST_CONTRACT_YEARS,
  RESERVE_CONTRACT_YEARS,
  RESERVE_WEEKLY_WAGE,
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
  countedSeasonsCompleted,
  leagueAdjustedOfferRatio,
  recentAggregateRatio,
  weeklyWageForClub,
  weeklyWageForRatio,
  weeklyWageForSquadStatus,
  weeklyWageForTransferOffer,
  VALUE_POOR_RATIO,
} from './playerValue';
import { displaySeasonNumber, isFirstPublicSeason } from './seasonDisplay';
import {
  defaultSquadStatus,
  nextSquadStatusAfterSeason,
  openingSquadStatus,
  RISING_STAR_MIN_RATIO,
  isPeerClub,
  isStepDownClub,
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
 * Last-season or career ratio decides the club band. When last season is
 * hotter than the career average, last season wins — a 0.69 Espanyol year
 * is Strong even if the aggregate sits at 0.50. Paid elite bids still
 * need the €50m floor.
 */
export function seasonStandingRatio(season: SeasonRecord): number {
  const overall = season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
  const leagueGames = season.leagueGames ?? 0;
  const leagueGoals = season.leagueGoals ?? 0;
  const league = leagueGames > 0 ? leagueGoals / leagueGames : 0;
  return Math.max(overall, league);
}

/** Newest season that actually counts toward form, using league standing when it is hotter. */
export function lastFormStandingRatio(seasons: SeasonRecord[]): number | null {
  for (let i = seasons.length - 1; i >= 0; i--) {
    if (seasonCountsTowardForm(seasons[i])) return seasonStandingRatio(seasons[i]);
  }
  return null;
}

export function offerRatioPreferringLastSeason(last: number, career: number): number {
  return last > career ? last : Math.max(last, career);
}

/** Best transfer band the player's ratio has actually cleared. */
export function tierEarnedByRatio(ratio: number): ClubTier {
  let earned: ClubTier = 5;
  for (const club of CLUBS) {
    if (club.playable === false) continue;
    if (ratio + 1e-9 >= club.firstTeamGoalRatio && club.tier < earned) {
      earned = club.tier;
    }
  }
  return earned;
}

/**
 * A second-division season cannot unlock Strong or Elite first-division
 * clubs. 0.66 at Racing Ferrol is a Medium La Liga window, not Atlético.
 */
export const SECOND_DIVISION_BEST_OFFER_TIER: ClubTier = 4;

/** Saudi, MLS, and Liga MX never open Strong/Elite Europe. Portugal/Dutch/Turkey never Elite. */
export const SAUDI_BEST_OFFER_TIER: ClubTier = 3;
export const MLS_BEST_OFFER_TIER: ClubTier = 3;
export const LIGA_MX_BEST_OFFER_TIER: ClubTier = 3;
export const SEMI_EURO_BEST_OFFER_TIER: ClubTier = 2;

/** Strong England / Italy / Spain bids need a 20-league-game sample. */
export const STRONG_OFFER_MIN_LEAGUE_GAMES = 20;
/** Elite bids from any country need a 30-league-game sample. */
export const ELITE_OFFER_MIN_LEAGUE_GAMES = 30;

const BIG3_STRONG_COUNTRIES = new Set(['England', 'Italy', 'Spain']);

export function capTierForLeagueSample(tier: ClubTier, leagueGames?: number | null): ClubTier {
  if (leagueGames == null) return tier;
  if (leagueGames < ELITE_OFFER_MIN_LEAGUE_GAMES) {
    return Math.max(tier, 2) as ClubTier;
  }
  return tier;
}

export function clubAllowedByLeagueSample(club: Club, leagueGames?: number | null): boolean {
  if (leagueGames == null) return true;
  if (club.tier === 1 && leagueGames < ELITE_OFFER_MIN_LEAGUE_GAMES) return false;
  if (
    club.tier === 2
    && BIG3_STRONG_COUNTRIES.has(club.country)
    && leagueGames < STRONG_OFFER_MIN_LEAGUE_GAMES
  ) {
    return false;
  }
  return true;
}

export function offerRatioForLeague(ratio: number, fromLeague?: string | null): number {
  if (!fromLeague) return ratio;
  return leagueAdjustedOfferRatio(ratio, fromLeague);
}

export function capTierForSourceLeague(tier: ClubTier, fromLeague?: string | null): ClubTier {
  if (!fromLeague) return tier;
  if (SECOND_DIVISIONS.has(fromLeague)) {
    return Math.max(tier, SECOND_DIVISION_BEST_OFFER_TIER) as ClubTier;
  }
  if (fromLeague === 'Saudi Pro League') return Math.max(tier, SAUDI_BEST_OFFER_TIER) as ClubTier;
  if (fromLeague === 'MLS') return Math.max(tier, MLS_BEST_OFFER_TIER) as ClubTier;
  if (fromLeague === 'Liga MX' || fromLeague === 'Primera A' || fromLeague === 'J1 League') {
    return Math.max(tier, LIGA_MX_BEST_OFFER_TIER) as ClubTier;
  }
  if (fromLeague === 'Brasileirao' || fromLeague === 'Liga Profesional') {
    return Math.max(tier, SEMI_EURO_BEST_OFFER_TIER) as ClubTier;
  }
  if (fromLeague === 'Primeira Liga' || fromLeague === 'Eredivisie' || fromLeague === 'Super Lig') {
    return Math.max(tier, SEMI_EURO_BEST_OFFER_TIER) as ClubTier;
  }
  return tier;
}

export function capTierForSecondDivision(tier: ClubTier, fromLeague?: string | null): ClubTier {
  return capTierForSourceLeague(tier, fromLeague);
}

/** Weakest Elite club bar — United / Tottenham sit here after strength mapping. */
export function eliteOfferBar(): number {
  return goalRatioFromStrength(88);
}

/** Elite bids need last season AND recent form at that bar — not caps, not a hotter of two numbers. */
export function scoringClearsElite(params: {
  lastRatio: number;
  careerRatio: number;
  aggregateRatio?: number | null;
}): boolean {
  const bar = eliteOfferBar();
  const form = params.aggregateRatio ?? params.careerRatio;
  return params.lastRatio + 1e-9 >= bar && form + 1e-9 >= bar;
}

export function offerTierFromStanding(params: {
  ratio?: number;
  careerRatio: number;
  marketValue?: number;
  currentTier?: ClubTier;
  blockElite?: boolean;
  fee?: number;
  internationalsPlayed?: number;
  nationId?: string | null;
  originStatus?: SquadStatus;
  fromLeague?: string | null;
  leagueGames?: number | null;
  aggregateRatio?: number | null;
}): ClubTier {
  const last = params.ratio ?? 0;
  const career = params.careerRatio ?? 0;
  let best = offerRatioPreferringLastSeason(last, career);
  if ((params.internationalsPlayed ?? 0) > 0 && params.nationId) {
    const nation = selectionRatioForNation(params.nationId);
    best = Math.max(best, Math.min(nation, eliteOfferBar() - 0.01));
  }
  best = offerRatioForLeague(best, params.fromLeague);
  let tier = capTierForSourceLeague(tierEarnedByRatio(best), params.fromLeague);
  if (params.originStatus === 'reserve' && params.currentTier) {
    tier = Math.max(tier, params.currentTier) as ClubTier;
  }
  if (
    params.blockElite
    || !scoringClearsElite({
      lastRatio: last,
      careerRatio: career,
      aggregateRatio: params.aggregateRatio,
    })
  ) {
    tier = Math.max(tier, 2) as ClubTier;
  }
  const paid = (params.fee ?? 1) > 0;
  if (paid && (params.marketValue ?? Number.POSITIVE_INFINITY) < ELITE_TRANSFER_VALUE_FLOOR) {
    tier = Math.max(tier, 2) as ClubTier;
  }
  return capTierForLeagueSample(tier, params.leagueGames);
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
  hostCountry?: string | null,
): Club[] {
  const preferred = filterOfferClubs(withoutSaudi(tierPool(tier, excludeIds)), nationality, hostCountry);
  const country = homeCountry ?? countryForNationality(nationality);
  const extraHome = filterOfferClubs(withoutSaudi(sameTierInCountry(tier, country, excludeIds)), nationality, hostCountry);
  if (hostCountry || country) {
    return withoutSaudi(pickClubsForOfferWindow(preferred, count, hostCountry ?? country, country, extraHome));
  }
  const minHome = country && extraHome.length > 0 ? Math.min(minFromCountry, count) : 0;
  return withoutSaudi(pickClubsBiasedToCountry(preferred, count, country, minHome, extraHome));
}

export const LOAN_OFFER_COUNT = 3;
export const TRANSFER_OFFER_COUNT = 6;
function takeCountryLoans(
  pool: Club[],
  country: string | null | undefined,
  count: number,
  seen: Set<string>,
): Club[] {
  if (!country || count <= 0) return [];
  return takeShuffled(pool.filter((club) => club.country === country), count, seen);
}

/** Two loans from the host league country; if abroad, the leftover from nationality. */
function withGeographicLoanBias(
  qualityPool: Club[],
  nationality: string | null | undefined,
  count: number,
  excludeIds: string[],
  extraFill: Club[] = [],
  lastFill: Club[] = [],
  hostCountry?: string | null,
): Club[] {
  const home = countryForNationality(nationality);
  const geo = offerGeography(hostCountry ?? home, home);
  const seen = new Set<string>(excludeIds.filter(Boolean));
  const picked: Club[] = [];
  const pools = [qualityPool, extraFill, lastFill];
  const take = (country: string | null, wanted: number) => {
    if (!country || wanted <= 0) return;
    for (const pool of pools) {
      if (picked.length >= count || wanted <= 0) break;
      const extra = takeCountryLoans(pool, country, wanted, seen);
      picked.push(...extra);
      wanted -= extra.length;
    }
  };
  take(geo.atHome ? geo.home : geo.host, geo.loanFromHost);
  if (!geo.atHome) take(geo.home, geo.loanFromHome);
  for (const pool of pools) {
    picked.push(...takeShuffled(pool, count - picked.length, seen));
  }
  return picked.slice(0, count);
}

export function isSaudiClub(club: Club | undefined | null): boolean {
  return Boolean(club && (club.league === 'Saudi Pro League' || club.country === 'Saudi Arabia'));
}

function withoutSaudi(clubs: Club[]): Club[] {
  return clubs.filter((club) => !isSaudiClub(club));
}

function lastNonPriorityIndex(clubs: Club[], home?: string | null, host?: string | null): number {
  for (let i = clubs.length - 1; i >= 0; i--) {
    const country = clubs[i]?.country;
    if (country !== home && country !== host) return i;
  }
  return clubs.length - 1;
}

/** At most one Saudi bid, and never before age 20. */
function attachOneSaudiOffer(
  picked: Club[],
  qualityTier: ClubTier,
  excludeIds: string[],
  age: number,
  homeCountry?: string | null,
  hostCountry?: string | null,
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
  const saudi = shuffle(sameTier)[0]
    ?? (qualityTier <= 3 ? giants[0] : undefined)
    ?? giants.find((club) => club.tier === qualityTier)
    ?? giants[0];
  if (!saudi) {
    return without;
  }
  if (without.some((club) => club.id === saudi.id)) {
    return without.slice(0, TRANSFER_OFFER_COUNT);
  }
  if (without.length >= TRANSFER_OFFER_COUNT) {
    const next = without.slice(0, TRANSFER_OFFER_COUNT);
    const replaceAt = lastNonPriorityIndex(next, homeCountry, hostCountry);
    if (replaceAt >= 0) next[replaceAt] = saudi;
    return next;
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

function withStepDownStarterClubs(
  origin: Club | undefined,
  status: SquadStatus | undefined,
  excludeIds: string[],
  count = 3,
): Club[] {
  if (!origin || !status || status === 'starter') return [];
  return pickStepDownStarterClubs(origin, excludeIds, count);
}

/** Permanent bids stay at six. Keep most market transfers; step-down only fills the last slots. */
function clubsForPermanentOffers(transfers: Club[], _stepDown: Club[] = []): Club[] {
  const seen = new Set<string>();
  const out: Club[] = [];
  for (const club of transfers) {
    if (out.length >= TRANSFER_OFFER_COUNT) break;
    if (seen.has(club.id)) continue;
    seen.add(club.id);
    out.push(club);
  }
  return out;
}

function pickStepDownStarterClubs(origin: Club, excludeIds: string[], count = 3): Club[] {
  const seen = new Set(excludeIds);
  const homeSecond = !SECOND_DIVISIONS.has(origin.league)
    ? withoutSaudi(CLUBS.filter(
        (c) =>
          c.playable !== false
          && SECOND_DIVISIONS.has(c.league)
          && c.country === origin.country
          && !seen.has(c.id),
      ))
    : [];
  const weakerSameLeague = withoutSaudi(clubsInLeague(origin.league).filter(
    (c) => c.playable !== false && c.tier > origin.tier && !seen.has(c.id),
  ));
  const picked = [
    ...takeShuffled(weakerSameLeague, Math.min(2, count), seen),
    ...takeShuffled(homeSecond, count, seen),
  ];
  return picked.slice(0, count);
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
      c.tier >= 4 &&
      leagueValueWeight(c.league) + 1e-9 >= MLS_LOAN_FLOOR_WEIGHT &&
      c.country !== originCountry,
  );
}

/**
 * Rising-star (0.33+) loans follow the origin club, not the destination
 * first-team bar. Elite/Strong top-flight sides send the player to the next
 * bands down in the same division (Strong and Mid-table from Elite, Mid-table
 * from Strong) — not Medium or the Championship. Medium-or-lower top-flight
 * sides send them to the domestic second division; a second-division origin
 * loans to Medium and Lower clubs in a weaker country's top flight, with MLS
 * as the floor. Strong Portugal / Dutch / Turkish sides are never in that
 * away pool.
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
  const inBand = (minTier: ClubTier, maxTier: ClubTier) =>
    clubsInLeague(fromLeague).filter(
      (c) => isPlayableLoanClub(c, exclude) && c.tier >= minTier && c.tier <= maxTier,
    );
  const otherTopFlightBand = (minTier: ClubTier, maxTier: ClubTier) =>
    CLUBS.filter(
      (c) =>
        isPlayableLoanClub(c, exclude) &&
        TOP_LEAGUES.has(c.league) &&
        c.league !== fromLeague &&
        c.tier >= minTier &&
        c.tier <= maxTier,
    );
  const floorAway = () => lowerLeagueCountryPool(fromClub.country, exclude);
  const mls = clubsInLeague('MLS').filter((c) => isPlayableLoanClub(c, exclude));

  let quality: Club[] = [];
  let extra: Club[] = [];
  if (SECOND_DIVISIONS.has(fromLeague)) {
    quality = floorAway();
    extra = mls;
  } else if (TOP_LEAGUES.has(fromLeague) && eliteOrStrong) {
    const minTier = Math.min(5, fromClub.tier + 1) as ClubTier;
    const maxTier = 3 as ClubTier;
    quality = inBand(minTier, maxTier);
    extra = otherTopFlightBand(minTier, maxTier);
  } else if (TOP_LEAGUES.has(fromLeague)) {
    const second = secondDivisionOf(fromLeague);
    quality = second
      ? clubsInLeague(second).filter((c) => c.country === fromClub.country && isPlayableLoanClub(c, exclude))
      : [];
    extra = CLUBS.filter((c) => SECOND_DIVISIONS.has(c.league) && isPlayableLoanClub(c, exclude));
  } else if (eliteOrStrong) {
    const minTier = Math.min(5, fromClub.tier + 1) as ClubTier;
    quality = inBand(minTier, 3);
    extra = [...floorAway().filter((c) => c.tier >= minTier && c.tier <= 3), ...mls];
  } else {
    quality = floorAway();
    extra = mls;
  }
  return withGeographicLoanBias(
    filterOfferClubs(withoutSaudi(quality), nationality, fromClub.country),
    nationality,
    count,
    exclude,
    filterOfferClubs(withoutSaudi(extra), nationality, fromClub.country),
    [],
    fromClub.country,
  );
}

function pickStrongLoanClubs(
  fromClub: Club,
  nationality: string | null | undefined,
  excludeIds: string[],
  _qualityTier: ClubTier,
): Club[] {
  const exclude = [...excludeIds.filter(Boolean), fromClub.id];
  const host = fromClub.country;
  const pool = filterOfferClubs(
    withoutSaudi(tierPool(2, exclude).filter((club) => !SECOND_DIVISIONS.has(club.league))),
    nationality,
    host,
  );
  return withGeographicLoanBias(pool, nationality, LOAN_OFFER_COUNT, exclude, [], [], host);
}

function pickSeasonLoanClubs(
  lastRatio: number,
  formRatio: number,
  nationality: string | null | undefined,
  excludeIds: string[],
  fromClub: Club | undefined,
  extras: LoanPickExtras = {},
): Club[] {
  const valuable = (extras.marketValue ?? 0) >= 28_000_000;
  const eliteOrigin = Boolean(fromClub && fromClub.tier <= 2);
  if (fromClub && (eliteOrigin || valuable) && lastRatio + 1e-9 < RISING_STAR_MIN_RATIO && !extras.honoursOverride) {
    return pickStrongLoanClubs(fromClub, nationality, excludeIds, extras.qualityTier ?? 2);
  }
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

/** Season 1 and 2 always need a loan list — never fall through to a forced sale. */
function guaranteedLoanClubs(
  lastRatio: number,
  formRatio: number,
  nationality: string | null | undefined,
  excludeIds: string[],
  fromClub: Club,
  extras: LoanPickExtras = {},
): Club[] {
  const picked = pickSeasonLoanClubs(lastRatio, formRatio, nationality, excludeIds, fromClub, extras);
  if (picked.length >= LOAN_OFFER_COUNT) return picked.slice(0, LOAN_OFFER_COUNT);
  const seen = new Set<string>([...excludeIds.filter(Boolean), fromClub.id, ...picked.map((club) => club.id)]);
  const fill = [
    ...pickLoanClubsFromOrigin(fromClub, LOAN_OFFER_COUNT, [...seen], nationality),
    ...pickLoanClubsForMiss(formRatio, nationality, LOAN_OFFER_COUNT, [...seen], fromClub.id, extras),
    ...withoutSaudi(CLUBS.filter((club) => club.playable !== false && !seen.has(club.id))),
  ];
  for (const club of fill) {
    if (picked.length >= LOAN_OFFER_COUNT) break;
    if (seen.has(club.id)) continue;
    seen.add(club.id);
    picked.push(club);
  }
  return picked.slice(0, LOAN_OFFER_COUNT);
}

/** Who bids follows last-season or career ratio; value only enforces the elite floor. */
export function transferOfferTier(params: {
  marketValue: number;
  lastRatio?: number;
  careerRatio?: number;
  blockElite?: boolean;
  fee?: number;
  internationalsPlayed?: number;
  nationId?: string | null;
  originStatus?: SquadStatus;
  currentTier?: ClubTier;
  fromLeague?: string | null;
  leagueGames?: number | null;
  aggregateRatio?: number | null;
}): ClubTier {
  return offerTierFromStanding({
    ratio: params.lastRatio,
    careerRatio: params.careerRatio ?? 0,
    marketValue: params.marketValue,
    blockElite: params.blockElite,
    fee: params.fee,
    internationalsPlayed: params.internationalsPlayed,
    nationId: params.nationId,
    originStatus: params.originStatus,
    currentTier: params.currentTier,
    fromLeague: params.fromLeague,
    leagueGames: params.leagueGames,
    aggregateRatio: params.aggregateRatio,
  });
}

export interface LoanPickExtras {
  marketValue?: number;
  honoursOverride?: boolean;
  consecutivePoor?: number;
  qualityTier?: ClubTier;
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
  const sameLeagueAll = parentLeague
    ? withoutSaudi(CLUBS.filter(
        (c) =>
          c.playable !== false &&
          c.league === parentLeague &&
          !exclude.includes(c.id),
      ))
    : [];
  const otherTopFlight = withoutSaudi(CLUBS.filter(
    (c) =>
      c.playable !== false &&
      !SECOND_DIVISIONS.has(c.league) &&
      c.league !== parentLeague &&
      !exclude.includes(c.id) &&
      canLoanToSameDivision(effectiveRatio, c) &&
      (parent == null || c.tier >= parent.tier),
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

  const quality = parentAlreadySecond
    ? (sameDivision.length > 0 ? sameDivision : sameLeagueAll)
    : sameDivision.length > 0 ? sameDivision : otherTopFlight;
  const extra = parentAlreadySecond
    ? lowerLeagueCountryPool(parentCountry ?? '', exclude)
    : sameDivision.length > 0 ? otherTopFlight : [];
  const last = [...homeSecond, ...natSecond, ...worldSecond];
  const host = parentCountry;
  return withGeographicLoanBias(
    filterOfferClubs(quality, nationality, host),
    nationality,
    count,
    exclude,
    filterOfferClubs(extra, nationality, host),
    filterOfferClubs(last, nationality, host),
    host,
  );
}

function canPayFee(club: Club, fee: number): boolean {
  return fee <= 0 || clubTransferBudget(club) >= fee * MIN_ACCEPTED_FEE_RATIO;
}

function clubsInConsistentBand(
  tier: ClubTier,
  fromLeague?: string | null,
  excludeIds: string[] = [],
  leagueGames?: number | null,
): Club[] {
  return withoutSaudi(tierPool(tier, excludeIds).filter((club) => {
    if (!clubAllowedByLeagueSample(club, leagueGames)) return false;
    if (!fromLeague) return true;
    if (SECOND_DIVISIONS.has(fromLeague)) return club.league === fromLeague;
    return !SECOND_DIVISIONS.has(club.league);
  }));
}

/**
 * Second-division windows stay in that pyramid: the same second division
 * and its promotion-target top flight, at Medium or below. Never fill
 * Strong/Elite sides from other countries.
 */
function pickSecondDivisionClubs(
  fromLeague: string,
  _fee: number,
  excludeIds: string[],
  _marketValue: number,
  _blockElite: boolean,
  qualityTier: ClubTier,
): Club[] {
  const band = capTierForSourceLeague(qualityTier, fromLeague);
  const seen = new Set<string>(excludeIds);
  const sameExact = withoutSaudi(clubsInLeague(fromLeague).filter(
    (c) => !seen.has(c.id) && c.playable !== false && c.tier === band,
  ));
  const higherLeague = promotionTarget(fromLeague);
  const higherAtBand = higherLeague
    ? withoutSaudi(clubsInLeague(higherLeague).filter(
        (c) => !seen.has(c.id) && c.playable !== false && c.tier === band,
      ))
    : [];
  const picked: Club[] = [];
  const add = (pool: Club[], n: number) => {
    picked.push(...takeShuffled(pool, Math.max(0, n), seen));
  };
  add(higherAtBand, TRANSFER_OFFER_COUNT);
  add(sameExact, TRANSFER_OFFER_COUNT - picked.length);
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
  leagueGames?: number | null,
  hostCountry?: string | null,
): Club[] {
  if (fee > 0 && qualityTier === 1 && (marketValue ?? 0) < ELITE_TRANSFER_VALUE_FLOOR) {
    qualityTier = 2;
  }
  qualityTier = capTierForLeagueSample(qualityTier, leagueGames);
  if (fromLeague && SECOND_DIVISIONS.has(fromLeague)) {
    qualityTier = capTierForSourceLeague(qualityTier, fromLeague);
    const local = pickSecondDivisionClubs(
      fromLeague,
      fee,
      excludeIds,
      marketValue ?? 0,
      blockElite,
      qualityTier,
    ).filter((club) => clubAllowedByLeagueSample(club, leagueGames));
    if (local.length > 0) {
      return attachOneSaudiOffer(
        local.slice(0, TRANSFER_OFFER_COUNT),
        qualityTier,
        excludeIds,
        age,
        countryForNationality(nationality),
        hostCountry,
      );
    }
  }
  const country = countryForNationality(nationality);
  const regionFilter = (clubs: Club[]) => filterOfferClubs(clubs, nationality, hostCountry);
  if (fee <= 0) {
    const free = regionFilter(clubsInConsistentBand(qualityTier, fromLeague, excludeIds, leagueGames));
    const picked = free.length >= TRANSFER_OFFER_COUNT
      ? pickClubsForOfferWindow(free, TRANSFER_OFFER_COUNT, hostCountry ?? country, country)
      : pickClubsFromTier(qualityTier, TRANSFER_OFFER_COUNT, excludeIds, nationality, 1, country, hostCountry)
        .filter((club) => clubAllowedByLeagueSample(club, leagueGames));
    return attachOneSaudiOffer(picked, qualityTier, excludeIds, age, country, hostCountry);
  }
  const band = (tier: ClubTier) => regionFilter(clubsInConsistentBand(tier, fromLeague, excludeIds, leagueGames));
  const affordable = (tier: ClubTier) => band(tier).filter((c) => canPayFee(c, fee));
  const allIn = (tier: ClubTier) => band(tier);
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
  // Stay inside this band. Under-budget same-tier bids still list when
  // the window is not elite-paid — never fill from a different tier.
  if (pool.length < TRANSFER_OFFER_COUNT && qualityTier > 1) {
    pool = fillFrom(pool, allIn(qualityTier), TRANSFER_OFFER_COUNT);
  }
  if (fee <= 0 && pool.length < TRANSFER_OFFER_COUNT) {
    pool = fillFrom(pool, allIn(qualityTier), TRANSFER_OFFER_COUNT);
  }
  if (pool.length < TRANSFER_OFFER_COUNT && qualityTier === 1) {
    const seen = new Set(pool.map((club) => club.id));
    for (const club of withoutSaudi(tierPool(1, excludeIds))) {
      if (seen.has(club.id) || !clubAllowedByLeagueSample(club, leagueGames) || (fee > 0 && !canPayFee(club, fee))) continue;
      pool.push(club);
      if (pool.length >= TRANSFER_OFFER_COUNT) break;
    }
  }
  if (pool.length === 0) {
    return attachOneSaudiOffer([], qualityTier, excludeIds, age, country, hostCountry);
  }
  const extraHome = qualityTier === 1 && fee > 0
    ? affordable(qualityTier)
    : regionFilter(clubsInConsistentBand(qualityTier, fromLeague, excludeIds, leagueGames));
  const allowed = new Set([...pool, ...extraHome].map((club) => club.id));
  const picked = pickClubsForOfferWindow(
    pool,
    Math.min(TRANSFER_OFFER_COUNT, pool.length),
    hostCountry ?? country,
    country,
    extraHome,
  ).filter((club) => allowed.has(club.id));
  fillFrom(picked, pool, TRANSFER_OFFER_COUNT);
  fillFrom(picked, extraHome, TRANSFER_OFFER_COUNT);
  return attachOneSaudiOffer(picked, qualityTier, excludeIds, age, country, hostCountry);
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
  lastSeasonRatio?: number;
  countedSeasons?: number;
  /** Goals/game across the last five counted seasons. */
  aggregateRatio?: number;
  consecutivePoor?: number;
  allowRisingStar?: boolean;
  originStatus?: SquadStatus;
  /** Role the current club would keep you in if you stay. */
  nextIfStay?: SquadStatus;
  leagueGames?: number;
  /** Elite / high-value misses loan as starters at Strong clubs. */
  forceStarterLoan?: boolean;
}

function loanSquadStatus(club: Club, extras?: OfferTermExtras): SquadStatus {
  if (extras?.forceStarterLoan) return 'starter';
  if (isPeerClub(extras?.originClub, club)) {
    if (extras?.allowRisingStar === false) {
      const stay = extras.nextIfStay ?? extras.originStatus ?? 'reserve';
      return stay === 'rising-star' || stay === 'impact' ? 'reserve' : stay;
    }
    return 'rising-star';
  }
  return 'starter';
}

/** Starters who hit the first-team bar do not see loans. Impact and Rising star still do. */
function shouldOfferLoans(params: {
  ratioMet: boolean;
  status: SquadStatus;
  openingWindow?: boolean;
  ratio?: number;
}): boolean {
  if (params.status !== 'starter') return true;
  if (params.openingWindow && (params.ratio ?? 0) + 1e-9 < RISING_STAR_MIN_RATIO) return true;
  return !params.ratioMet;
}

function destinationSquadStatus(
  club: Club,
  extras?: OfferTermExtras,
): SquadStatus {
  const origin = extras?.originClub;
  const last = extras?.lastSeasonRatio;
  const career = extras?.playerRatio;
  const ratio = Math.max(last ?? 0, career ?? 0);
  const stayStatus = extras?.nextIfStay ?? extras?.originStatus;
  if (
    stayStatus
    && stayStatus !== 'starter'
    && isStepDownClub(origin, club)
  ) {
    return 'starter';
  }
  if (stayStatus && isPeerClub(origin, club)) {
    return stayStatus;
  }
  // Same quality band, same role — do not mix Starter and Reserve across
  // Mid-table or Medium clubs that happen to have slightly different bars.
  if (ratio > 0) {
    if (tierForRatio(ratio) <= club.tier) return 'starter';
    if (extras?.allowRisingStar !== false && ratio >= RISING_STAR_MIN_RATIO) return 'rising-star';
    return 'reserve';
  }
  return squadStatusOnArrival({
    fromClub: origin ?? null,
    toClub: club,
    move: 'permanent',
    nextIfStay: extras?.nextIfStay ?? 'starter',
    playerRatio: extras?.playerRatio,
    allowRisingStar: extras?.allowRisingStar !== false,
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
  return clubs.map((club) => {
    if (move === 'loan') {
      const status = loanSquadStatus(club, extras);
      return {
        clubId: club.id,
        move,
        fee: 0,
        weeklyWage: weeklyWageForTransferOffer(
          club,
          value,
          extras?.lastSeasonRatio ?? extras?.playerRatio,
          extras?.countedSeasons ?? 0,
          status,
          club.league,
          extras?.aggregateRatio ?? extras?.playerRatio,
          extras?.consecutivePoor ?? 0,
        ),
        contractYears: 1,
        squadStatus: status,
      };
    }
    const status = destinationSquadStatus(club, extras);
    const years = status === 'reserve' ? RESERVE_CONTRACT_YEARS : newContractYears(age);
    return {
      clubId: club.id,
      move,
      fee: Math.min(fee, clubTransferBudget(club)),
      weeklyWage: weeklyWageForTransferOffer(
        club,
        value,
        extras?.lastSeasonRatio ?? extras?.playerRatio,
        extras?.countedSeasons ?? 0,
        status,
        club.league,
        extras?.aggregateRatio ?? extras?.playerRatio,
        extras?.consecutivePoor ?? 0,
      ),
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
  const originClub = (parentClubId ? getClub(parentClubId) : undefined)
    ?? extras?.originClub
    ?? (excludeIds[0] ? getClub(excludeIds[0]) : undefined);
  const transfers = pickPermanentClubs(
    preferredTier,
    fee,
    excludeIds,
    nationality,
    blockElite,
    fromLeague,
    value,
    age,
    extras?.leagueGames,
    originClub?.country,
  );
  const stepDown = withStepDownStarterClubs(
    originClub,
    extras?.originStatus,
    [...excludeIds, ...transfers.map((c) => c.id)],
  );
  const loans = includeLoans
    ? pickSeasonLoanClubs(
        lastRatio,
        loanRatio,
        nationality,
        excludeIds,
        originClub,
        { marketValue: value, honoursOverride: loanHonours, qualityTier: preferredTier },
      )
    : [];
  const offers = withTwilightMlsOffers(
    [
      ...offerTerms(loans, 'loan', value, 0, age, loanYears, extras),
      ...offerTerms(clubsForPermanentOffers(transfers, stepDown), 'permanent', value, fee, age, permYears, extras),
    ],
    age,
    value,
    fee,
    excludeIds,
    countryForNationality(nationality),
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
  const lastStanding = lastFormStandingRatio([...(params.seasonHistory ?? []), season])
    ?? seasonStandingRatio(season);
  const yearsLeft = params.contractYearsRemaining ?? DEFAULT_CONTRACT_YEARS;
  const parentYears = params.homeContractYearsRemaining;
  const seasons = [...(params.seasonHistory ?? []), season];
  const formRatio = offerFormRatio({ lastSeason: season, careerGoals, careerGames });
  const value = playerValueFromParams(params, role === 'loan' ? getClub(parentClubId) ?? club : club);
  const feeYears = role === 'loan' && parentYears != null && parentYears > 0 ? parentYears : yearsLeft;
  const fee = transferFeeFromValue(value, feeYears);
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
  const firstPublic = isFirstPublicSeason(season.seasonNumber, {
    role,
    careerStart: params.careerStart,
  });
  const secondPublic = publicSeason === 2;
  const openingContractWindow = firstPublic || secondPublic;
  const contractExpiring = yearsLeft <= 1;
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
  const seasonsDone = countedSeasonsCompleted(seasons);
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
      const nextStatus = stay.squadStatus ?? currentStatus;
      const currentPay = params.weeklyWage ?? 0;
      if (nextStatus === 'starter' && (currentStatus !== 'starter' || currentPay <= RESERVE_WEEKLY_WAGE)) {
        const starterWage = weeklyWageForTransferOffer(
          club,
          value,
          ratio,
          seasonsDone,
          'starter',
          nextLeague,
          recentAggregateRatio(seasons),
        );
        stay.weeklyWage = Math.max(currentPay, starterWage);
      } else {
        stay.weeklyWage = params.weeklyWage;
      }
    }
    return stay;
  };
  const withTwilight = (offers: ClubOfferTerms[]) =>
    withTwilightMlsOffers(
      offers,
      age,
      value,
      fee,
      [club.id, parentClubId],
      countryForNationality(nationality),
    );
  const permYears = newContractYears(age);
  const loanYears = 1;
  const careerRatio = careerGames > 0 ? careerGoals / careerGames : ratio;
  const internationalsPlayed = seasons.reduce(
    (n, s) => n + (s.international?.qualifyingGames ?? 0) + (s.international?.finalsGames ?? 0),
    0,
  );
  const leagueSample = careerLeagueAppearances(seasons) || careerGames;
  const transferTier = transferOfferTier({
    marketValue: value,
    lastRatio: lastStanding,
    careerRatio,
    blockElite,
    fee,
    internationalsPlayed,
    nationId: nationality,
    originStatus: currentStatus,
    currentTier: club.tier,
    fromLeague: currentLeague,
    leagueGames: leagueSample,
    aggregateRatio: recentAggregateRatio(seasons),
  });
  const loanPick = (exclude: string[], origin: Club) =>
    (openingContractWindow ? guaranteedLoanClubs : pickSeasonLoanClubs)(
      ratio,
      formRatio,
      nationality,
      exclude,
      origin,
      {
        marketValue: value,
        honoursOverride: honoursClear,
        consecutivePoor: consecutiveSeasonsBelow(seasons, VALUE_POOR_RATIO),
        qualityTier: transferTier,
      },
    );
  const feeAllowsLoans = fee > 0;
  const canOfferLoans = openingContractWindow || feeAllowsLoans;
  const offerExtras: OfferTermExtras = {
    currentWeeklyWage: params.weeklyWage,
    originClub: club,
    playerRatio: careerGames > 0 ? careerGoals / careerGames : undefined,
    lastSeasonRatio: lastStanding,
    countedSeasons: seasonsDone,
    aggregateRatio: recentAggregateRatio(seasons) ?? undefined,
    allowRisingStar,
    originStatus: currentStatus,
    nextIfStay,
    leagueGames: leagueSample,
    consecutivePoor: consecutiveSeasonsBelow(seasons, VALUE_POOR_RATIO),
    forceStarterLoan:
      (club.tier <= 2 || value >= 28_000_000) && ratio + 1e-9 < RISING_STAR_MIN_RATIO && !honoursClear,
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
          weeklyWage: weeklyWageForRatio(club, value, ratio, openingSquadStatus('first-team')),
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
        options.map((c) => {
          const status = loanSquadStatus(c, { originClub: club, originStatus: currentStatus, nextIfStay });
          return {
            clubId: c.id,
            move: 'loan' as const,
            fee: 0,
            weeklyWage: weeklyWageForTransferOffer(c, value, ratio, seasonsDone, status, c.league, recentAggregateRatio(seasons)),
            contractYears: 1,
            squadStatus: status,
          };
        }),
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
          weeklyWage: weeklyWageForRatio(parentClub, value, ratio, recallStatus, parentClub.league),
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
    const transfers = pickPermanentClubs(transferTier, fee, exclude, nationality, blockElite, club.league, value, age, leagueSample, club.country);
    const canLoanAgain = canOfferLoans && loansUsed < MAX_CONSECUTIVE_LOANS;
    const loans = canLoanAgain
      ? loanPick(exclude, parentClub ?? club)
      : [];
    const stepDown = withStepDownStarterClubs(
      club,
      currentStatus,
      [...exclude, ...transfers.map((c) => c.id)],
    );
    const offers = withTwilight([
      ...offerTerms(loans, 'loan', value, 0, age, loanYears, offerExtras),
      ...offerTerms(clubsForPermanentOffers(transfers, stepDown), 'permanent', value, fee, age, permYears, offerExtras),
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
    const parentName = parentClub?.name ?? 'Your parent club';
    return {
      headline: loansUsed >= MAX_CONSECUTIVE_LOANS
        ? 'Two consecutive loans - you are being sold'
        : fee <= 0
          ? `${parentName} will not review your contract`
          : `${parentName} are selling you`,
      detail: loansUsed >= MAX_CONSECUTIVE_LOANS
        ? `${parentName} will not send you on a third consecutive loan. They are selling you.`
        : fee <= 0
          ? `${parentName} will not bring you back into the first team. You are now a free agent.`
          : `${parentName} will not bring you back into the first team.`,
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
  const graceActive = seasonsAtCurrentClub === 0 && !firstPublic;
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
      `${club.name} have been promoted to the ${leagueDisplayName(nextLeague)}!`,
      `Finished ${params.leaguePosition}${params.leaguePosition === 1 ? 'st' : 'nd'} in ${leagueDisplayName(currentLeague)}. Stay and play in the ${leagueDisplayName(nextLeague)} next season.`,
      stayOn({
        weeklyWage: weeklyWageForRatio(club, value, ratio, nextIfStay, nextLeague),
      }),
      value,
      fee,
      nationality,
      [club.id],
      transferTier,
      canOfferLoans && shouldOfferLoans({
        ratioMet,
        status: currentStatus,
        openingWindow: openingContractWindow,
        ratio,
      }),
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
    const transfers = pickPermanentClubs(transferTier, fee, [club.id], nationality, blockElite, currentLeague, value, age, leagueSample, club.country);
    const stepDown = withStepDownStarterClubs(
      club,
      currentStatus,
      [club.id, ...transfers.map((c) => c.id)],
    );
    const loans = shouldOfferLoans({
      ratioMet,
      status: currentStatus,
      openingWindow: true,
      ratio,
    })
      ? loanPick([club.id], club)
      : [];
    const offers = withTwilight([
      ...offerTerms(loans, 'loan', value, 0, age, loanYears, offerExtras),
      ...offerTerms(clubsForPermanentOffers(transfers, stepDown), 'permanent', value, fee, age, permYears, offerExtras),
    ]);
    const missedYouthBar = !honoursClear && ratio + 1e-9 < RISING_STAR_MIN_RATIO;
    if (missedYouthBar) {
      const stay = stayOn({ squadStatus: firstSeasonStayStatus });
      return {
        headline: 'Stay, or take a loan',
        detail: `${ratio.toFixed(2)} goals/game was below the ${RISING_STAR_MIN_RATIO.toFixed(2)} Rising star line. Season 2 can still be at ${club.name} as a Rising star, or take a loan for first-team minutes. A transfer is not required.`,
        pendingTransfer: pendingFromOffers(
          'loan-or-transfer',
          'A loan is always available after Season 1. Stay on the current deal, take a loan, or move.',
          offers,
          true,
          stay,
        ),
      };
    }
    const stay = stayOn({ squadStatus: firstSeasonStayStatus });
    const honoursOnly = honoursClear && !(season.gamesPlayed > 0 && ratio + 1e-9 >= threshold);
    const stayLabel = SQUAD_STATUS_LABEL[firstSeasonStayStatus];
    const headline = ratioMet
      ? honoursOnly
        ? 'Honours overrode the finishing ratio'
        : 'Place secured'
      : `Stay as ${stayLabel === 'Impact' ? 'an Impact player' : `a ${stayLabel}`} — or move on`;
    const detail = ratioMet
      ? honoursOnly
        ? `Top goalscorer or player of the league/tournament this season counted as meeting ${club.name}'s ${threshold.toFixed(2)} bar.`
        : `You maintained ${threshold.toFixed(2)} goals/game at ${club.name}.`
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
    const transfers = pickPermanentClubs(transferTier, fee, [club.id], nationality, blockElite, currentLeague, value, age, leagueSample, club.country);
    const includeOpeningLoans = openingContractWindow && !contractExpiring;
    const canLoan = includeOpeningLoans || (canOfferLoans && loansUsed < MAX_CONSECUTIVE_LOANS && !contractExpiring);
    const loans = canLoan ? loanPick([club.id], club) : [];
    const stepDown = withStepDownStarterClubs(
      club,
      currentStatus,
      [club.id, ...transfers.map((c) => c.id)],
    );
    const offers = withTwilight([
      ...offerTerms(loans, 'loan', value, 0, age, loanYears, offerExtras),
      ...offerTerms(clubsForPermanentOffers(transfers, stepDown), 'permanent', value, fee, age, permYears, offerExtras),
    ]);
    if (includeOpeningLoans && firstPublic && loans.length > 0) {
      return {
        headline: `Stay at ${club.name}, or take a loan`,
        detail: `Your ratio slipped to ${ratio.toFixed(2)} goals/game, below the ${threshold.toFixed(2)} they expect. A loan keeps ${club.name} as your parent club. You can also stay on the years left on your deal — a transfer is not required until the contract expires.`,
        pendingTransfer: pendingFromOffers(
          'loan-or-transfer',
          'Loan destinations follow the club you are leaving. Permanent fees follow your market value. You can stay.',
          offers,
          true,
          stayOn(),
        ),
      };
    }
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
      headline: contractExpiring
        ? `${club.name} will not offer a new contract`
        : `${club.name} have put you up for sale`,
      detail: contractExpiring
        ? `Your deal is up and ${club.name} have not tabled a new contract after ${ratio.toFixed(2)} goals/game, below the ${threshold.toFixed(2)} they expect. You have to move.`
        : `Your ratio slipped to ${ratio.toFixed(2)} goals/game, below the ${threshold.toFixed(2)} they expect.`,
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

  const effectiveRatio = lastStanding > careerRatio
    ? lastStanding
    : (age < 28 ? careerRatio : lastStanding);
  let betterTier = tierForRatio(effectiveRatio);
  if (currentStatus === 'reserve') {
    betterTier = Math.max(betterTier, club.tier) as ClubTier;
  }
  if (
    betterTier === 1
    && !scoringClearsElite({
      lastRatio: lastStanding,
      careerRatio,
      aggregateRatio: recentAggregateRatio(seasons),
    })
  ) {
    betterTier = 2;
  }
  const valueTier = tierForMarketValue(value);
  if (betterTier < club.tier && !blockElite && valueTier <= betterTier) {
    const offers = pickPermanentClubs(betterTier, fee, [club.id], nationality, blockElite, currentLeague, value, age, leagueSample, club.country);
    const basis = lastStanding > careerRatio ? "last season's" : (age < 28 ? 'career' : "last season's");
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
      true,
      nextIfStay,
    );
  }

  return attachCurrentClubRenewal(
    parallelTransfers(
      ratioMet ? 'Place secured' : 'Given more time to settle in',
      ratioMet
        ? `You maintained ${threshold.toFixed(2)} goals/game at ${club.name} - your place is safe.`
        : `You missed ${club.name}'s ${threshold.toFixed(2)} bar in your first season here. Stay as a ${SQUAD_STATUS_LABEL[nextIfStay]} next season — a loan is not required until you miss again.`,
      stayOn(),
      value,
      fee,
      nationality,
      [club.id],
      transferTier,
      shouldOfferLoans({
        ratioMet,
        status: currentStatus,
        openingWindow: openingContractWindow,
        ratio,
      }) && (openingContractWindow || (canOfferLoans && graceActive)),
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
    nextIfStay,
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
  const status = stayStatus ?? params.squadStatus;
  if (status === 'rising-star' || status === 'impact') return result;
  const yearsLeft = params.contractYearsRemaining ?? 0;
  if (yearsLeft < 1 || yearsLeft > 3) return result;
  const years = status === 'reserve' ? RESERVE_CONTRACT_YEARS : newContractYears(params.age);
  const seasonRatio = params.season.gamesPlayed > 0
    ? params.season.goals / params.season.gamesPlayed
    : undefined;
  const renewalSeasons = [...(params.seasonHistory ?? []), params.season];
  const seasonsDone = countedSeasonsCompleted(renewalSeasons);
  const wage = weeklyWageForTransferOffer(
    club,
    value,
    seasonRatio,
    seasonsDone,
    stayStatus ?? params.squadStatus ?? 'starter',
    params.clubLeague,
    recentAggregateRatio(renewalSeasons),
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
  homeCountry?: string | null,
): ClubOfferTerms[] {
  const existingSaudi = offers.filter((offer) => isSaudiClub(getClub(offer.clubId)));
  const next = offers
    .filter((offer) => !isSaudiClub(getClub(offer.clubId)))
    .map((offer) => ({ ...offer }));
  const blocked = new Set(excludeIds);
  const hostCountry = excludeIds.map((id) => getClub(id)?.country).find(Boolean) ?? null;
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
      const sameTierSaudi = CLUBS.filter(
        (club) =>
          isSaudiClub(club) &&
          club.playable !== false &&
          club.tier === bestPermTier &&
          !excludeIds.includes(club.id) &&
          !next.some((offer) => offer.clubId === club.id),
      );
      const giantFallback = bestPermTier <= 3
        ? TWILIGHT_SAUDI_CLUB_IDS
            .map((id) => getClub(id))
            .find((club) => club && !excludeIds.includes(club.id) && !next.some((offer) => offer.clubId === club.id))
        : undefined;
      const saudi = shuffle(sameTierSaudi)[0] ?? giantFallback;
      if (saudi) {
        const permIndexes = next
          .map((offer, index) => (offer.move === 'permanent' && !offer.renewal ? index : -1))
          .filter((index) => index >= 0);
        if (permIndexes.length >= TRANSFER_OFFER_COUNT) {
          let replaceAt = permIndexes[permIndexes.length - 1]!;
          for (let i = permIndexes.length - 1; i >= 0; i--) {
            const country = getClub(next[permIndexes[i]!]?.clubId)?.country;
            if (country !== homeCountry && country !== hostCountry) {
              replaceAt = permIndexes[i]!;
              break;
            }
          }
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

  if (params.squadStatus === 'impact' || params.squadStatus === 'rising-star' || params.squadStatus === 'reserve') {
    return { accepted: true, detail: '' };
  }
  if ((params.remainingPermanentOffers ?? 1) <= 0) {
    return { accepted: true, detail: '' };
  }

  const asking = transferFeeFromValue(params.playerValue, params.contractYearsLeft);
  const meetsAsking = asking <= 0 || params.offer.fee + 1e-6 >= asking * MIN_ACCEPTED_FEE_RATIO;
  if (meetsAsking) {
    return { accepted: true, detail: '' };
  }

  const destTier = dest?.tier ?? 5;
  const currentTier = current?.tier ?? 5;
  const eliteToElite = destTier === 1 && currentTier === 1;
  if (!eliteToElite) {
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
    options.map((c) => {
      const status = loanSquadStatus(c, { originClub: club });
      return {
        clubId: c.id,
        move: 'loan' as const,
        fee: 0,
        weeklyWage: weeklyWageForSquadStatus(c, 0, status, c.league),
        contractYears: 1,
        squadStatus: status,
      };
    }),
    false,
  );
}

