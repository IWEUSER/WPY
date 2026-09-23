/**
 * Sourced all-time scoring boards: rank + totals only, no names.
 * Run with: npm run test:legacy
 */
import { LEAGUE_CAREER, LEAGUE_SEASON, nationOverallTotals } from '../src/game/career/data/legacyRecordTotals';
import {
  careerLegacyBoards,
  identityLegacyBoards,
  inputWithoutSeason,
  LEGACY_TOP_N,
  ordinal,
  participatedLegacyBoards,
  playerGoalsForBoard,
  rankForGoals,
  revealForRank,
  seasonLegacyHighlights,
  viewForBoard,
  type LegacyCareerInput,
} from '../src/game/career/legacyRecords';
import type { SeasonRecord } from '../src/game/career/types';
import { emptyCompetitionRecord, type NationalTeamState } from '../src/game/career/international';
import { createAvailability } from '../src/game/career/availabilityEngine';

const BANNED = [
  'messi',
  'ronaldo',
  'pele',
  'maradona',
  'cruyff',
  'shearer',
  'haaland',
  'mbappe',
  'salah',
  'kane',
  'neymar',
  'benzema',
  'lewandowski',
  'van dijk',
  'muller',
  'müller',
];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) fail(message);
}

function season(partial: Partial<SeasonRecord> & Pick<SeasonRecord, 'clubId' | 'leagueGoals'>): SeasonRecord {
  return {
    seasonNumber: 2,
    role: 'first-team',
    matches: [],
    goals: partial.leagueGoals,
    gamesPlayed: 30,
    ratioMet: true,
    age: 18,
    cupGames: 0,
    cupGoals: 0,
    domesticGames: 30,
    domesticGoals: partial.leagueGoals,
    continentalStats: [],
    trophies: [],
    topGoalscorer: false,
    playerOfTheYear: false,
    wonWpy: false,
    ...partial,
  };
}

const emptyTeam = (nationId = 'england'): NationalTeamState => ({
  nationId,
  availability: createAvailability(),
  caps: 0,
  goals: 0,
  byCompetition: [],
});

assert(LEAGUE_CAREER['Premier League']?.[0] === 260, 'PL record should be 260');
assert(LEAGUE_CAREER['Premier League']?.length === 10, 'PL career ladder should be a sourced top 10');
assert(LEAGUE_SEASON['Premier League']?.[0] === 36, 'PL single-season record should be 36');
assert(LEAGUE_CAREER['La Liga']?.[0] === 474, 'La Liga record should be 474');
assert(nationOverallTotals('england')[0] === 85, 'England record should be 85');
assert(nationOverallTotals('portugal')[0] === 146, 'Portugal record should be 146');
assert(nationOverallTotals('san-marino')[0] === 8, 'San Marino should use the sourced record holder only');
assert(nationOverallTotals('san-marino').length === 1, 'tiny nations must not invent a top 10');

const plCareer = {
  id: 'league:career:premier-league',
  domain: 'club' as const,
  span: 'career' as const,
  title: 'Premier League',
  subtitle: 'All-time league goals',
  group: 'league' as const,
  tone: 'all-time' as const,
};
const plSeason = {
  ...plCareer,
  id: 'league:season:premier-league',
  span: 'season' as const,
  subtitle: 'Single-season league goals',
  tone: 'season-overall' as const,
};

const outside = viewForBoard(plCareer, { seasons: [], nationalTeam: null });
assert(outside.reveal === 'outside', '0 goals should sit outside the sourced top 10');
assert(outside.table === null, 'outside the top 10 must not show a table');
assert(outside.goalsToTop10 === 162, `need 162 to enter PL top 10, got ${outside.goalsToTop10}`);

const listed = viewForBoard(plCareer, {
  seasons: [season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 161, leagueGames: 30 })],
  nationalTeam: null,
});
assert(listed.reveal === 'outside', `161 PL goals should stay outside, got ${listed.reveal} rank ${listed.rank}`);
assert(listed.table === null, 'outside top 10 must not list historical names');

const top10 = viewForBoard(plCareer, {
  seasons: [season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 162, leagueGames: 30 })],
  nationalTeam: null,
});
assert(top10.reveal === 'top10', `matching 10th should unlock the table, got ${top10.reveal} ${top10.rank}`);
assert(top10.rank === 10, `162 should be 10th, got ${top10.rank}`);
assert(top10.table?.some((row) => row.you), 'top 10 table must include the player row');
assert(top10.table?.every((row) => !('name' in row)), 'table rows must not carry a name field');

const record = viewForBoard(plCareer, {
  seasons: [season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 400, leagueGames: 30 })],
  nationalTeam: null,
});
assert(record.rank === 1, '400 PL goals should be 1st');
assert(record.table?.[0]?.you, 'record holder should sit 1st');
assert(record.table?.[0]?.goals === 400, '1st row should show the player total');

const otherLeague = viewForBoard(plCareer, {
  seasons: [season({ clubId: 'bayern', league: 'Bundesliga', leagueGoals: 400, leagueGames: 30 })],
  nationalTeam: null,
});
assert(otherLeague.playerGoals === 0, 'Bundesliga goals must not count on the Premier League board');

const seasonBoard = viewForBoard(plSeason, {
  seasons: [
    season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 36, leagueGames: 38 }),
    season({ clubId: 'arsenal', league: 'Premier League', seasonNumber: 3, leagueGoals: 12, leagueGames: 30 }),
  ],
  nationalTeam: null,
});
assert(seasonBoard.playerGoals === 36, `single-season board uses the best season, got ${seasonBoard.playerGoals}`);
assert(seasonBoard.rank === 1, '36 should equal the PL season record');

const cl = {
  id: 'continental:career:ucl',
  domain: 'club' as const,
  span: 'career' as const,
  title: 'Champions League',
  subtitle: 'All-time tournament goals',
  group: 'continental' as const,
  tone: 'all-time' as const,
};
const clGoals = playerGoalsForBoard(cl, {
  seasons: [
    season({
      clubId: 'arsenal',
      league: 'Premier League',
      leagueGoals: 20,
      leagueGames: 30,
      continentalStats: [
        { cup: 'ucl', games: 12, goals: 17 },
        { cup: 'uel', games: 8, goals: 9 },
      ],
    }),
  ],
  nationalTeam: null,
});
assert(clGoals === 17, `UCL board should ignore Europa goals, got ${clGoals}`);

const team: NationalTeamState = {
  ...emptyTeam(),
  caps: 30,
  goals: 40,
  byCompetition: [
    { ...emptyCompetitionRecord('world-cup'), qualifyingGoals: 12, finalsGoals: 8, qualifyingGames: 10, finalsGames: 7 },
    { ...emptyCompetitionRecord('euro'), qualifyingGoals: 4, finalsGoals: 3, qualifyingGames: 6, finalsGames: 5 },
  ],
};

const wc = {
  id: 'nation-tournament:career:england:world-cup',
  domain: 'nation' as const,
  span: 'career' as const,
  title: 'England · World Cup',
  subtitle: 'All-time tournament goals',
  group: 'nation' as const,
  tone: 'all-time' as const,
};
const wcView = viewForBoard(wc, { seasons: [], nationalTeam: team, nationality: 'england' });
assert(wcView.playerGoals === 8, `World Cup board should use finals only, got ${wcView.playerGoals}`);
assert(wcView.rank === 2, `8 England World Cup goals should be 2nd, got ${wcView.rank}`);

const intl = {
  id: 'nation-overall:england',
  domain: 'nation' as const,
  span: 'career' as const,
  title: 'England',
  subtitle: 'All-time international goals',
  group: 'nation' as const,
  tone: 'all-time' as const,
};
const intlView = viewForBoard(intl, { seasons: [], nationalTeam: team, nationality: 'england' });
assert(intlView.playerGoals === 40, `all-time international should use cap goals, got ${intlView.playerGoals}`);
assert(intlView.rank === 6, `40 England goals should be 6th, got ${intlView.rank}`);

const cup = {
  id: 'cup:career:fa-cup',
  domain: 'club' as const,
  span: 'career' as const,
  title: 'FA Cup',
  subtitle: 'All-time cup goals',
  group: 'cup' as const,
  tone: 'all-time' as const,
};
const cupGoals = playerGoalsForBoard(cup, {
  seasons: [
    season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 10, leagueGames: 30, cupGames: 5, cupGoals: 6 }),
    season({ clubId: 'barcelona', league: 'La Liga', leagueGoals: 10, leagueGames: 30, cupGames: 5, cupGoals: 9 }),
  ],
  nationalTeam: null,
});
assert(cupGoals === 6, `FA Cup should ignore Copa del Rey goals, got ${cupGoals}`);

assert(ordinal(1) === '1st' && ordinal(2) === '2nd' && ordinal(3) === '3rd' && ordinal(11) === '11th', 'ordinals');
assert(revealForRank(1, LEAGUE_CAREER['Premier League']!) === 'top10', 'top 10 band');
assert(revealForRank(10, LEAGUE_CAREER['Premier League']!) === 'top10', '10th is top 10');
assert(revealForRank(11, LEAGUE_CAREER['Premier League']!) === 'outside', '11th is outside');
assert(rankForGoals(9, LEAGUE_CAREER['Premier League']!) > LEGACY_TOP_N, 'below 10th is outside');

const plOnly: LegacyCareerInput = {
  seasons: [season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 20, leagueGames: 30, cupGames: 4, cupGoals: 2 })],
  nationalTeam: emptyTeam(),
  nationality: 'england',
};
const participated = participatedLegacyBoards(plOnly);
assert(participated.some((def) => def.id === 'league:career:premier-league'), 'PL appearance should unlock the PL board');
assert(
  participated.some((def) => def.id === 'cup:season:fa-cup' && def.subtitle === 'Single-season FA Cup goals'),
  'cup season records must name the tournament',
);
const withUcl: LegacyCareerInput = {
  ...plOnly,
  seasons: [
    season({
      clubId: 'arsenal',
      league: 'Premier League',
      leagueGoals: 20,
      leagueGames: 30,
      cupGames: 4,
      cupGoals: 2,
      continentalStats: [{ cup: 'ucl', games: 12, goals: 8 }],
    }),
  ],
};
assert(
  participatedLegacyBoards(withUcl).some(
    (def) => def.id === 'continental:season:ucl' && def.subtitle === 'Single-season Champions League goals',
  ),
  'continental season records must name the tournament',
);
assert(!participated.some((def) => def.id.includes('la-liga')), 'unplayed leagues must stay hidden');
assert(!participated.some((def) => def.id.includes('world-cup')), 'unplayed tournaments must stay hidden');
assert(!participated.some((def) => def.group === 'nation'), 'zero caps must hide nation boards');

const withCaps: LegacyCareerInput = {
  ...plOnly,
  nationalTeam: team,
};
const nationBoards = participatedLegacyBoards(withCaps);
assert(nationBoards.some((def) => def.id === 'nation-overall:england'), 'caps should unlock England overall');
assert(nationBoards.some((def) => def.id.includes('world-cup')), 'World Cup finals should unlock that board');
assert(
  nationBoards.some((def) => def.id.includes('world-cup') && def.span === 'season' && def.subtitle === 'Single World Cup goals'),
  'nation season records must name the tournament',
);
assert(!nationBoards.some((def) => def.id.includes('copa-america')), 'England must not show Copa América');

const identity = identityLegacyBoards({
  seasons: [season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 162, leagueGames: 30 })],
  nationalTeam: null,
});
assert(identity.some((board) => board.def.id === 'league:career:premier-league'), 'identity shows sourced top-10 ranks');
assert(identity.every((board) => board.reveal === 'top10'), 'identity legacy box is top 10 only');

const currentSeason = season({
  clubId: 'arsenal',
  league: 'Premier League',
  leagueGoals: 36,
  leagueGames: 38,
  seasonNumber: 4,
});
const previous: LegacyCareerInput = {
  seasons: [season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 12, leagueGames: 30 })],
  nationalTeam: null,
};
const after: LegacyCareerInput = {
  seasons: [...previous.seasons, currentSeason],
  nationalTeam: null,
};
const highlights = seasonLegacyHighlights(previous, after, currentSeason);
assert(
  highlights.some((item) => item.kind === 'season' && item.playerGoals === 36),
  'a 36-goal PL season should show as a season record',
);
assert(
  !highlights.some((item) => item.kind === 'all-time' && item.title === 'Premier League' && item.subtitle.includes('All-time')),
  '12 + 36 = 48 must not claim an all-time PL top 10',
);

const allTimeSeason = season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 162, leagueGames: 38, seasonNumber: 5 });
const allTimeAfter: LegacyCareerInput = { seasons: [allTimeSeason], nationalTeam: null };
const allTimeHighlights = seasonLegacyHighlights({ seasons: [], nationalTeam: null }, allTimeAfter, allTimeSeason);
assert(
  allTimeHighlights.some((item) => item.kind === 'all-time'),
  'breaking into the all-time top 10 should show on the season review',
);

const stripped = inputWithoutSeason(allTimeAfter, allTimeSeason);
assert(stripped.seasons.length === 0, 'removing the only season should leave an empty career');

for (const board of careerLegacyBoards(withCaps)) {
  const blob = JSON.stringify(board).toLowerCase();
  for (const banned of BANNED) {
    if (blob.includes(banned)) fail(`${board.def.id} leaked a real or fictional name: ${banned}`);
  }
}

console.log(`legacy records ok · ${participated.length} PL boards · England WC 8 goals is ${wcView.rankLabel}`);
