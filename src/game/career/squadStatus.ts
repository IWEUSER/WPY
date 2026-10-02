import type { CalendarFixture, SeasonCalendar } from './calendar';
import { getClub, SECOND_DIVISIONS, type Club } from './data/clubs';
import type { ContinentalCupId } from './data/competitions';
import { nationStrength } from './data/fifaRankings';
import { leagueValueWeight } from './playerValue';
import type { MatchRecord, PlayerRole, SeasonRecord, SquadStatus } from './types';

export const SQUAD_STATUS_LABEL: Record<SquadStatus, string> = {
  starter: 'Starter',
  'rising-star': 'Rising star',
  reserve: 'Reserve',
  impact: 'Impact',
};

/** End of Season 1: below this goals-per-game becomes Reserve for Season 2. */
export const RISING_STAR_MIN_RATIO = 0.33;

/** Score in this many consecutive played games to move Rising star → Impact. */
export const IMPACT_STREAK = 3;

/** After Impact, score in this many more consecutive games to become Starter. */
export const STARTER_STREAK = 3;

/** Impact looks in a match they play (Rising star stays at 1). */
export const IMPACT_CHANCES = 2;

/** Season 1 call-ups and market value still open from this calendar week. */
export const ROLE_REVIEW_WEEK = 20;

/** Rising star and Impact exist only in public Seasons 1 and 2. */
export function youthRolesAllowed(publicSeason: number | null | undefined): boolean {
  return publicSeason === 1 || publicSeason === 2;
}

/** Older saves stored the reserve minutes role as "rotation". */
export function normalizeSquadStatus(
  status: string | null | undefined,
  role: PlayerRole = 'first-team',
): SquadStatus {
  if (status === 'rotation') return 'reserve';
  if (status === 'starter' || status === 'rising-star' || status === 'reserve' || status === 'impact') {
    return status;
  }
  return defaultSquadStatus(role);
}

export function defaultSquadStatus(role: PlayerRole): SquadStatus {
  if (role === 'loan') return 'starter';
  if (role === 'first-team') return 'starter';
  return 'reserve';
}

/** First public season on every path starts as Rising star, not a full-time starter. */
export function openingSquadStatus(role: PlayerRole): SquadStatus {
  if (role === 'first-team') return 'rising-star';
  return defaultSquadStatus(role);
}

export type OpeningSquadPick = 'rising-star' | 'impact' | 'starter';

export function isOpeningSquadPick(status: string | null | undefined): status is OpeningSquadPick {
  return status === 'rising-star' || status === 'impact' || status === 'starter';
}

export function resolveOpeningSquadStatus(role: PlayerRole, pick?: SquadStatus | null): SquadStatus {
  if (role !== 'first-team') return openingSquadStatus(role);
  return isOpeningSquadPick(pick) ? pick : openingSquadStatus(role);
}

export function describeSquadStatus(status: SquadStatus): string {
  if (status === 'starter') return 'In the starting XI across league, cups and internationals';
  if (status === 'rising-star') {
    return 'Rising star — temporary Season 1–2 role, one chance each time you play. League games rotate. No continental or super-cup minutes, and only the first two domestic cup ties. Score in 3 consecutive games for Impact, then another 3 for Starter. Extra goals in one game still count as one.';
  }
  if (status === 'reserve') {
    return 'Reserve — league games and the first two domestic cup ties only. Sits super cups, continentals and later cup rounds. League games rotate every other. Score in 3 consecutive games for Starter, the same way as Rising star and Impact.';
  }
  return 'Impact — league, cups and continentals on the same every-fourth rotation as before, two chances each time you play. Keeps for the rest of the season; score in 3 consecutive games for Starter.';
}

export function describeRotationSitOut(status: SquadStatus): string {
  if (status === 'impact') return 'Not selected · impact';
  if (status === 'rising-star') return 'Not selected · rising star';
  return 'Not selected · reserve';
}

/**
 * Sit-out pattern among actionable fixtures already completed this season.
 * Starter: never. Rising star and Impact: every fourth. Reserve: every other.
 */
export function shouldSitLeagueFixture(status: SquadStatus, completedFixtures: number): boolean {
  if (status === 'starter') return false;
  if (status === 'rising-star' || status === 'impact') return completedFixtures % 4 === 3;
  return completedFixtures % 2 === 1;
}

/** Tougher minutes: international tournament rounds, or a stronger opponent. */
export function isToughMinutesFixture(
  fixture: CalendarFixture,
  club: Club,
  nationId?: string | null,
): boolean {
  if (fixture.kind === 'international') {
    const round = fixture.internationalRound;
    if (round && round !== 'qualifier' && round !== 'friendly') return true;
    if (fixture.opponentId && nationId) {
      return nationStrength(fixture.opponentId) > nationStrength(nationId);
    }
    return false;
  }
  const opp = fixture.opponentId ? getClub(fixture.opponentId) : undefined;
  if (!opp) return false;
  return opp.strength > club.strength;
}

/** Rising star and Impact sit two of three tough games. Reserve uses every-other only. */
export function shouldSitToughFixture(status: SquadStatus, completedFixtures: number): boolean {
  if (status === 'starter' || status === 'reserve') return false;
  return completedFixtures % 3 !== 0;
}

/** Rising star gets one look; Impact gets two; others keep the drawn chances.
 * A fixture that drew zero looks stays at zero for every role. */
export function chancesForSquadStatus(status: SquadStatus, drawn: number): number {
  if (status === 'rising-star') return 1;
  if (status === 'impact') return IMPACT_CHANCES;
  if (status === 'reserve') return Math.max(1, drawn);
  return drawn;
}

/** Rising star only plays this many domestic-cup ties; later rounds are sit-outs. */
export const RISING_STAR_DOMESTIC_CUP_GAMES = 2;

export function completedLeagueFixtureCount(
  calendar: SeasonCalendar | null | undefined,
  fixtureIndex: number,
): number {
  if (!calendar) return 0;
  return calendar.fixtures.slice(0, fixtureIndex).filter((fixture) => fixture.kind !== 'rest').length;
}

export function completedFixtureKindCount(
  calendar: SeasonCalendar | null | undefined,
  fixtureIndex: number,
  kind: CalendarFixture['kind'],
): number {
  if (!calendar) return 0;
  return calendar.fixtures.slice(0, fixtureIndex).filter((fixture) => fixture.kind === kind).length;
}

/** Club continental nights, super cups, and Leagues Cup — not domestic cups. */
export function isContinentalClubFixture(kind: CalendarFixture['kind']): boolean {
  return kind.startsWith('continental') || kind === 'super-cup' || kind === 'leagues-cup';
}

export function reserveSitsChampionsLeague(
  fixtureKind: CalendarFixture['kind'],
  continentalCup?: ContinentalCupId | null,
): boolean {
  return continentalCup === 'ucl' && fixtureKind.startsWith('continental');
}

/** Europa League, Conference, ACLE, Leagues Cup — play these ahead of the league. */
export function reservePrioritisesContinental(
  fixtureKind: CalendarFixture['kind'],
  continentalCup?: ContinentalCupId | null,
): boolean {
  if (!continentalCup || continentalCup === 'ucl') return false;
  return fixtureKind.startsWith('continental') || fixtureKind === 'leagues-cup';
}

export function isSquadRotationSitOut(
  role: PlayerRole,
  squadStatus: SquadStatus,
  fixtureKind: CalendarFixture['kind'],
  completedFixtures: number,
  extra?: {
    toughMinutes?: boolean;
    seasonMatchCount?: number;
    continentalCup?: ContinentalCupId | null;
    domesticCupAppearances?: number;
  },
): boolean {
  // Academy / reserve-year football is every game except injury.
  if (role === 'reserve') return false;
  if (fixtureKind === 'rest') return false;
  if (squadStatus === 'rising-star' || squadStatus === 'reserve') {
    if (isContinentalClubFixture(fixtureKind)) return true;
    if (fixtureKind === 'international') return squadStatus === 'reserve';
    if (fixtureKind === 'domestic-cup') {
      return (extra?.domesticCupAppearances ?? 0) >= RISING_STAR_DOMESTIC_CUP_GAMES;
    }
  }
  if (squadStatus === 'reserve') {
    if (reserveSitsChampionsLeague(fixtureKind, extra?.continentalCup)) return true;
    if (reservePrioritisesContinental(fixtureKind, extra?.continentalCup)) return true;
  }
  if (extra?.toughMinutes && (squadStatus === 'rising-star' || squadStatus === 'impact')) {
    return shouldSitToughFixture(squadStatus, completedFixtures);
  }
  return shouldSitLeagueFixture(squadStatus, completedFixtures);
}

function isScoringLook(match: Pick<MatchRecord, 'played' | 'scored' | 'chances'>): boolean {
  return match.played && (match.chances ?? 1) > 0;
}

/** Trailing played matches that scored. Sit-outs, drops, and 0-chance games do not break the run. */
export function consecutiveScoringGames(
  matches: Pick<MatchRecord, 'played' | 'scored' | 'chances'>[] | undefined,
): number {
  if (!matches?.length) return 0;
  let streak = 0;
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i];
    if (!isScoringLook(match)) continue;
    if (match.scored !== true) break;
    streak += 1;
  }
  return streak;
}

/** League golden boot, POTY, or tournament POT counts as clearing the club bar. */
export function seasonOverridesRatioBar(season: Pick<
  SeasonRecord,
  'topGoalscorer' | 'playerOfTheYear' | 'clubPlayerOfTheTournament' | 'international'
>): boolean {
  return Boolean(
    season.topGoalscorer
    || season.playerOfTheYear
    || season.clubPlayerOfTheTournament
    || season.international?.playerOfTheTournament
    || season.international?.topGoalscorer,
  );
}

export function seasonRatioClearsBar(params: {
  ratio: number;
  gamesPlayed: number;
  bar: number;
  season?: Pick<SeasonRecord, 'topGoalscorer' | 'playerOfTheYear' | 'clubPlayerOfTheTournament' | 'international'> | null;
}): boolean {
  if (params.season && seasonOverridesRatioBar(params.season)) return true;
  return params.gamesPlayed > 0 && params.ratio >= params.bar;
}

/**
 * In-season promotions only — never a mid-season drop to Reserve.
 * Reserve (Season 3+), Rising star, and Impact all need 3 consecutive
 * scoring games to move up. Multiple goals in one game count as one.
 */
export function promoteSquadStatusDuringSeason(params: {
  current: SquadStatus;
  matches?: Pick<MatchRecord, 'played' | 'scored' | 'chances'>[];
  ratio: number;
  gamesPlayed: number;
  bar: number;
  honoursClear?: boolean;
  allowYouthRoles?: boolean;
  /** Status at the start of this season — needed so an Impact carry-in can still use a fresh 3-game run. */
  openedAs?: SquadStatus;
}): SquadStatus {
  const current = params.current;
  if (current === 'starter') return 'starter';
  if (current === 'reserve') {
    return consecutiveScoringGames(params.matches) >= STARTER_STREAK ? 'starter' : 'reserve';
  }
  if (params.allowYouthRoles && (current === 'rising-star' || current === 'impact')) {
    if (current === 'rising-star') {
      return consecutiveScoringGames(params.matches) >= IMPACT_STREAK ? 'impact' : 'rising-star';
    }
    const openedAs = params.openedAs ?? 'impact';
    if (consecutiveScoringAsImpact(params.matches, openedAs) >= STARTER_STREAK) return 'starter';
    return 'impact';
  }
  return current;
}

/** First played match that completed a Rising-star → Impact 3-game scoring run. */
export function impactPromotionMatchIndex(
  matches: Pick<MatchRecord, 'played' | 'scored' | 'chances'>[] | undefined,
): number | null {
  if (!matches?.length) return null;
  let streak = 0;
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    if (!isScoringLook(match)) continue;
    if (match.scored === true) {
      streak += 1;
      if (streak >= IMPACT_STREAK) return i;
    } else {
      streak = 0;
    }
  }
  return null;
}

/**
 * Trailing scoring games that count toward Starter. If the player opened the
 * season as Rising star, the Impact run is discarded and a new 3-game run starts.
 */
export function consecutiveScoringAsImpact(
  matches: Pick<MatchRecord, 'played' | 'scored' | 'chances'>[] | undefined,
  openedAs: SquadStatus,
): number {
  if (!matches?.length) return 0;
  const after = openedAs === 'rising-star' || openedAs === 'reserve'
    ? impactPromotionMatchIndex(matches)
    : null;
  const start = after == null ? -1 : after;
  let streak = 0;
  for (let i = matches.length - 1; i > start; i -= 1) {
    const match = matches[i];
    if (!isScoringLook(match)) continue;
    if (match.scored !== true) break;
    streak += 1;
  }
  return streak;
}

/**
 * End-of-season playing-time change. The player sees this before the transfer
 * window so they know their status going into the next campaign.
 *
 * Season 1 (`allowRisingStar`): keep the current Rising star / Impact /
 * Starter role. Missing 0.33 never becomes Reserve — Season 2 can still be
 * at this club as Rising star, with a loan always on the table.
 * Hitting the club bar does not skip the 3-game scoring streak.
 * Season 2 onward: a Starter who hits the bar stays Starter. Youth roles
 * and Reserve do not become Starter at the window — that happens in-season.
 * Impact and Rising star never continue into Season 3.
 */
export function nextSquadStatusAfterSeason(params: {
  role: PlayerRole;
  current: SquadStatus;
  ratio: number;
  gamesPlayed: number;
  bar: number;
  honoursClear?: boolean;
  /** True while finishing public Season 1 — youth roles can continue into Season 2. */
  allowRisingStar?: boolean;
}): SquadStatus {
  if (params.role === 'reserve') return 'rising-star';
  const { current, ratio, gamesPlayed, bar } = params;
  const honours = Boolean(params.honoursClear);
  const allowRisingStar = params.allowRisingStar !== false;
  const hitBar = honours || (gamesPlayed > 0 && ratio + 1e-9 >= bar);

  if (allowRisingStar) {
    // Missing the 0.33 line never becomes Reserve — that role plays more
    // often than Impact. Season 2 can stay as Rising star, or take a loan.
    if (current === 'starter') return 'starter';
    return current === 'impact' || current === 'rising-star' ? current : 'rising-star';
  }

  if (current === 'starter') return hitBar ? 'starter' : 'reserve';
  return 'reserve';
}

/**
 * @deprecated Use promoteSquadStatusDuringSeason. Kept so older call sites compile.
 * Never demotes to Reserve mid-season.
 */
export function squadStatusAfterFormReview(params: {
  current: SquadStatus;
  ratio: number;
  gamesPlayed: number;
  bar: number;
  honoursClear?: boolean;
  matches?: Pick<MatchRecord, 'played' | 'scored' | 'chances'>[];
  allowYouthRoles?: boolean;
}): SquadStatus {
  return promoteSquadStatusDuringSeason(params);
}

/**
 * A parent-club recall is only a reserve role when the loan was a step down
 * (second division, or a weaker-weighted league). Same-division loans that
 * hit the parent starter bar return as a starter.
 */
export function isLowerDivisionLoan(
  fromClub: Club | null | undefined,
  toClub: Club | null | undefined,
): boolean {
  if (!fromClub || !toClub) return false;
  if (fromClub.league === toClub.league) return false;
  if (SECOND_DIVISIONS.has(fromClub.league) && !SECOND_DIVISIONS.has(toClub.league)) return true;
  return leagueValueWeight(fromClub.league) + 1e-9 < leagueValueWeight(toClub.league);
}

/** Destination is a weaker pyramid step: second division from a top flight, or a worse tier in a different league. Same league is never a step down. */
export function isStepDownClub(
  origin: Club | null | undefined,
  dest: Club | null | undefined,
): boolean {
  if (!origin || !dest) return false;
  if (origin.league === dest.league) return false;
  if (SECOND_DIVISIONS.has(dest.league) && !SECOND_DIVISIONS.has(origin.league)) return true;
  return dest.tier > origin.tier;
}

/** Same league, or the same transfer band, and not a step down. */
export function isPeerClub(
  origin: Club | null | undefined,
  dest: Club | null | undefined,
): boolean {
  if (!origin || !dest) return false;
  if (origin.league === dest.league) return true;
  if (isStepDownClub(origin, dest)) return false;
  return dest.tier === origin.tier;
}

/**
 * Playing time after a move. Same-level loans are Rising star, not Starter.
 * A step-down loan is still Starter. Permanent moves use last-season ratio
 * against the destination bar: starter if you meet it, Rising star if you
 * hold 0.33, otherwise reserve. Without a ratio, a step up still starts as
 * reserve.
 */
export function squadRoleRatioGuide(status: SquadStatus, clubBar: number): {
  keepLabel: string;
  keepRatio: number;
  keepHint?: string;
  nextLabel: string | null;
  nextRatio: number | null;
  nextHint?: string;
} {
  if (status === 'starter') {
    return {
      keepLabel: 'Starter',
      keepRatio: clubBar,
      keepHint: `${clubBar.toFixed(2)} to keep this role`,
      nextLabel: null,
      nextRatio: null,
    };
  }
  if (status === 'rising-star') {
    return {
      keepLabel: 'Rising star',
      keepRatio: RISING_STAR_MIN_RATIO,
      keepHint: 'Score in 3 consecutive games for Impact',
      nextLabel: null,
      nextRatio: null,
    };
  }
  if (status === 'reserve') {
    return {
      keepLabel: 'Reserve',
      keepRatio: clubBar,
      keepHint: 'Score in 3 consecutive games for Starter',
      nextLabel: null,
      nextRatio: null,
    };
  }
  return {
    keepLabel: 'Impact',
    keepRatio: RISING_STAR_MIN_RATIO,
    keepHint: 'Score in 3 consecutive games for Starter',
    nextLabel: null,
    nextRatio: null,
  };
}

/** Consecutive scoring looks that count toward the next in-season promotion. */
export function promotionStreakForStatus(
  status: SquadStatus,
  matches: Pick<MatchRecord, 'played' | 'scored' | 'chances'>[] | undefined,
  openedAs?: SquadStatus,
): { streak: number; nextLabel: string | null; needed: number } {
  if (status === 'rising-star') {
    return { streak: consecutiveScoringGames(matches), nextLabel: 'Impact', needed: IMPACT_STREAK };
  }
  if (status === 'reserve') {
    return { streak: consecutiveScoringGames(matches), nextLabel: 'Starter', needed: STARTER_STREAK };
  }
  if (status === 'impact') {
    return {
      streak: consecutiveScoringAsImpact(matches, openedAs ?? 'impact'),
      nextLabel: 'Starter',
      needed: STARTER_STREAK,
    };
  }
  return { streak: 0, nextLabel: null, needed: 0 };
}

function trailingLookIndexes(
  matches: Pick<MatchRecord, 'played' | 'scored' | 'chances'>[],
  count: number,
  scored: boolean,
  afterIndex = -1,
): number[] {
  if (count <= 0) return [];
  const indexes: number[] = [];
  for (let i = matches.length - 1; i > afterIndex && indexes.length < count; i -= 1) {
    const match = matches[i];
    if (!isScoringLook(match)) continue;
    if ((match.scored === true) !== scored) break;
    indexes.push(i);
  }
  return indexes;
}

/** Match indexes in recent form that should light up for a promotion chance or a drop. */
export function formHighlightIndexes(params: {
  matches: Pick<MatchRecord, 'played' | 'scored' | 'chances'>[];
  status: SquadStatus;
  openedAs?: SquadStatus;
  dropWindowFails: number;
  nextMissDrops: boolean;
}): { promote: number[]; drop: number[] } {
  const promo = promotionStreakForStatus(params.status, params.matches, params.openedAs);
  const promote = promo.nextLabel && promo.streak === promo.needed - 1
    ? trailingLookIndexes(
      params.matches,
      promo.streak,
      true,
      params.status === 'impact' && (params.openedAs === 'rising-star' || params.openedAs === 'reserve')
        ? (impactPromotionMatchIndex(params.matches) ?? -1)
        : -1,
    )
    : [];
  const drop = params.nextMissDrops
    ? trailingLookIndexes(params.matches, params.dropWindowFails, false)
    : [];
  return { promote, drop };
}

export function squadStatusOnArrival(params: {
  fromClub: Club | null | undefined;
  toClub: Club | null | undefined;
  move: 'loan' | 'permanent' | 'promotion' | 'stay' | 'recall';
  nextIfStay: SquadStatus;
  playerRatio?: number;
  allowRisingStar?: boolean;
}): SquadStatus {
  if (params.move === 'stay') return params.nextIfStay;
  if (params.move === 'recall') {
    if (isLowerDivisionLoan(params.fromClub, params.toClub)) return 'reserve';
    if (params.toClub && params.playerRatio != null) {
      if (params.playerRatio + 1e-9 >= params.toClub.firstTeamGoalRatio) return 'starter';
      return 'reserve';
    }
    return 'starter';
  }
  if (params.move === 'loan') {
    if (isPeerClub(params.fromClub, params.toClub)) return 'rising-star';
    return 'starter';
  }
  if (params.move === 'promotion') return 'rising-star';
  const allowRisingStar = params.allowRisingStar !== false;
  if (params.toClub && params.playerRatio != null) {
    if (params.playerRatio + 1e-9 >= params.toClub.firstTeamGoalRatio) return 'starter';
    if (allowRisingStar && params.playerRatio >= RISING_STAR_MIN_RATIO) return 'rising-star';
    return 'reserve';
  }
  if (!params.fromClub || !params.toClub) return 'starter';
  if (params.toClub.tier < params.fromClub.tier) return 'reserve';
  return 'starter';
}
