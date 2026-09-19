import type { CalendarFixture, SeasonCalendar } from './calendar';
import { getClub, SECOND_DIVISIONS, type Club } from './data/clubs';
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
export const IMPACT_STREAK = 2;

/** Score in this many consecutive played games to move up to Starter. */
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

export function describeSquadStatus(status: SquadStatus): string {
  if (status === 'starter') return 'In the starting XI across league, cups and internationals';
  if (status === 'rising-star') {
    return 'Rising star — temporary Season 1–2 role, one chance each time you play. Score in 2 consecutive games for Impact, or 3 for Starter.';
  }
  if (status === 'reserve') {
    return 'Reserve — every second game across league, cups and internationals. Hit the starter bar at any time and you keep Starter.';
  }
  return 'Impact — same games as Rising star, two chances each time you play. Keeps for the rest of the season; score in 3 consecutive games for Starter.';
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

/** Rising star gets one look; Impact gets two; others keep the drawn chances. */
export function chancesForSquadStatus(status: SquadStatus, drawn: number): number {
  if (status === 'rising-star') return 1;
  if (status === 'impact') return IMPACT_CHANCES;
  return drawn;
}

export function completedLeagueFixtureCount(
  calendar: SeasonCalendar | null | undefined,
  fixtureIndex: number,
): number {
  if (!calendar) return 0;
  return calendar.fixtures.slice(0, fixtureIndex).filter((fixture) => fixture.kind !== 'rest').length;
}

export function isSquadRotationSitOut(
  role: PlayerRole,
  squadStatus: SquadStatus,
  fixtureKind: CalendarFixture['kind'],
  completedFixtures: number,
  extra?: {
    toughMinutes?: boolean;
    seasonMatchCount?: number;
  },
): boolean {
  // Academy / reserve-year football is every game except injury.
  if (role === 'reserve') return false;
  if (fixtureKind === 'rest') return false;
  // Rising star sits the first first-team appearance of a campaign.
  if (squadStatus === 'rising-star' && extra?.seasonMatchCount === 0) return true;
  if (extra?.toughMinutes && (squadStatus === 'rising-star' || squadStatus === 'impact')) {
    return shouldSitToughFixture(squadStatus, completedFixtures);
  }
  return shouldSitLeagueFixture(squadStatus, completedFixtures);
}

/** Trailing played matches that scored. Sit-outs and drops do not break the run. */
export function consecutiveScoringGames(matches: Pick<MatchRecord, 'played' | 'scored'>[] | undefined): number {
  if (!matches?.length) return 0;
  let streak = 0;
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const match = matches[i];
    if (!match.played) continue;
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

function hitsStarterBar(params: {
  ratio: number;
  gamesPlayed: number;
  bar: number;
  honoursClear?: boolean;
}): boolean {
  return Boolean(params.honoursClear) || (params.gamesPlayed > 0 && params.ratio + 1e-9 >= params.bar);
}

/**
 * In-season promotions only — never a mid-season drop to Reserve.
 * Reserve → Starter when the club bar is hit, then it sticks.
 * Rising star / Impact (Seasons 1–2): 2-game scoring streak → Impact, 3 → Starter.
 */
export function promoteSquadStatusDuringSeason(params: {
  current: SquadStatus;
  matches?: Pick<MatchRecord, 'played' | 'scored'>[];
  ratio: number;
  gamesPlayed: number;
  bar: number;
  honoursClear?: boolean;
  allowYouthRoles?: boolean;
}): SquadStatus {
  const current = params.current;
  if (current === 'starter') return 'starter';
  const hitBar = hitsStarterBar(params);
  if (current === 'reserve') return hitBar ? 'starter' : 'reserve';
  if (params.allowYouthRoles && (current === 'rising-star' || current === 'impact')) {
    const streak = consecutiveScoringGames(params.matches);
    if (streak >= STARTER_STREAK) return 'starter';
    if (streak >= IMPACT_STREAK) return 'impact';
    return current;
  }
  if (hitBar) return 'starter';
  return current;
}

/**
 * End-of-season playing-time change. The player sees this before the transfer
 * window so they know their status going into the next campaign.
 *
 * Season 1 (`allowRisingStar`): below 0.33 → Reserve; club bar → Starter;
 * otherwise keep Rising star / Impact / Starter into Season 2.
 * Season 2 onward: Starter if the club bar is met, otherwise Reserve.
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
    if (!honours && ratio + 1e-9 < RISING_STAR_MIN_RATIO) return 'reserve';
    // Honours keep a youth role; only the club ratio (or a mid-season streak) makes Starter.
    if (gamesPlayed >= 12 && ratio + 1e-9 >= bar) return 'starter';
    return current === 'impact' || current === 'starter' || current === 'rising-star'
      ? current
      : 'rising-star';
  }

  return hitBar ? 'starter' : 'reserve';
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
  matches?: Pick<MatchRecord, 'played' | 'scored'>[];
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

/**
 * Playing time after a move. Loans are first-team football.
 * Permanent moves use last-season ratio against the destination bar:
 * starter if you meet it, Rising star if you hold 0.33, otherwise reserve.
 * Without a ratio, a step up still starts as reserve.
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
    return { keepLabel: 'Starter', keepRatio: clubBar, nextLabel: null, nextRatio: null };
  }
  if (status === 'rising-star') {
    return {
      keepLabel: 'Rising star',
      keepRatio: RISING_STAR_MIN_RATIO,
      keepHint: `${RISING_STAR_MIN_RATIO.toFixed(2)} at season end or you become a Reserve`,
      nextLabel: 'Impact',
      nextRatio: null,
      nextHint: 'Score in 2 consecutive games · 3 for Starter',
    };
  }
  if (status === 'reserve') {
    return {
      keepLabel: 'Reserve',
      keepRatio: clubBar,
      keepHint: 'Every second game until you hit the starter bar',
      nextLabel: 'Starter',
      nextRatio: clubBar,
      nextHint: `${clubBar.toFixed(2)} at any time — then you keep Starter`,
    };
  }
  return {
    keepLabel: 'Impact',
    keepRatio: RISING_STAR_MIN_RATIO,
    keepHint: 'Keeps this season · two chances, same games as Rising star',
    nextLabel: 'Starter',
    nextRatio: clubBar,
    nextHint: 'Score in 3 consecutive games, or hit the club bar',
  };
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
  if (params.move === 'loan') return 'starter';
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
