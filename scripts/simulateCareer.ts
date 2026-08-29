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
  meanChancesFromStrength,
} from '../src/game/career/chanceEngine';
import { getClub, goalRatioFromStrength } from '../src/game/career/data/clubs';
import { NATIONS, getNation } from '../src/game/career/data/nations';
import { internationalCampaignForSeason, internationalTournamentForSeason } from '../src/game/career/data/competitions';
import { simulateClubMatch, simulateLeagueSeason } from '../src/game/career/matchEngine';
import { hydrateSeason, resolveFixture, shouldSkipFixture } from '../src/game/career/seasonSim';
import { offerClubsForTrial } from '../src/game/career/trial';
import { resolveSeasonTransition } from '../src/game/career/transfers';
import { evaluateWpy } from '../src/game/career/wpy';
import type { SeasonRecord } from '../src/game/career/types';

const N = 50000;

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

console.log('--- League chance distribution scales with club strength ---');
function chanceStats(strength: number): { avg: number; hist: Record<number, number> } {
  const values = Array.from({ length: N }, () => chancesForLeagueMatch({ strength }).count);
  const hist: Record<number, number> = {};
  for (const c of values) hist[c] = (hist[c] ?? 0) + 1;
  return { avg: average(values), hist };
}
const eliteChances = chanceStats(94);
const weakChances = chanceStats(52);
console.log(`elite (94) average = ${eliteChances.avg.toFixed(3)} (target ~${meanChancesFromStrength(94).toFixed(2)})`);
console.log(`weak  (52) average = ${weakChances.avg.toFixed(3)} (target ~${meanChancesFromStrength(52).toFixed(2)})`);
for (let c = 0; c <= 4; c++) {
  console.log(`  elite ${c}: ${(((eliteChances.hist[c] ?? 0) / N) * 100).toFixed(1)}%   weak ${c}: ${(((weakChances.hist[c] ?? 0) / N) * 100).toFixed(1)}%`);
}
if (eliteChances.avg < 2.8) {
  console.error('elite clubs should average close to 3 chances a game');
  process.exitCode = 1;
}
if (weakChances.avg > 1.1 || weakChances.avg < 0.5) {
  console.error('weakest clubs should average about 0.8 chances a game');
  process.exitCode = 1;
}
if (eliteChances.avg - weakChances.avg < 1.5) {
  console.error('elite clubs must generate substantially more chances than the weakest');
  process.exitCode = 1;
}

console.log('\n--- Knockout tie chance distribution (each leg follows club strength) ---');
const firstLegs: number[] = [];
const secondLegs: number[] = [];
for (let i = 0; i < N; i++) {
  const [first, second] = chancesForKnockoutTie({ strength: 94 });
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

console.log('\n--- Season calendar shape (tier 1 UEFA club, season 2, Spain) ---');
const calendar = buildSeasonCalendar({
  seasonNumber: 2,
  leagueMatchWeeks: 24,
  clubTier: 1,
  confederation: 'UEFA',
  country: 'Spain',
  nationConfederation: 'UEFA',
});
console.log(`total weeks: ${calendar.totalWeeks}, fixtures: ${calendar.fixtures.length}`);
const kindCounts: Record<string, number> = {};
for (const f of calendar.fixtures) kindCounts[f.kind] = (kindCounts[f.kind] ?? 0) + 1;
console.log(kindCounts);
if ((kindCounts['domestic-cup'] ?? 0) !== 4) {
  console.error('expected 4 domestic-cup fixtures (Copa del Rey)');
  process.exitCode = 1;
}
const s2Intl = calendar.fixtures.filter((f) => f.kind === 'international');
const s2Rounds = s2Intl.map((f) => f.internationalRound);
console.log('season 2 international rounds', s2Rounds);
if (s2Rounds.filter((r) => r === 'qualifier').length !== 6 || !s2Rounds.includes('group') || !s2Rounds.includes('final')) {
  console.error('season 2 must interleave World Cup qualifiers and then play the World Cup');
  process.exitCode = 1;
}
if (calendar.internationalTournament !== 'world-cup' || calendar.internationalPhase !== 'qualifiers-and-tournament') {
  console.error('season 2 is a World Cup finals year');
  process.exitCode = 1;
}

console.log('\n--- Season 1 has no international football ---');
const s1Calendar = buildSeasonCalendar({
  seasonNumber: 1,
  leagueMatchWeeks: 24,
  clubTier: 1,
  confederation: 'UEFA',
  country: 'Spain',
  nationConfederation: 'UEFA',
});
const s1Intl = s1Calendar.fixtures.filter((f) => f.kind === 'international').length;
console.log('season 1 international fixtures', s1Intl, '(expect 0)');
if (s1Intl !== 0) {
  console.error('there must be no international matches in season 1');
  process.exitCode = 1;
}

console.log('\n--- Season calendar shape (tier 4 UEFA club, season 3 - no continental football) ---');
const noEuropeCalendar = buildSeasonCalendar({
  seasonNumber: 3,
  leagueMatchWeeks: 24,
  clubTier: 4,
  confederation: 'UEFA',
  country: 'Germany',
});
const noEuropeKinds: Record<string, number> = {};
for (const f of noEuropeCalendar.fixtures) noEuropeKinds[f.kind] = (noEuropeKinds[f.kind] ?? 0) + 1;
console.log(`total weeks: ${noEuropeCalendar.totalWeeks}, fixtures: ${noEuropeCalendar.fixtures.length}`, noEuropeKinds);
if ((noEuropeKinds.league ?? 0) !== 24 || (noEuropeKinds['domestic-cup'] ?? 0) !== 4) {
  console.error('expected 24 league + 4 DFB-Pokal fixtures');
  process.exitCode = 1;
}

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
  console.log('mean pre-assigned chances', chanceAvg.toFixed(2), `(elite club, target ~${meanChancesFromStrength(madrid.strength).toFixed(2)}; decisive matches pull it down)`);
  if (chanceAvg < 2.4) {
    console.error('Real Madrid should generate well above 2 chances a game on average');
    process.exitCode = 1;
  }
  const missingOpp = calendar.fixtures.filter((f) => !f.opponentLabel).length;
  console.log('fixtures missing an opponent', missingOpp, '(expect 0)');
  console.log('domestic cup', sim.domesticCup, sim.domesticCupStage, '(expect copa-del-rey, round-of-16)');
  console.log('international tournament', sim.internationalTournament, sim.internationalPhase, '(expect world-cup + finals)');
  if (sim.domesticCup !== 'copa-del-rey') {
    console.error('Madrid season 2 should include Copa del Rey');
    process.exitCode = 1;
  }
  if (sim.internationalTournament !== 'world-cup' || sim.internationalPhase !== 'qualifiers-and-tournament') {
    console.error('Spanish player in season 2 should play World Cup qualifying and the World Cup');
    process.exitCode = 1;
  }
  const intlFixtures = calendar.fixtures.filter((f) => f.kind === 'international');
  const clubTagged = intlFixtures.filter((f) => f.opponentId && getClub(f.opponentId));
  const nationTagged = intlFixtures.filter((f) => f.opponentId && getNation(f.opponentId));
  console.log('international opponents: nations', nationTagged.length, 'clubs', clubTagged.length, '(expect all nations)');
  if (clubTagged.length > 0 || nationTagged.length !== intlFixtures.length) {
    console.error('international fixtures must be country vs country, not club vs country');
    process.exitCode = 1;
  }

  let simState = sim;
  const firstQualifier = calendar.fixtures.find((f) => f.kind === 'international' && f.internationalRound === 'qualifier');
  if (firstQualifier && madrid) {
    const resolved = resolveFixture(simState, firstQualifier, madrid, 1);
    simState = resolved.sim;
    console.log('first qualifier summary', resolved.summary);
    if (!resolved.summary.includes('Spain') || resolved.summary.includes('Real Madrid')) {
      console.error('qualifier result must be Spain vs a country, not the club');
      process.exitCode = 1;
    }
  }
}

console.log('\n--- FIFA nations ---');
console.log(`nations: ${NATIONS.length} (expect 211)`);
if (NATIONS.length !== 211) {
  console.error(`expected 211 FIFA nations, got ${NATIONS.length}`);
  process.exitCode = 1;
}

console.log('\n--- International campaign cycle ---');
console.log('season 1', internationalCampaignForSeason(1, 'UEFA'));
console.log('season 2 Spain', internationalCampaignForSeason(2, 'UEFA'), internationalTournamentForSeason(2, 'UEFA'));
console.log('season 3 Spain', internationalCampaignForSeason(3, 'UEFA'));
console.log('season 4 Spain', internationalCampaignForSeason(4, 'UEFA'));
console.log('season 2 Brazil', internationalCampaignForSeason(2, 'CONMEBOL'));
console.log('season 4 Nigeria', internationalCampaignForSeason(4, 'CAF'));
if (internationalTournamentForSeason(1, 'UEFA') !== null) {
  console.error('season 1 must have no international tournament');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(2, 'UEFA').tournament !== 'world-cup') {
  console.error('season 2 is the World Cup');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(3, 'UEFA').tournament !== 'euro' || internationalCampaignForSeason(3, 'UEFA').phase !== 'qualifiers') {
  console.error('season 3 is Euro qualifying only');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(4, 'UEFA').tournament !== 'euro' || internationalCampaignForSeason(4, 'UEFA').phase !== 'qualifiers-and-tournament') {
  console.error('season 4 is the Euros');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(2, 'CONMEBOL').tournament !== 'world-cup') {
  console.error('Brazil season 2 is also the World Cup');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(4, 'CAF').tournament !== 'afcon') {
  console.error('season 4 CAF must be AFCON, not the World Cup');
  process.exitCode = 1;
}

const euroQualCalendar = buildSeasonCalendar({
  seasonNumber: 3,
  leagueMatchWeeks: 24,
  clubTier: 1,
  confederation: 'UEFA',
  country: 'Spain',
  nationConfederation: 'UEFA',
});
const euroQualRounds = euroQualCalendar.fixtures.filter((f) => f.kind === 'international').map((f) => f.internationalRound);
console.log('season 3 international rounds', euroQualRounds);
if (euroQualRounds.some((r) => r !== 'qualifier') || euroQualRounds.length !== 6) {
  console.error('season 3 must only schedule continental qualifiers, not the tournament');
  process.exitCode = 1;
}

const euroFinalsCalendar = buildSeasonCalendar({
  seasonNumber: 4,
  leagueMatchWeeks: 24,
  clubTier: 1,
  confederation: 'UEFA',
  country: 'Spain',
  nationConfederation: 'UEFA',
});
const euroFinalsRounds = euroFinalsCalendar.fixtures.filter((f) => f.kind === 'international').map((f) => f.internationalRound);
console.log('season 4 international rounds', euroFinalsRounds);
if (!euroFinalsRounds.includes('qualifier') || !euroFinalsRounds.includes('final')) {
  console.error('season 4 must have Euro qualifiers during the season and the tournament at the end');
  process.exitCode = 1;
}

console.log('\n--- FIFA rankings decide who reaches the finals ---');
const madridClub = getClub('real-madrid');
if (madridClub) {
  function playInternationalSeason(nationId: string, seasonNumber: number): string {
    const { calendar, sim } = hydrateSeason({
      seasonNumber,
      club: madridClub!,
      previousSeasonRatio: 0.8,
      nationId,
    });
    let state = sim;
    for (const fixture of calendar.fixtures) {
      if (fixture.kind !== 'international' || shouldSkipFixture(fixture, state)) continue;
      state = resolveFixture(state, fixture, madridClub!, 0).sim;
    }
    return state.internationalStage;
  }
  const spainStages = Array.from({ length: 12 }, () => playInternationalSeason('spain', 2));
  const sanMarinoStages = Array.from({ length: 12 }, () => playInternationalSeason('san-marino', 2));
  const spainOk = spainStages.filter((s) => s !== 'failed-qualifying' && s !== 'qualifying').length;
  const sanMarinoFail = sanMarinoStages.filter((s) => s === 'failed-qualifying').length;
  console.log(`Spain reached World Cup ${spainOk}/12`, spainStages);
  console.log(`San Marino failed qualifying ${sanMarinoFail}/12`, sanMarinoStages);
  if (spainOk < 10) {
    console.error('Spain should almost always qualify for the World Cup on ranking');
    process.exitCode = 1;
  }
  if (sanMarinoFail < 10) {
    console.error('San Marino should almost never qualify for the World Cup');
    process.exitCode = 1;
  }
}

console.log('\n--- Goal ratio bars follow club strength (0.75 elite → 0.25 weakest) ---');
const city = getClub('man-city');
const mainz = getClub('mainz');
const luton = getClub('luton');
console.log('Man City', city?.firstTeamGoalRatio, city?.reserveGoalRatio, '(expect 0.75)');
console.log('Mainz', mainz?.firstTeamGoalRatio, '(between City and Luton)');
console.log('Luton', luton?.firstTeamGoalRatio, luton?.reserveGoalRatio, '(expect 0.25)');
if (city?.firstTeamGoalRatio !== 0.75 || city.reserveGoalRatio !== 0.75) {
  console.error('Top clubs must require 0.75 goals/game');
  process.exitCode = 1;
}
if (luton?.firstTeamGoalRatio !== 0.25 || luton.reserveGoalRatio !== 0.25) {
  console.error('Lowest clubs must require 0.25 goals/game');
  process.exitCode = 1;
}
if (!mainz || mainz.firstTeamGoalRatio <= 0.25 || mainz.firstTeamGoalRatio >= 0.75) {
  console.error('Mainz should sit between the elite and weakest ratio bars');
  process.exitCode = 1;
}
if (goalRatioFromStrength(94) !== 0.75 || goalRatioFromStrength(52) !== 0.25) {
  console.error('goalRatioFromStrength endpoints drifted');
  process.exitCode = 1;
}

console.log('\n--- Trial offers: German nationality gets 2/3 German clubs ---');
let germanTrials = 0;
let germanTierOk = 0;
for (let i = 0; i < 80; i++) {
  const offers = offerClubsForTrial(5, 3, 'germany');
  const home = offers.filter((c) => c.country === 'Germany');
  if (home.length >= 2 && offers.length === 3) germanTrials += 1;
  if (home.every((c) => Math.abs(c.tier - 3) <= 1)) germanTierOk += 1;
}
console.log(`2-of-3 German: ${germanTrials}/80; home clubs within a band of earned tier: ${germanTierOk}/80`);
if (germanTrials < 80) {
  console.error('German trial offers must include 2 clubs from Germany');
  process.exitCode = 1;
}
if (germanTierOk < 80) {
  console.error('Home trial offers must stay near the tier the trial earned');
  process.exitCode = 1;
}

console.log('\n--- Transfer offers: at least one home-nation club ---');
const dummySeason: SeasonRecord = {
  seasonNumber: 2,
  clubId: 'bayern',
  role: 'first-team',
  matches: [],
  goals: 2,
  gamesPlayed: 24,
  ratioMet: false,
};
const sale = resolveSeasonTransition({
  season: dummySeason,
  role: 'first-team',
  clubId: 'bayern',
  parentClubId: 'bayern',
  seasonsAtCurrentClub: 1,
  age: 20,
  careerGoals: 2,
  careerGames: 24,
  nationality: 'germany',
});
const saleClubs = sale.pendingTransfer?.clubIds ?? [];
const saleHome = saleClubs.filter((id) => getClub(id)?.country === 'Germany').length;
console.log('sale offers', saleClubs, `home=${saleHome}`);
if (saleHome < 1) {
  console.error('German player sale offers must include at least one German club');
  process.exitCode = 1;
}

console.log('\n--- Bundesliga hierarchy: Mainz must almost never win the title ---');
const leagueTrials = 400;
const titleCounts: Record<string, number> = {};
for (let i = 0; i < leagueTrials; i++) {
  const table = simulateLeagueSeason('Bundesliga', 24);
  const champ = table[0]?.clubId ?? 'none';
  titleCounts[champ] = (titleCounts[champ] ?? 0) + 1;
}
const rankedTitles = Object.entries(titleCounts).sort((a, b) => b[1] - a[1]);
for (const [id, n] of rankedTitles) {
  console.log(`  ${id}: ${((n / leagueTrials) * 100).toFixed(1)}%`);
}
const mainzRate = (titleCounts.mainz ?? 0) / leagueTrials;
const bayernRate = (titleCounts.bayern ?? 0) / leagueTrials;
console.log(`Mainz titles ${((mainzRate) * 100).toFixed(2)}% (expect < 2%), Bayern ${((bayernRate) * 100).toFixed(1)}%`);
if (mainzRate > 0.02) {
  console.error('Mainz is winning the Bundesliga too often — strength gap is too small');
  process.exitCode = 1;
}
if (bayernRate < 0.45) {
  console.error('Bayern should be clear favourites in this pyramid');
  process.exitCode = 1;
}
