/**
 * Dev-only balance tool for the season/career scaffolding: checks that the
 * chance-distribution engine really does average out to ~2 chances per
 * match (league and knockout alike), that decisive semi/final matches are
 * always exactly 1 chance, and that the WPY lottery clause fires at roughly
 * its stated 1-in-4 rate.
 *
 * Run with: npm run simulate:career
 */
import { buildSeasonCalendar } from '../src/game/career/calendar';
import {
  chancesForDecisiveMatch,
  chancesForKnockoutTie,
  chancesForLeagueMatch,
} from '../src/game/career/chanceEngine';
import { getClub } from '../src/game/career/data/clubs';
import { simulateClubMatch } from '../src/game/career/matchEngine';
import { hydrateSeason } from '../src/game/career/seasonSim';
import { evaluateWpy } from '../src/game/career/wpy';

const N = 50000;

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

console.log('--- League/group chance distribution (target average: 2.00) ---');
const leagueChances = Array.from({ length: N }, () => chancesForLeagueMatch().count);
console.log(`average = ${average(leagueChances).toFixed(3)} over ${N} matches`);
const histogram: Record<number, number> = {};
for (const c of leagueChances) histogram[c] = (histogram[c] ?? 0) + 1;
for (let c = 0; c <= 4; c++) {
  console.log(`  ${c} chances: ${(((histogram[c] ?? 0) / N) * 100).toFixed(1)}%`);
}

console.log('\n--- Knockout tie chance distribution (each leg 0-4, tie average: ~2/leg) ---');
const firstLegs: number[] = [];
const secondLegs: number[] = [];
for (let i = 0; i < N; i++) {
  const [first, second] = chancesForKnockoutTie();
  firstLegs.push(first.count);
  secondLegs.push(second.count);
}
console.log(`first leg average  = ${average(firstLegs).toFixed(3)}`);
console.log(`second leg average = ${average(secondLegs).toFixed(3)}`);
console.log(`tie average/leg    = ${((average(firstLegs) + average(secondLegs)) / 2).toFixed(3)}`);
const exampleTie = chancesForKnockoutTie();
console.log(`example tie: leg 1 = ${exampleTie[0].count}, leg 2 = ${exampleTie[1].count}`);

console.log('\n--- Decisive matches (semi-final / final): always exactly 1 chance ---');
const decisiveCounts = new Set(Array.from({ length: 1000 }, () => chancesForDecisiveMatch().count));
console.log(`distinct chance counts seen across 1000 draws: [${[...decisiveCounts].join(', ')}] (expect [1])`);

console.log('\n--- Season calendar shape (tier 1 UEFA club, season 2) ---');
const calendar = buildSeasonCalendar({ seasonNumber: 2, leagueMatchWeeks: 24, clubTier: 1, confederation: 'UEFA' });
console.log(`total weeks: ${calendar.totalWeeks}, fixtures: ${calendar.fixtures.length}`);
const kindCounts: Record<string, number> = {};
for (const f of calendar.fixtures) kindCounts[f.kind] = (kindCounts[f.kind] ?? 0) + 1;
console.log(kindCounts);

console.log('\n--- Season calendar shape (tier 4 UEFA club, season 3 - no continental football) ---');
const noEuropeCalendar = buildSeasonCalendar({ seasonNumber: 3, leagueMatchWeeks: 24, clubTier: 4, confederation: 'UEFA' });
console.log(`total weeks: ${noEuropeCalendar.totalWeeks}, fixtures: ${noEuropeCalendar.fixtures.length} (expect 24, all league)`);

console.log('\n--- WPY: elite ratio + trophy always wins ---');
console.log(
  evaluateWpy({
    seasonGoalRatio: 0.6,
    eliteRatioBar: 0.5,
    wonChampionsLeague: true,
    isInternationalTournamentYear: false,
    wonInternationalTournament: false,
    recentFormGoals: 20,
    recentFormGames: 40,
  }),
);

console.log('\n--- WPY: club trophy without ratio never wins (per locked design) ---');
console.log(
  evaluateWpy({
    seasonGoalRatio: 0.3,
    eliteRatioBar: 0.5,
    wonChampionsLeague: true,
    isInternationalTournamentYear: false,
    wonInternationalTournament: false,
    recentFormGoals: 20,
    recentFormGames: 40,
  }),
);

console.log('\n--- WPY: international tournament year - winning it trumps the Champions League ---');
console.log(
  evaluateWpy({
    seasonGoalRatio: 0.55,
    eliteRatioBar: 0.5,
    wonChampionsLeague: false,
    isInternationalTournamentYear: true,
    wonInternationalTournament: true,
    recentFormGoals: 20,
    recentFormGames: 40,
  }),
);

console.log('\n--- WPY: extreme form lottery (~1 goal/game over ~50 games) fires ~1-in-4 ---');
const lotteryContext = {
  seasonGoalRatio: 0.3,
  eliteRatioBar: 0.5,
  wonChampionsLeague: false,
  isInternationalTournamentYear: false,
  wonInternationalTournament: false,
  recentFormGoals: 55,
  recentFormGames: 52,
};
const lotteryTrials = 20000;
let lotteryWins = 0;
for (let i = 0; i < lotteryTrials; i++) {
  if (evaluateWpy(lotteryContext).won) lotteryWins++;
}
console.log(`won ${lotteryWins}/${lotteryTrials} = ${((lotteryWins / lotteryTrials) * 100).toFixed(1)}% (expect ~25%)`);

console.log('\n--- WPY: form below the 50-game / 1 GPG bar never gets the lottery ---');
console.log(
  evaluateWpy({
    ...lotteryContext,
    recentFormGames: 49,
  }),
);

console.log('\n--- Club match engine: better teams win more often, never always ---');
function winRate(us: 1 | 2 | 3 | 4 | 5, them: 1 | 2 | 3 | 4 | 5, n = 8000): string {
  let wins = 0;
  let draws = 0;
  for (let i = 0; i < n; i++) {
    const r = simulateClubMatch({ clubTier: us, opponentTier: them, isHome: true });
    if (r.outcome === 'win') wins++;
    else if (r.outcome === 'draw') draws++;
  }
  return `win=${((wins / n) * 100).toFixed(1)}% draw=${((draws / n) * 100).toFixed(1)}%`;
}
console.log('tier 1 vs tier 5 home:', winRate(1, 5));
console.log('tier 1 vs tier 1 home:', winRate(1, 1));
console.log('tier 5 vs tier 1 home:', winRate(5, 1));

console.log('\n--- Hydrated season 2 (elite club, strong previous ratio) ---');
const madrid = getClub('real-madrid');
if (madrid) {
  const { calendar, sim } = hydrateSeason({
    seasonNumber: 2,
    club: madrid,
    previousSeasonRatio: 0.8,
    nationId: 'spain',
  });
  const kinds: Record<string, number> = {};
  for (const f of calendar.fixtures) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
  const chanceAvg =
    calendar.fixtures.reduce((s, f) => s + (f.playerChances ?? 0), 0) / calendar.fixtures.length;
  console.log('fixtures', calendar.fixtures.length, kinds);
  console.log('european stage', sim.europeanStanding);
  console.log('international selected', sim.internationalSelected, sim.internationalStage);
  console.log('mean pre-assigned chances', chanceAvg.toFixed(2), '(expect ~2, decisive matches pull it slightly down)');
  const missingOpp = calendar.fixtures.filter((f) => !f.opponentLabel).length;
  console.log('fixtures missing an opponent', missingOpp, '(expect 0)');
}
