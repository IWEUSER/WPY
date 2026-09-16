/**
 * All-time scoring boards: fictional 99-name ladders and rank reveal.
 * Run with: npm run test:legacy
 */
import {
  allLegacyBoards,
  careerLegacyBoards,
  historicalLadder,
  historicalTotals,
  LEGACY_TABLE_SIZE,
  LEGACY_TOP_N,
  leagueBoardId,
  ordinal,
  playerGoalsForBoard,
  rankForGoals,
  revealForRank,
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

const boards = allLegacyBoards();
assert(boards.length >= 20, `expected a full record catalogue, got ${boards.length}`);
assert(boards.some((b) => b.kind === 'league' && b.title === 'Premier League'), 'missing Premier League board');
assert(boards.some((b) => b.kind === 'champions-league'), 'missing Champions League board');
assert(boards.some((b) => b.id === 'cup:fa-cup'), 'missing FA Cup board');
assert(boards.some((b) => b.id === 'tournament:world-cup'), 'missing World Cup board');
assert(boards.some((b) => b.id === 'international:all-time'), 'missing all-time international board');

for (const def of boards) {
  const ladder = historicalLadder(def);
  assert(ladder.length === LEGACY_TABLE_SIZE, `${def.id} should have ${LEGACY_TABLE_SIZE} names`);
  assert(ladder[0]!.goals >= ladder[ladder.length - 1]!.goals, `${def.id} totals should not rise`);
  const names = new Set(ladder.map((row) => row.name));
  assert(names.size === ladder.length, `${def.id} names must be unique`);
  for (const row of ladder) {
    const hay = row.name.toLowerCase();
    for (const banned of BANNED) {
      if (hay.includes(banned)) fail(`${def.id} leaked a real player name: ${row.name}`);
    }
  }
}

const pl = boards.find((b) => b.id === leagueBoardId('Premier League'))!;
const plLadder = historicalLadder(pl);
assert(plLadder[0]!.goals === 260, `PL record should be 260, got ${plLadder[0]!.goals}`);
assert(plLadder[98]!.goals === 54, `PL 99th should be 54, got ${plLadder[98]!.goals}`);

const outside = viewForBoard(pl, { seasons: [], nationalTeam: null });
assert(outside.reveal === 'outside', '0 goals should be 100+');
assert(outside.rankLabel === '100+', `0 goals label should be 100+, got ${outside.rankLabel}`);
assert(outside.table === null, '100+ must not show the 1-10 table');
assert(outside.goalsToEnter === 54, `need 54 to enter, got ${outside.goalsToEnter}`);

const listed = viewForBoard(pl, {
  seasons: [season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 54 })],
  nationalTeam: null,
});
assert(listed.reveal === 'listed', `54 PL goals should list inside 99, got ${listed.reveal} rank ${listed.rank}`);
assert(listed.rank === 99, `matching 99th should be 99th, got ${listed.rank}`);
assert(listed.table === null, '11-99 must not show names');
assert(listed.rankLabel === '99th', listed.rankLabel);

const almostTop = viewForBoard(pl, {
  seasons: [season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: plLadder[9]!.goals - 1 })],
  nationalTeam: null,
});
assert(almostTop.reveal === 'listed', 'one below 10th should stay listed');
assert(almostTop.goalsToTop10 === 1, `need 1 more to reach top 10, got ${almostTop.goalsToTop10}`);

const top10 = viewForBoard(pl, {
  seasons: [season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: plLadder[9]!.goals })],
  nationalTeam: null,
});
assert(top10.reveal === 'top10', `matching 10th should unlock the table, got ${top10.reveal} ${top10.rank}`);
assert(top10.table?.length === LEGACY_TOP_N, 'top 10 table should have 10 rows');
assert(top10.table?.some((row) => row.you), 'top 10 table must include You');
assert(top10.table?.[0]?.rank === 1, 'table should start at 1st');

const record = viewForBoard(pl, {
  seasons: [season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 400 })],
  nationalTeam: null,
});
assert(record.rank === 1, '400 PL goals should be 1st');
assert(record.table?.[0]?.you, 'record holder should sit 1st');
assert(record.table?.[0]?.goals === 400, '1st row should show the player total');

const otherLeague = viewForBoard(pl, {
  seasons: [season({ clubId: 'bayern', league: 'Bundesliga', leagueGoals: 400 })],
  nationalTeam: null,
});
assert(otherLeague.playerGoals === 0, 'Bundesliga goals must not count on the Premier League board');

const cl = boards.find((b) => b.kind === 'champions-league')!;
const clGoals = playerGoalsForBoard(cl, {
  seasons: [
    season({
      clubId: 'arsenal',
      league: 'Premier League',
      leagueGoals: 20,
      continentalStats: [
        { cup: 'ucl', games: 12, goals: 17 },
        { cup: 'uel', games: 8, goals: 9 },
      ],
    }),
  ],
  nationalTeam: null,
});
assert(clGoals === 17, `UCL board should ignore Europa goals, got ${clGoals}`);

const wc = boards.find((b) => b.id === 'tournament:world-cup')!;
const wcLadder = historicalLadder(wc);
assert(wcLadder[0]!.goals === 16, 'World Cup record should be 16');
assert(wcLadder[1]!.goals === 15, 'World Cup 2nd should be 15, not a pile of 16s');
const team: NationalTeamState = {
  ...emptyTeam(),
  goals: 40,
  byCompetition: [
    { ...emptyCompetitionRecord('world-cup'), qualifyingGoals: 12, finalsGoals: 8, qualifyingGames: 10, finalsGames: 7 },
    { ...emptyCompetitionRecord('euro'), qualifyingGoals: 4, finalsGoals: 3, qualifyingGames: 6, finalsGames: 5 },
  ],
};
const wcView = viewForBoard(wc, { seasons: [], nationalTeam: team });
assert(wcView.playerGoals === 8, `World Cup board should use finals only, got ${wcView.playerGoals}`);

const intl = boards.find((b) => b.id === 'international:all-time')!;
const intlView = viewForBoard(intl, { seasons: [], nationalTeam: team });
assert(intlView.playerGoals === 40, `all-time international should use cap goals, got ${intlView.playerGoals}`);

const cup = boards.find((b) => b.id === 'cup:fa-cup')!;
const cupGoals = playerGoalsForBoard(cup, {
  seasons: [
    season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 10, cupGoals: 6 }),
    season({ clubId: 'barcelona', league: 'La Liga', leagueGoals: 10, cupGoals: 9 }),
  ],
  nationalTeam: null,
});
assert(cupGoals === 6, `FA Cup should ignore Copa del Rey goals, got ${cupGoals}`);

assert(ordinal(1) === '1st' && ordinal(2) === '2nd' && ordinal(3) === '3rd' && ordinal(11) === '11th', 'ordinals');
assert(revealForRank(1) === 'top10' && revealForRank(10) === 'top10', 'top 10 band');
assert(revealForRank(11) === 'listed' && revealForRank(99) === 'listed', 'listed band');
assert(revealForRank(100) === 'outside', '100+ band');

const totals = historicalTotals(10, 10);
assert(totals[0] === 10 && totals[98] === 10, 'flat ladders stay at the record total');
assert(rankForGoals(9, historicalLadder(pl)) > LEGACY_TABLE_SIZE, 'below 99th is 100+');

const input: LegacyCareerInput = {
  seasons: [season({ clubId: 'arsenal', league: 'Premier League', leagueGoals: 54, cupGoals: 12 })],
  nationalTeam: team,
  currentLeague: 'Premier League',
};
const career = careerLegacyBoards(input);
assert(career.some((board) => board.reveal === 'listed'), 'a 54-goal PL season should appear on a board');

console.log(`legacy records ok · ${boards.length} boards · PL 1st ${plLadder[0]!.name} ${plLadder[0]!.goals}`);
