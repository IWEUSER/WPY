/**
 * Dev-only balance tool for the season/career scaffolding: checks that the
 * chance-distribution engine really does average out to ~2 chances per
 * match (league and knockout alike), that decisive semi/final matches are
 * always exactly 1 chance, and that the WPY lottery clause fires at roughly
 * its stated 1-in-4 rate.
 *
 * Run with: npm run simulate:career
 */
import { buildSeasonCalendar, INTERNATIONAL_BREAK_WEEKS, isFinalFixture, tournamentWeekCount } from '../src/game/career/calendar';
import { INJURY_CHANCE_PER_MATCH, injuryDuration } from '../src/game/career/injury';
import {
  chancesForDecisiveMatch,
  chancesForKnockoutTie,
  chancesForLeagueMatch,
  meanChancesFromStrength,
} from '../src/game/career/chanceEngine';
import { assignClubTier, CLUBS, clubsForSeason, clubsInLeague, earnedPromotion, getClub, goalRatioFromStrength, leagueMatchWeeks, TARGET_LEAGUE_SIZE, TIER_LABEL } from '../src/game/career/data/clubs';
import { consecutivePoorFactor, contractValueFactor, formAdjustedRatio, loanContractYearsRemaining, maxContractYearsForAge, playerMarketValue, playerMarketValueFromSeasons, RESERVE_CONTRACT_YEARS, seasonalSponsorship, tierForMarketValue, weeklyWageForClub, YOUTH_MARKET_VALUE } from '../src/game/career/playerValue';
import { NATIONS, getNation } from '../src/game/career/data/nations';
import { internationalCampaignForSeason, internationalTournamentForSeason } from '../src/game/career/data/competitions';
import { fifaRank } from '../src/game/career/data/fifaRankings';
import { displaySeasonLabel, displaySeasonNumber } from '../src/game/career/seasonDisplay';
import { isSelectedForNationalTeam, selectionRatioForNation } from '../src/game/career/international';
import { simulateClubMatch, simulateLeagueSeason } from '../src/game/career/matchEngine';
import { leaguePhaseOpponents } from '../src/game/career/continentalDraw';
import { canWinLeague, hydrateSeason, nextPlayableFixture, pickTitleRival, resolveFixture, shouldSkipFixture } from '../src/game/career/seasonSim';
import { offerClubsForTrial } from '../src/game/career/trial';
import { offerTierFromStanding, resolveSeasonTransition } from '../src/game/career/transfers';
import { evaluateWpy } from '../src/game/career/wpy';
import {
  evaluatePlayerOfTheYear,
  evaluateTopGoalscorer,
  goldenBootTarget,
  goldenBootWinChance,
  playerOfTheYearGoalTarget,
} from '../src/game/career/domesticAwards';
import { careerAwardCounts, careerTrophyCounts, formatGamesGoals, seasonLeagueLabel } from '../src/game/career/honoursDisplay';
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
  leagueMatchWeeks: leagueMatchWeeks('La Liga'),
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
const expectedWc = [
  'qualifier',
  'qualifier',
  'qualifier',
  'group',
  'group',
  'group',
  'round-of-32',
  'round-of-16',
  'quarter-final',
  'semi-final',
  'final',
];
if (s2Rounds.join() !== expectedWc.join()) {
  console.error('season 2 must play the remaining World Cup qualifiers then a 32-team World Cup');
  process.exitCode = 1;
}
if (calendar.internationalTournament !== 'world-cup' || calendar.internationalPhase !== 'qualifiers-and-tournament') {
  console.error('season 2 is a World Cup finals year');
  process.exitCode = 1;
}

const leagueWeeks = leagueMatchWeeks('La Liga');
const lastLeague = Math.max(...calendar.fixtures.filter((f) => f.kind === 'league').map((f) => f.week));
const cupFinalWeek = calendar.fixtures.find((f) => f.kind === 'domestic-cup' && f.domesticCupStage === 'final')?.week;
const euroFinalWeek = calendar.fixtures.find((f) => f.kind === 'continental-final')?.week;
const restWeeks = calendar.fixtures.filter((f) => f.kind === 'rest').map((f) => f.week);
const tournamentWeeks = [...new Set(calendar.fixtures.filter((f) => f.kind === 'international' && f.internationalRound !== 'qualifier').map((f) => f.week))];
const lateKnockout = calendar.fixtures.filter(
  (f) =>
    (f.kind === 'continental-knockout' || f.kind === 'continental-semi-final') &&
    f.week > leagueWeeks,
);
console.log('week shape', {
  total: calendar.totalWeeks,
  lastLeague,
  cupFinalWeek,
  euroFinalWeek,
  restWeeks,
  tournamentWeeks,
});
if (lastLeague !== leagueWeeks || cupFinalWeek !== leagueWeeks + 1 || euroFinalWeek !== leagueWeeks + 2) {
  console.error('cup final must follow the last league game; European final is the last club week');
  process.exitCode = 1;
}
if (restWeeks.length !== INTERNATIONAL_BREAK_WEEKS || (euroFinalWeek != null && restWeeks[0] !== euroFinalWeek + 1)) {
  console.error('national tournaments must start after a 3-week break from the European final');
  process.exitCode = 1;
}
if (tournamentWeeks.length !== tournamentWeekCount('world-cup')) {
  console.error('World Cup finals must occupy 5 weeks');
  process.exitCode = 1;
}
if (calendar.totalWeeks !== leagueWeeks + 1 + 1 + INTERNATIONAL_BREAK_WEEKS + tournamentWeekCount('world-cup')) {
  console.error(`La Liga World Cup season must be ${leagueWeeks + 1 + 1 + INTERNATIONAL_BREAK_WEEKS + 5} weeks`);
  process.exitCode = 1;
}
if (lateKnockout.length > 0) {
  console.error('continental knockouts before the final must sit inside the league weeks');
  process.exitCode = 1;
}

console.log('\n--- Season 1 has no international football ---');
const s1Calendar = buildSeasonCalendar({
  seasonNumber: 1,
  leagueMatchWeeks: leagueMatchWeeks('La Liga'),
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
  leagueMatchWeeks: leagueMatchWeeks('2. Bundesliga'),
  clubTier: 4,
  confederation: 'UEFA',
  country: 'Germany',
});
const noEuropeKinds: Record<string, number> = {};
for (const f of noEuropeCalendar.fixtures) noEuropeKinds[f.kind] = (noEuropeKinds[f.kind] ?? 0) + 1;
console.log(`total weeks: ${noEuropeCalendar.totalWeeks}, fixtures: ${noEuropeCalendar.fixtures.length}`, noEuropeKinds);
if ((noEuropeKinds.league ?? 0) !== leagueMatchWeeks('2. Bundesliga') || (noEuropeKinds['domestic-cup'] ?? 0) !== 4) {
  console.error('expected a full 2. Bundesliga season + 4 DFB-Pokal fixtures');
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

console.log('\n--- Domestic awards: golden boot target + randomiser, POTY needs the league ---');
const plTarget = goldenBootTarget('Premier League');
const plPoty = playerOfTheYearGoalTarget('Premier League');
console.log(`Premier League golden boot ${plTarget}, POTY bar ${plPoty}`);
if (plTarget !== 25 || plPoty >= plTarget || plPoty < 16) {
  console.error('Premier League golden boot must start at 25, with POTY below that');
  process.exitCode = 1;
}
const below = Array.from({ length: 80 }, () => evaluateTopGoalscorer(22, 'Premier League').won);
if (below.some(Boolean)) {
  console.error('22 Premier League goals must never win the golden boot');
  process.exitCode = 1;
}
const exactTrials = 2000;
let exactWins = 0;
for (let i = 0; i < exactTrials; i++) {
  if (evaluateTopGoalscorer(plTarget, 'Premier League').won) exactWins += 1;
}
const exactRate = exactWins / exactTrials;
console.log(`exactly ${plTarget} goals won ${exactWins}/${exactTrials} = ${(exactRate * 100).toFixed(1)}% (expect ~${(goldenBootWinChance(plTarget, plTarget) * 100).toFixed(0)}%)`);
if (exactRate < 0.4 || exactRate > 0.6) {
  console.error('25 Premier League goals must be a medium-chance golden boot, not a lock');
  process.exitCode = 1;
}
let thirtyWins = 0;
for (let i = 0; i < exactTrials; i++) {
  if (evaluateTopGoalscorer(30, 'Premier League').won) thirtyWins += 1;
}
const thirtyRate = thirtyWins / exactTrials;
let thirtyOneWins = 0;
for (let i = 0; i < exactTrials; i++) {
  if (evaluateTopGoalscorer(31, 'Premier League').won) thirtyOneWins += 1;
}
console.log(`30 PL goals ${(thirtyRate * 100).toFixed(1)}%, 31 ${(thirtyOneWins / exactTrials * 100).toFixed(1)}%`);
if (thirtyRate < 0.78 || thirtyOneWins / exactTrials <= thirtyRate) {
  console.error('30 Premier League goals should be likely, and 31 even likelier');
  process.exitCode = 1;
}
const noTitle = evaluatePlayerOfTheYear({ leagueChampion: false, leagueGoals: 30, league: 'Premier League' });
const titleLow = evaluatePlayerOfTheYear({ leagueChampion: true, leagueGoals: plPoty - 1, league: 'Premier League' });
const titleHigh = evaluatePlayerOfTheYear({ leagueChampion: true, leagueGoals: plPoty, league: 'Premier League' });
console.log('POTY no title', noTitle.won, 'title but low goals', titleLow.won, 'title + bar', titleHigh.won);
if (noTitle.won || titleLow.won || !titleHigh.won) {
  console.error('Player of the Year needs the league title and the lower goal bar');
  process.exitCode = 1;
}

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
    careerGoalRatio: 0.8,
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
  const missingOpp = calendar.fixtures.filter((f) => f.kind !== 'rest' && !f.opponentLabel).length;
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
if (euroQualRounds.some((r) => r !== 'qualifier') || euroQualRounds.length !== 3) {
  console.error('season 3 must only schedule the first half of continental qualifiers');
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
const expectedEuro = [
  'qualifier',
  'qualifier',
  'qualifier',
  'group',
  'group',
  'group',
  'round-of-16',
  'quarter-final',
  'semi-final',
  'final',
];
if (euroFinalsRounds.join() !== expectedEuro.join()) {
  console.error('season 4 must finish Euro qualifying then play 3 group games and a last-16 knockout');
  process.exitCode = 1;
}
const euroFinalsWeeks = [...new Set(euroFinalsCalendar.fixtures.filter((f) => f.kind === 'international' && f.internationalRound !== 'qualifier').map((f) => f.week))];
if (euroFinalsWeeks.length !== tournamentWeekCount('euro')) {
  console.error('non-World Cup tournaments must occupy 4 weeks');
  process.exitCode = 1;
}
if (euroFinalsRounds.includes('round-of-32')) {
  console.error('continental tournaments do not have a last 32');
  process.exitCode = 1;
}

console.log('\n--- FIFA rankings decide who reaches the finals ---');
const madridClub = getClub('real-madrid');
if (madridClub) {
  function playInternationalSeason(nationId: string, seasonNumber: number): string {
    const { calendar, sim } = hydrateSeason({
      seasonNumber,
      club: madridClub!,
      careerGoalRatio: 0.8,
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

if (internationalCampaignForSeason(2, 'UEFA').qualifierGames !== 3) {
  console.error('season 2 World Cup qualifying must be the remaining half (3 games)');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(3, 'UEFA').qualifierGames !== 3) {
  console.error('season 3 Euro qualifying must be the first half (3 games)');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(4, 'UEFA').qualifierGames !== 3) {
  console.error('season 4 Euro qualifying must be the second half (3 games)');
  process.exitCode = 1;
}

console.log('\n--- Display seasons skip the reserve year ---');
console.log('internal 1', displaySeasonLabel(1), displaySeasonNumber(1));
console.log('internal 2', displaySeasonLabel(2), displaySeasonNumber(2));
if (displaySeasonNumber(1) !== null || displaySeasonLabel(1) !== 'Reserves') {
  console.error('internal season 1 is the reserve year and must not show as Season 1');
  process.exitCode = 1;
}
if (displaySeasonNumber(2) !== 1) {
  console.error('internal season 2 is the first public season');
  process.exitCode = 1;
}

console.log('\n--- International selection uses career ratio, nation rank, and club level ---');
console.log('Spain bar', selectionRatioForNation('spain'), '(expect 0.66)');
console.log('San Marino bar', selectionRatioForNation('san-marino'));
if (selectionRatioForNation('spain') !== 0.66) {
  console.error('top-ranked countries must require a 0.66 career ratio');
  process.exitCode = 1;
}
const spainPick = isSelectedForNationalTeam({ clubTier: 1, careerGoalRatio: 0.66, nationId: 'spain' });
const spainMiss = isSelectedForNationalTeam({ clubTier: 1, careerGoalRatio: 0.65, nationId: 'spain' });
const lutonPick = isSelectedForNationalTeam({ clubTier: 5, careerGoalRatio: 1, nationId: 'spain' });
console.log('Spain 0.66 at Madrid', spainPick, 'Spain 0.65', spainMiss, 'Spain 1.00 at Luton', lutonPick);
if (!spainPick || spainMiss || lutonPick) {
  console.error('selection must use 0.66 for Spain and never pick lower-league players');
  process.exitCode = 1;
}

const lutonClub = getClub('luton');
if (lutonClub) {
  const hydrated = hydrateSeason({
    seasonNumber: 2,
    club: lutonClub,
    careerGoalRatio: 1,
    nationId: 'spain',
  });
  console.log('Luton S2 intl selected', hydrated.sim.internationalSelected, '(expect false)');
  if (hydrated.sim.internationalSelected) {
    console.error('tier 5 clubs must never receive international fixtures');
    process.exitCode = 1;
  }
}

console.log('\n--- Qualifying opponents are mixed by ranking, not a gauntlet of #1s ---');
if (madrid) {
  const { calendar } = hydrateSeason({
    seasonNumber: 2,
    club: madrid,
    careerGoalRatio: 0.8,
    nationId: 'spain',
  });
  const intl = calendar.fixtures.filter((f) => f.kind === 'international' && f.opponentId);
  const quals = intl.filter((f) => f.internationalRound === 'qualifier');
  const finals = intl.filter((f) => f.internationalRound !== 'qualifier');
  const ranks = intl.map((f) => fifaRank(f.opponentId!));
  console.log(
    'Spain WC opponents',
    intl.map((f) => `${f.internationalRound} ${f.opponentLabel} (#${fifaRank(f.opponentId!)})`),
  );
  const qualRanks = quals.map((f) => fifaRank(f.opponentId!));
  if (qualRanks.length === 0 || qualRanks.every((r) => r <= 10)) {
    console.error('World Cup qualifying must mix in sides outside the world top 10');
    process.exitCode = 1;
  }
  if (!qualRanks.some((r) => r > 25)) {
    console.error('at least one qualifier should sit outside the world top 25');
    process.exitCode = 1;
  }
  if (new Set(quals.map((f) => f.opponentId)).size < quals.length) {
    console.error('qualifier opponents should not repeat');
    process.exitCode = 1;
  }
  if (new Set(finals.map((f) => f.opponentId)).size < finals.length) {
    console.error('World Cup opponents should not repeat');
    process.exitCode = 1;
  }
  if (!ranks.some((r) => r > 20)) {
    console.error('at least one opponent should sit outside the world top 20');
    process.exitCode = 1;
  }
}

console.log('\n--- Season 3 does not decide qualification; season 4 uses the carried half ---');
if (madridClub) {
  const s3 = hydrateSeason({
    seasonNumber: 3,
    club: madridClub,
    careerGoalRatio: 0.8,
    nationId: 'spain',
  });
  let s3State = s3.sim;
  for (const fixture of s3.calendar.fixtures) {
    if (fixture.kind !== 'international' || shouldSkipFixture(fixture, s3State)) continue;
    s3State = resolveFixture(s3State, fixture, madridClub, 0).sim;
  }
  console.log('S3 stage after last qualifier', s3State.internationalStage, 'pts', s3State.qualifierPoints, 'played', s3State.qualifierPlayed);
  if (s3State.internationalStage === 'failed-qualifying' || s3State.internationalStage === 'group' || s3State.nationQualified) {
    console.error('season 3 must not qualify or fail — it is only the first half of the campaign');
    process.exitCode = 1;
  }
  if (s3State.qualifierPlayed !== 3) {
    console.error('season 3 must play three continental qualifiers');
    process.exitCode = 1;
  }

  const s4 = hydrateSeason({
    seasonNumber: 4,
    club: madridClub,
    careerGoalRatio: 0.8,
    nationId: 'spain',
    qualifierCarry: {
      tournament: 'euro',
      points: s3State.qualifierPoints,
      played: s3State.qualifierPlayed,
    },
  });
  console.log('S4 carry', s4.sim.qualifierCarryPoints, s4.sim.qualifierCarryPlayed, 'target', s4.sim.qualifierTarget);
  if (s4.sim.qualifierCarryPlayed !== 3 || s4.sim.qualifierTarget !== 3) {
    console.error('season 4 must seed the first half of qualifying and play the second half');
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
  age: 20,
  leagueGoals: 2,
  trophies: [],
  topGoalscorer: false,
  playerOfTheYear: false,
  wonWpy: false,
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
  loansUsed: 0,
});
const saleClubs = sale.pendingTransfer?.clubIds ?? [];
const saleHome = saleClubs.filter((id) => getClub(id)?.country === 'Germany').length;
const saleLoans = (sale.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan').length;
const salePerms = (sale.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent');
const saleTiers = salePerms.map((o) => getClub(o.clubId)?.tier ?? 5);
console.log('sale offers', saleClubs, `home=${saleHome}`, 'loans', saleLoans, 'tiers', saleTiers);
if (saleHome < 1) {
  console.error('German player sale offers must include at least one German club');
  process.exitCode = 1;
}
if (saleLoans !== 3 || salePerms.length !== 3) {
  console.error('a failed first-team season must offer 3 loans and 3 transfers');
  process.exitCode = 1;
}
if (saleTiers.some((tier) => tier >= 5)) {
  console.error('sale destinations must not include the lowest clubs in the game');
  process.exitCode = 1;
}

console.log('\n--- Global club hierarchy: MLS never elite, Saudi above MLS ---');
const lafc = getClub('lafc');
const hilal = getClub('al-hilal');
const barca = getClub('barcelona');
console.log('LAFC', lafc?.tier, TIER_LABEL[lafc?.tier ?? 5], 'Hilal', hilal?.tier, 'Barca', barca?.tier);
if (!lafc || lafc.tier <= 2) {
  console.error('MLS clubs must never be Elite or Strong');
  process.exitCode = 1;
}
if (!hilal || hilal.tier === 1 || hilal.tier > (lafc.tier)) {
  console.error('Saudi clubs must not be Elite, but should rank above MLS');
  process.exitCode = 1;
}
if (assignClubTier('United States', 'MLS', 94) < 3 || assignClubTier('Saudi Arabia', 'Saudi Pro League', 94) === 1) {
  console.error('league caps must keep MLS off the elite tier and Saudi off Elite');
  process.exitCode = 1;
}

console.log('\n--- League opponents home and away, never a third meeting ---');
const playableLeagues = [...new Set(CLUBS.map((c) => c.league))];
for (const league of playableLeagues) {
  const size = clubsInLeague(league).length;
  const target = TARGET_LEAGUE_SIZE[league];
  if (!target || size !== target) {
    console.error(`${league} has ${size} clubs; need ${target ?? 'a real division size'}`);
    process.exitCode = 1;
  }
}
if (madrid) {
  const { calendar } = hydrateSeason({ seasonNumber: 2, club: madrid, careerGoalRatio: 0.8, nationId: 'spain' });
  const league = calendar.fixtures.filter((f) => f.kind === 'league' && f.opponentId);
  const counts: Record<string, number> = {};
  for (const f of league) counts[f.opponentId!] = (counts[f.opponentId!] ?? 0) + 1;
  const rivals = clubsInLeague(madrid.league).filter((c) => c.id !== madrid.id);
  console.log('La Liga size', rivals.length + 1, 'league games', league.length, counts);
  if (rivals.length !== TARGET_LEAGUE_SIZE['La Liga'] - 1) {
    console.error('La Liga must have 20 clubs so every rival is played home and away');
    process.exitCode = 1;
  }
  if (Object.values(counts).some((n) => n !== 2) || Object.keys(counts).length !== rivals.length) {
    console.error('every league rival must appear exactly twice');
    process.exitCode = 1;
  }
}

console.log('\n--- Transfer value: 18 at Barcelona 0.9 is ~€200m, then fades after 27 ---');
if (barca && hilal && lafc) {
  const young = playerMarketValue({ age: 18, ratio: 0.9, careerGoals: 22, club: barca });
  const faded = playerMarketValue({ age: 30, ratio: 0.9, careerGoals: 22, club: barca });
  const worse = playerMarketValue({ age: 18, ratio: 0.45, careerGoals: 22, club: barca });
  console.log('Barca 18/0.9', young, '30/0.9', faded, '18/0.45', worse);
  if (young < 170_000_000 || young > 230_000_000) {
    console.error('an 18-year-old Barcelona 0.9 should be worth about €200m');
    process.exitCode = 1;
  }
  if (faded >= young * 0.7) {
    console.error('value must drop after 27 even with the same ratio');
    process.exitCode = 1;
  }
  if (worse >= young * 0.7) {
    console.error('a worse ratio must cut the fee');
    process.exitCode = 1;
  }
  const mlsSpell = playerMarketValue({ age: 18, ratio: 0.9, careerGoals: 22, club: lafc });
  if (mlsSpell >= young * 0.5) {
    console.error('goals in MLS must be worth less than the same spell at Barcelona');
    process.exitCode = 1;
  }
  const mixed = playerMarketValueFromSeasons({
    age: 19,
    careerGoals: 40,
    careerGames: 48,
    seasons: [
      { ...dummySeason, seasonNumber: 2, clubId: 'barcelona', goals: 20, gamesPlayed: 24 },
      { ...dummySeason, seasonNumber: 3, clubId: 'lafc', goals: 20, gamesPlayed: 24 },
    ],
    fallbackClub: lafc,
  });
  const allBarca = playerMarketValueFromSeasons({
    age: 19,
    careerGoals: 40,
    careerGames: 48,
    seasons: [
      { ...dummySeason, seasonNumber: 2, clubId: 'barcelona', goals: 20, gamesPlayed: 24 },
      { ...dummySeason, seasonNumber: 3, clubId: 'barcelona', goals: 20, gamesPlayed: 24 },
    ],
    fallbackClub: barca,
  });
  console.log('MLS spell', mlsSpell, 'mixed Barca/MLS', mixed, 'all Barca', allBarca);
  if (mixed >= allBarca || mixed <= mlsSpell) {
    console.error('value must sit between MLS and Barcelona when goals are split across both');
    process.exitCode = 1;
  }
  const euroWage = weeklyWageForClub(barca, young);
  const saudiWage = weeklyWageForClub(hilal, young);
  const mlsWage = weeklyWageForClub(lafc, young);
  const luton = getClub('luton');
  const villa = getClub('atletico-madrid') ?? getClub('arsenal');
  const lowWage = luton ? weeklyWageForClub(luton, young) : 0;
  const highWage = villa ? weeklyWageForClub(villa, young) : 0;
  console.log('wages Barca', euroWage, 'Hilal', saudiWage, 'LAFC', mlsWage, 'low', lowWage, 'high-tier', highWage);
  if (saudiWage < highWage * 0.8) {
    console.error('Saudi wages should sit with high-tier Europe, not the elite band');
    process.exitCode = 1;
  }
  if (saudiWage >= euroWage * 0.6) {
    console.error('Saudi wages must stay below elite European salaries');
    process.exitCode = 1;
  }
  if (mlsWage >= saudiWage) {
    console.error('MLS wages must sit below Saudi');
    process.exitCode = 1;
  }
  if (lowWage > 5_000) {
    console.error('lowest-level weekly wages must sit well below €5k');
    process.exitCode = 1;
  }
  const palace = getClub('crystal-palace');
  const leicester = getClub('leicester');
  const palaceWage = palace ? weeklyWageForClub(palace, 8_000_000) : 0;
  const champWage = leicester ? weeklyWageForClub(leicester, 8_000_000) : 0;
  const promotedWage = leicester ? weeklyWageForClub(leicester, 8_000_000, 'Premier League') : 0;
  console.log('PL Palace wage', palaceWage, 'Championship Leicester', champWage, 'Leicester in PL', promotedWage);
  if (palaceWage < 32_000 || promotedWage < 32_000 || promotedWage <= champWage * 3) {
    console.error('Premier League wages must sit far above Championship money, even at smaller clubs');
    process.exitCode = 1;
  }
  if (highWage <= 0 || euroWage < highWage * 2.5) {
    console.error('elite weekly wages must sit well above a high-tier club');
    process.exitCode = 1;
  }

  const starSeasons = [
    { ...dummySeason, seasonNumber: 2, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
    { ...dummySeason, seasonNumber: 3, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
    { ...dummySeason, seasonNumber: 4, clubId: 'barcelona', goals: 3, gamesPlayed: 38 },
  ];
  const starAfterCollapse = playerMarketValueFromSeasons({
    age: 20,
    careerGoals: 83,
    careerGames: 138,
    seasons: starSeasons,
    fallbackClub: barca,
  });
  const starKeptForm = playerMarketValueFromSeasons({
    age: 20,
    careerGoals: 83,
    careerGames: 138,
    seasons: [
      starSeasons[0],
      starSeasons[1],
      { ...dummySeason, seasonNumber: 4, clubId: 'barcelona', goals: 28, gamesPlayed: 38 },
    ],
    fallbackClub: barca,
  });
  console.log('form-adjusted', formAdjustedRatio(83 / 138, 3 / 38), 'collapse', starAfterCollapse, 'kept form', starKeptForm);
  if (starAfterCollapse >= starKeptForm * 0.8) {
    console.error('a 0.08 season must cut a star’s fee substantially');
    process.exitCode = 1;
  }
  if (starAfterCollapse < 40_000_000) {
    console.error('a star’s career ratio should keep them well above the bottom of the market');
    process.exitCode = 1;
  }
  const starSale = resolveSeasonTransition({
    season: starSeasons[2],
    role: 'first-team',
    clubId: 'barcelona',
    parentClubId: 'barcelona',
    seasonsAtCurrentClub: 2,
    age: 20,
    careerGoals: 83,
    careerGames: 138,
    nationality: 'spain',
    loansUsed: 0,
    seasonHistory: starSeasons.slice(0, 2),
  });
  const starPermTiers = (starSale.pendingTransfer?.offers ?? [])
    .filter((o) => o.move === 'permanent')
    .map((o) => getClub(o.clubId)?.tier ?? 5);
  const starLoanCount = (starSale.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan').length;
  console.log('star sale loans', starLoanCount, 'perm tiers', starPermTiers);
  if (starLoanCount !== 3) {
    console.error('a failed ratio at Barcelona must still offer loans back to the parent club');
    process.exitCode = 1;
  }
  if (starPermTiers.some((tier) => tier >= 4)) {
    console.error('a high-value player must not be offered lower-league or smallest clubs');
    process.exitCode = 1;
  }

  const fiveYear = playerMarketValueFromSeasons({
    age: 20,
    careerGoals: 80,
    careerGames: 100,
    seasons: [
      { ...dummySeason, seasonNumber: 2, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
      { ...dummySeason, seasonNumber: 3, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
    ],
    fallbackClub: barca,
    contractYearsRemaining: 5,
  });
  const oneYear = playerMarketValueFromSeasons({
    age: 20,
    careerGoals: 80,
    careerGames: 100,
    seasons: [
      { ...dummySeason, seasonNumber: 2, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
      { ...dummySeason, seasonNumber: 3, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
    ],
    fallbackClub: barca,
    contractYearsRemaining: 1,
  });
  console.log('contract 5yr', fiveYear, '1yr', oneYear, 'factor', contractValueFactor(1));
  if (oneYear > fiveYear * 0.35) {
    console.error('one year left on a contract must cut the fee far below a 5-year deal');
    process.exitCode = 1;
  }
  const expiring = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'barcelona', goals: 30, gamesPlayed: 38 },
    role: 'first-team',
    clubId: 'barcelona',
    parentClubId: 'barcelona',
    seasonsAtCurrentClub: 1,
    age: 21,
    careerGoals: 80,
    careerGames: 100,
    nationality: 'spain',
    loansUsed: 0,
    seasonHistory: [{ ...dummySeason, seasonNumber: 2, clubId: 'barcelona', goals: 40, gamesPlayed: 50 }],
    contractYearsRemaining: 1,
  });
  const expiringFees = (expiring.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent').map((o) => o.fee);
  console.log('expiring fees', expiringFees);
  if (expiringFees.some((fee) => fee !== 0)) {
    console.error('when the contract expires, transfer fees must be zero');
    process.exitCode = 1;
  }

  const firstSeason = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'barcelona', goals: 20, gamesPlayed: 38 },
    role: 'first-team',
    clubId: 'barcelona',
    parentClubId: 'barcelona',
    seasonsAtCurrentClub: 0,
    age: 19,
    careerGoals: 20,
    careerGames: 38,
    nationality: 'spain',
    loansUsed: 0,
    contractYearsRemaining: 5,
  });
  const firstLoans = (firstSeason.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
  const firstLoanTiers = firstLoans.map((o) => getClub(o.clubId)?.tier ?? 5);
  console.log('first-season loans', firstLoans.length, 'tiers', firstLoanTiers);
  if (firstLoans.length !== 3 || firstLoanTiers.some((tier) => tier >= 5)) {
    console.error('the first season at a club must still offer value-matching loans');
    process.exitCode = 1;
  }

  const twoPoor = [
    { ...dummySeason, seasonNumber: 3, clubId: 'barcelona', goals: 12, gamesPlayed: 38 },
    { ...dummySeason, seasonNumber: 4, clubId: 'barcelona', goals: 14, gamesPlayed: 38 },
  ];
  const twoPoorSale = resolveSeasonTransition({
    season: twoPoor[1],
    role: 'first-team',
    clubId: 'barcelona',
    parentClubId: 'barcelona',
    seasonsAtCurrentClub: 2,
    age: 22,
    careerGoals: 66,
    careerGames: 126,
    nationality: 'spain',
    loansUsed: 0,
    seasonHistory: [
      { ...dummySeason, seasonNumber: 2, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
      twoPoor[0],
    ],
    contractYearsRemaining: 5,
  });
  const twoPoorTiers = (twoPoorSale.pendingTransfer?.offers ?? [])
    .filter((o) => o.move === 'permanent')
    .map((o) => getClub(o.clubId)?.tier ?? 5);
  console.log('two sub-0.5 seasons perm tiers', twoPoorTiers);
  if (twoPoorTiers.some((tier) => tier === 1)) {
    console.error('two consecutive seasons under 0.5 must not offer elite clubs');
    process.exitCode = 1;
  }

  const sevenPoor = Array.from({ length: 7 }, (_, i) => ({
    ...dummySeason,
    seasonNumber: 4 + i,
    clubId: 'barcelona',
    goals: 8,
    gamesPlayed: 38,
  }));
  const afterSeven = playerMarketValueFromSeasons({
    age: 26,
    careerGoals: 80 + 56,
    careerGames: 100 + 7 * 38,
    seasons: [
      { ...dummySeason, seasonNumber: 2, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
      { ...dummySeason, seasonNumber: 3, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
      ...sevenPoor,
    ],
    fallbackClub: barca,
    contractYearsRemaining: 5,
  });
  console.log('seven failed seasons', afterSeven, 'poor factor', consecutivePoorFactor(7));
  if (afterSeven > 12_000_000) {
    console.error('seven consecutive seasons under 0.25 must collapse value far below €41m');
    process.exitCode = 1;
  }

  const cheapTier = offerTierFromStanding({
    careerRatio: 0.8,
    marketValue: 900_000,
    currentTier: 1,
  });
  console.log('€900k offer tier', cheapTier, 'value band', tierForMarketValue(900_000));
  if (cheapTier <= 2) {
    console.error('a €900k player must not attract Strong or Elite transfer offers');
    process.exitCode = 1;
  }
  const cheapSale = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'barcelona', goals: 8, gamesPlayed: 38 },
    role: 'first-team',
    clubId: 'barcelona',
    parentClubId: 'barcelona',
    seasonsAtCurrentClub: 3,
    age: 26,
    careerGoals: 80 + 56,
    careerGames: 100 + 7 * 38,
    nationality: 'spain',
    loansUsed: 0,
    seasonHistory: [
      { ...dummySeason, seasonNumber: 2, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
      { ...dummySeason, seasonNumber: 3, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
      ...sevenPoor.slice(0, 6),
    ],
    contractYearsRemaining: 5,
  });
  const cheapPermTiers = (cheapSale.pendingTransfer?.offers ?? [])
    .filter((o) => o.move === 'permanent')
    .map((o) => getClub(o.clubId)?.tier ?? 1);
  console.log('collapsed-value perm tiers', cheapPermTiers, 'value', afterSeven);
  if (cheapPermTiers.some((tier) => tier <= 2)) {
    console.error('collapsed-value players must not get Strong or Elite transfer offers');
    process.exitCode = 1;
  }
}

console.log('\n--- Title rival: score to avoid defeat; lose both and the league is gone ---');
{
  const madrid = getClub('real-madrid')!;
  const rival = pickTitleRival(madrid);
  const { calendar, sim } = hydrateSeason({
    seasonNumber: 2,
    club: madrid,
    careerGoalRatio: 0.8,
    nationId: 'spain',
  });
  const rivalFixture = calendar.fixtures.find((f) => f.kind === 'league' && f.opponentId === sim.titleRivalId);
  if (!rival || !rivalFixture || sim.titleRivalId !== rival.id) {
    console.error('every league must assign a title rival');
    process.exitCode = 1;
  } else {
    const scored = resolveFixture(sim, rivalFixture, madrid, 1, () => 0.99);
    console.log('rival after a goal', scored.result.outcome, 'vs', rival.name);
    if (scored.result.outcome === 'loss') {
      console.error('scoring against the title rival must prevent a defeat');
      process.exitCode = 1;
    }
    const lostHome = {
      ...sim,
      rivalHomeOutcome: 'loss' as const,
      rivalAwayOutcome: 'loss' as const,
      leagueTable: sim.leagueTable.map((row) =>
        row.clubId === madrid.id ? { ...row, position: 1, points: 90 } : row,
      ),
    };
    console.log('lost both can win', canWinLeague(lostHome, madrid.id));
    if (canWinLeague(lostHome, madrid.id)) {
      console.error('losing home and away to the title rival must block the league title');
      process.exitCode = 1;
    }
  }
}

console.log('\n--- Injury durations: 1-week common, season-ending rare ---');
{
  const oneWeek = Array.from({ length: 20_000 }, () => injuryDuration(47, () => Math.random()));
  const ones = oneWeek.filter((d) => d === 1).length;
  const full = oneWeek.filter((d) => d === 47).length;
  console.log('injury P(1)', (ones / oneWeek.length).toFixed(3), 'P(47)', (full / oneWeek.length).toFixed(4), 'per-match', INJURY_CHANCE_PER_MATCH);
  if (ones < oneWeek.length * 0.45) {
    console.error('one-week injuries must be the common case');
    process.exitCode = 1;
  }
  if (full > oneWeek.length * 0.02) {
    console.error('a 47-week injury must stay rare');
    process.exitCode = 1;
  }
}

console.log('\n--- Loan return never dumps the player into the reserves ---');
const loanSeason: SeasonRecord = {
  ...dummySeason,
  role: 'loan',
  clubId: 'mainz',
  goals: 10,
  gamesPlayed: 24,
  leagueGoals: 10,
};
const loanBack = resolveSeasonTransition({
  season: { ...loanSeason, goals: 20 },
  role: 'loan',
  clubId: 'mainz',
  parentClubId: 'bayern',
  seasonsAtCurrentClub: 0,
  age: 18,
  careerGoals: 20,
  careerGames: 24,
  nationality: 'germany',
  loansUsed: 1,
});
console.log('high loan ratio', loanBack.headline, loanBack.immediate?.role);
if ((loanBack.pendingTransfer?.stay?.role ?? loanBack.immediate?.role) !== 'first-team') {
  console.error('meeting the parent first-team bar must return to the first team');
  process.exitCode = 1;
}
if (!loanBack.pendingTransfer || loanBack.pendingTransfer.offers.filter((o) => o.move === 'permanent').length < 3) {
  console.error('a successful loan return still offers parallel transfers');
  process.exitCode = 1;
}
const loanMiss = resolveSeasonTransition({
  season: loanSeason,
  role: 'loan',
  clubId: 'mainz',
  parentClubId: 'bayern',
  seasonsAtCurrentClub: 0,
  age: 18,
  careerGoals: 10,
  careerGames: 24,
  nationality: 'germany',
  loansUsed: 1,
});
const missMoves = loanMiss.pendingTransfer?.offers ?? [];
const loanOffers = missMoves.filter((o) => o.move === 'loan').length;
const transferOffers = missMoves.filter((o) => o.move === 'permanent').length;
console.log('missed return', loanMiss.headline, 'loans', loanOffers, 'transfers', transferOffers, loanMiss.immediate?.role);
if (loanMiss.immediate?.role === 'reserve' || loanOffers !== 3 || transferOffers !== 3) {
  console.error('a missed loan return must offer 3 loans and 3 transfers, never reserves');
  process.exitCode = 1;
}
const loanCap = resolveSeasonTransition({
  season: loanSeason,
  role: 'loan',
  clubId: 'mainz',
  parentClubId: 'bayern',
  seasonsAtCurrentClub: 0,
  age: 19,
  careerGoals: 10,
  careerGames: 24,
  nationality: 'germany',
  loansUsed: 2,
});
const capLoans = (loanCap.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan').length;
console.log('second loan used up', loanCap.headline, 'further loans', capLoans);
if (capLoans !== 0 || (loanCap.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent').length < 3) {
  console.error('after two loan spells the player must transfer');
  process.exitCode = 1;
}

console.log('\n--- Next playable fixture skips eliminated finals and 0-chance weeks ---');
if (madrid) {
  const { calendar, sim } = hydrateSeason({ seasonNumber: 4, club: madrid, careerGoalRatio: 0.8, nationId: 'spain' });
  const out = { ...sim, internationalSelected: true, internationalStage: 'eliminated' as const, internationalTournament: 'euro' as const };
  const final = calendar.fixtures.find((f) => f.kind === 'international' && f.internationalRound === 'final');
  if (final && !shouldSkipFixture(final, out)) {
    console.error('a lost semi-final must skip the final');
    process.exitCode = 1;
  }
  const sfIndex = calendar.fixtures.findIndex((f) => f.kind === 'international' && f.internationalRound === 'semi-final');
  const afterSf = nextPlayableFixture(calendar, { ...out, fixtureIndex: Math.max(0, sfIndex + 1) });
  if (afterSf?.internationalRound === 'final') {
    console.error('hub next-match must not preview a final the nation is already out of');
    process.exitCode = 1;
  }
  const zero = calendar.fixtures.find((f) => (f.playerChances ?? 1) === 0);
  const playable = nextPlayableFixture(
    { ...calendar, fixtures: zero ? [zero, ...calendar.fixtures.filter((f) => f !== zero)] : calendar.fixtures },
    { ...sim, fixtureIndex: 0 },
  );
  if (zero && playable === zero) {
    console.error('the next-match preview must not point at a 0-chance fixture');
    process.exitCode = 1;
  }
  console.log('eliminated skips final', Boolean(final && shouldSkipFixture(final, out)), 'next after SF', afterSf?.kind, afterSf?.internationalRound ?? afterSf?.opponentLabel);
}

console.log('\n--- Super Cup only after a CL/EL win; semis are two-legged; 8 unique league-phase sides ---');
if (madrid) {
  const noCup = hydrateSeason({ seasonNumber: 2, club: madrid, careerGoalRatio: 0.8, nationId: 'spain' });
  const withCup = hydrateSeason({
    seasonNumber: 2,
    club: madrid,
    careerGoalRatio: 0.8,
    nationId: 'spain',
    includeSuperCup: true,
    superCupOpponentId: 'bayern',
  });
  const superDefault = noCup.calendar.fixtures.filter((f) => f.kind === 'super-cup').length;
  const superForced = withCup.calendar.fixtures.filter((f) => f.kind === 'super-cup');
  const semis = noCup.calendar.fixtures.filter((f) => f.kind === 'continental-semi-final');
  const groups = noCup.calendar.fixtures.filter((f) => f.kind === 'continental-group');
  const groupIds = groups.map((f) => f.opponentId).filter(Boolean);
  console.log('super default', superDefault, 'forced', superForced.length, superForced[0]?.opponentLabel, 'semis', semis.length, 'group unique', new Set(groupIds).size);
  if (superDefault !== 0) {
    console.error('a club that did not win Europe last season must not play the Super Cup');
    process.exitCode = 1;
  }
  if (superForced.length !== 1 || superForced[0]?.opponentId !== 'bayern') {
    console.error('the Super Cup must be scheduled against the other European champion');
    process.exitCode = 1;
  }
  if (semis.length !== 2 || semis.some((f) => f.isDecisive)) {
    console.error('Champions League semis must be two legs, not a single decisive match');
    process.exitCode = 1;
  }
  if (new Set(groupIds).size !== 8 || groupIds.length !== 8) {
    console.error('the UEFA league phase must be 8 different clubs');
    process.exitCode = 1;
  }
  const phase = leaguePhaseOpponents(madrid, 'ucl', 8);
  if (phase.length !== 8 || new Set(phase.map((c) => c.id)).size !== 8 || phase.some((c) => c.id === madrid.id)) {
    console.error('league-phase draw must return 8 unique opponents');
    process.exitCode = 1;
  }
  const wcFinal = noCup.calendar.fixtures.find((f) => f.kind === 'international' && f.internationalRound === 'final');
  if (!wcFinal || !isFinalFixture(wcFinal)) {
    console.error('the World Cup final must be treated as a final result screen');
    process.exitCode = 1;
  }
}

const secured = resolveSeasonTransition({
  season: { ...dummySeason, goals: 24, gamesPlayed: 24, leagueGoals: 24, ratioMet: true },
  role: 'first-team',
  clubId: 'bayern',
  parentClubId: 'bayern',
  seasonsAtCurrentClub: 1,
  age: 20,
  careerGoals: 24,
  careerGames: 24,
  nationality: 'germany',
  loansUsed: 0,
});
if (!secured.pendingTransfer || !secured.pendingTransfer.allowDecline || secured.pendingTransfer.offers.length < 3) {
  console.error('every finished season must still table transfer offers in parallel');
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

console.log('\n--- Promotion, contracts, MLS weeks, twilight offers, sponsorship ---');
{
  const leicester = getClub('leicester')!;
  console.log('promotion 1st', earnedPromotion(leicester.league, 1), '3rd', earnedPromotion(leicester.league, 3));
  if (!earnedPromotion(leicester.league, 1) || !earnedPromotion(leicester.league, 2) || earnedPromotion(leicester.league, 3)) {
    console.error('1st or 2nd in a second division must promote; 3rd must not');
    process.exitCode = 1;
  }
  const promoted = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'leicester', goals: 20, gamesPlayed: 38 },
    role: 'first-team',
    clubId: 'leicester',
    parentClubId: 'leicester',
    seasonsAtCurrentClub: 1,
    age: 22,
    careerGoals: 40,
    careerGames: 70,
    nationality: 'england',
    loansUsed: 0,
    leaguePosition: 1,
    clubLeague: 'Championship',
  });
  console.log('promotion stay league', promoted.pendingTransfer?.stay?.clubLeague, promoted.headline);
  if (promoted.pendingTransfer?.stay?.clubLeague !== 'Premier League' || !promoted.headline.includes('promoted')) {
    console.error('staying after a Championship title must move the club into the Premier League');
    process.exitCode = 1;
  }
  const stayWage = promoted.pendingTransfer?.stay?.weeklyWage ?? 0;
  const stayYears = promoted.pendingTransfer?.stay?.contractYearsRemaining;
  console.log('promotion stay wage', stayWage, 'years', stayYears);
  if (stayWage < 32_000 || stayYears == null || stayYears < 1) {
    console.error('promotion stay terms must include a Premier League wage and contract length');
    process.exitCode = 1;
  }

  const ages = [24, 25, 27, 30, 34];
  const maxes = ages.map(maxContractYearsForAge);
  console.log('contract max by age', Object.fromEntries(ages.map((a, i) => [a, maxes[i]])));
  if (maxContractYearsForAge(24) !== 5 || maxContractYearsForAge(25) !== 4 || maxContractYearsForAge(26) !== 4) {
    console.error('max contract should drop to 4 years from 25');
    process.exitCode = 1;
  }
  if (maxContractYearsForAge(27) !== 3 || maxContractYearsForAge(30) !== 2 || maxContractYearsForAge(34) !== 1) {
    console.error('contract max must shorten at 27, 30 and 34');
    process.exitCode = 1;
  }

  const lafc = getClub('lafc')!;
  const { calendar: mlsCal } = hydrateSeason({
    seasonNumber: 2,
    club: lafc,
    careerGoalRatio: 0.6,
    nationId: 'united-states',
  });
  const mlsClubs = clubsForSeason(lafc, 'MLS');
  const east = mlsClubs.filter((c) => c.conference === 'east' || c.id === 'inter-miami' || c.id === 'columbus').length;
  const west = mlsClubs.filter((c) => c.conference === 'west' || c.id === 'lafc').length;
  const mlsKinds = mlsCal.fixtures.reduce<Record<string, number>>((acc, f) => {
    acc[f.kind] = (acc[f.kind] ?? 0) + 1;
    return acc;
  }, {});
  const leaguesMx = mlsCal.fixtures.filter((f) => f.kind === 'leagues-cup' && getClub(f.opponentId ?? '')?.league === 'Liga MX');
  console.log(
    'MLS clubs',
    mlsClubs.length,
    'league weeks',
    leagueMatchWeeks('MLS', lafc),
    'total weeks',
    mlsCal.totalWeeks,
    'kinds',
    mlsKinds,
    'Liga MX in Leagues Cup',
    leaguesMx.length,
  );
  if (mlsCal.totalWeeks > 48 || leagueMatchWeeks('MLS', lafc) > 26) {
    console.error('an MLS season must not run past 48 weeks or 26 league weeks');
    process.exitCode = 1;
  }
  if ((mlsKinds.playoff ?? 0) < 4 || (mlsKinds['leagues-cup'] ?? 0) < 4) {
    console.error('MLS must schedule playoffs and Leagues Cup');
    process.exitCode = 1;
  }
  if (leaguesMx.length < 1) {
    console.error('Leagues Cup must include Mexican clubs');
    process.exitCode = 1;
  }
  const mlsEastCount = mlsClubs.filter((c) => c.conference === 'east').length;
  const mlsWestCount = mlsClubs.filter((c) => c.conference === 'west').length;
  if (mlsEastCount !== 10 || mlsWestCount !== 10) {
    console.error(`MLS season must be 10 East / 10 West, got ${mlsEastCount}/${mlsWestCount}`);
    process.exitCode = 1;
  }
  void east;
  void west;

  const hilal = getClub('al-hilal')!;
  const { calendar: saudiCal } = hydrateSeason({
    seasonNumber: 2,
    club: hilal,
    careerGoalRatio: 0.6,
    nationId: 'saudi-arabia',
  });
  const saudiKinds = saudiCal.fixtures.reduce<Record<string, number>>((acc, f) => {
    acc[f.kind] = (acc[f.kind] ?? 0) + 1;
    return acc;
  }, {});
  const saudiCups = saudiCal.fixtures.filter((f) => f.continentalCup === 'acle' || f.domesticCup === 'kings-cup' || f.kind === 'super-cup');
  const acleOpp = saudiCal.fixtures.find((f) => f.kind === 'continental-group' && f.opponentId && getClub(f.opponentId)?.country !== 'Saudi Arabia');
  console.log('Saudi weeks', saudiCal.totalWeeks, 'kinds', saudiKinds, 'ACLE away', acleOpp?.opponentLabel);
  if (saudiCal.totalWeeks > 48) {
    console.error('a Saudi season must not run past 48 weeks');
    process.exitCode = 1;
  }
  if (!saudiCal.fixtures.some((f) => f.domesticCup === 'kings-cup')) {
    console.error('Saudi season must include the King Cup');
    process.exitCode = 1;
  }
  if ((saudiKinds['super-cup'] ?? 0) < 2) {
    console.error('Saudi Super Cup must be a four-team (semi + final) tie');
    process.exitCode = 1;
  }
  if (!saudiCal.fixtures.some((f) => f.continentalCup === 'acle')) {
    console.error('top Saudi clubs must play the AFC Champions League Elite');
    process.exitCode = 1;
  }
  if (!acleOpp) {
    console.error('ACLE must draw clubs from outside Saudi Arabia');
    process.exitCode = 1;
  }
  void saudiCups;

  const twilight = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'barcelona', goals: 20, gamesPlayed: 38 },
    role: 'first-team',
    clubId: 'barcelona',
    parentClubId: 'barcelona',
    seasonsAtCurrentClub: 2,
    age: 34,
    careerGoals: 200,
    careerGames: 400,
    nationality: 'spain',
    loansUsed: 2,
    contractYearsRemaining: 1,
  });
  const twilightMls = (twilight.pendingTransfer?.offers ?? []).filter((o) => getClub(o.clubId)?.league === 'MLS');
  console.log('age-34 MLS offers', twilightMls.length, twilightMls.map((o) => o.clubId));
  if (twilightMls.length < 3) {
    console.error('ages 34–36 must receive three extra MLS transfer offers');
    process.exitCode = 1;
  }

  const sponsorStar = seasonalSponsorship(200_000_000);
  const sponsorCheap = seasonalSponsorship(900_000);
  const sponsorFloor = seasonalSponsorship(10_000_000);
  const sponsorJustUnder = seasonalSponsorship(9_900_000);
  console.log('sponsorship €200m', sponsorStar, '€900k', sponsorCheap, '€10m', sponsorFloor, '€9.9m', sponsorJustUnder);
  if (sponsorStar < 5_000_000 || sponsorCheap !== 0 || sponsorJustUnder !== 0 || sponsorFloor <= 0 || sponsorCheap >= sponsorStar) {
    console.error('sponsorship must be zero below €10m and scale with market value above that');
    process.exitCode = 1;
  }
  if (RESERVE_CONTRACT_YEARS !== 1 || loanContractYearsRemaining(2, 5, 17) !== 1) {
    console.error('reserve and season-1 loans must be 1-year deals');
    process.exitCode = 1;
  }
  if (loanContractYearsRemaining(5, 5, 22) !== 4) {
    console.error('later-career loans should still tick the remaining years down');
    process.exitCode = 1;
  }
  const earlyS1 = playerMarketValueFromSeasons({
    age: 17,
    careerGoals: 2,
    careerGames: 1,
    seasons: [{
      ...dummySeason,
      seasonNumber: 2,
      clubId: 'barcelona',
      role: 'first-team',
      goals: 2,
      gamesPlayed: 1,
    }],
    fallbackClub: getClub('barcelona')!,
    contractYearsRemaining: 5,
    seasonNumber: 2,
    calendarWeek: 1,
  });
  const lateS1 = playerMarketValueFromSeasons({
    age: 17,
    careerGoals: 20,
    careerGames: 22,
    seasons: [{
      ...dummySeason,
      seasonNumber: 2,
      clubId: 'barcelona',
      role: 'first-team',
      goals: 20,
      gamesPlayed: 22,
    }],
    fallbackClub: getClub('barcelona')!,
    contractYearsRemaining: 5,
    seasonNumber: 2,
    calendarWeek: 21,
  });
  console.log('S1 value week 1', earlyS1, 'week 21', lateS1);
  if (earlyS1 !== YOUTH_MARKET_VALUE) {
    console.error('season 1 market value must stay at €100k until week 20');
    process.exitCode = 1;
  }
  if (lateS1 <= YOUTH_MARKET_VALUE) {
    console.error('season 1 market value must update after week 20');
    process.exitCode = 1;
  }
  const finished = {
    ...dummySeason,
    seasonNumber: 3,
    clubId: 'barcelona',
    role: 'first-team' as const,
    goals: 20,
    gamesPlayed: 40,
    ratioMet: true,
    league: 'La Liga',
  };
  const hotStart = {
    ...dummySeason,
    seasonNumber: 4,
    clubId: 'barcelona',
    role: 'first-team' as const,
    goals: 4,
    gamesPlayed: 2,
    ratioMet: null,
    league: 'La Liga',
  };
  const afterHotStart = playerMarketValueFromSeasons({
    age: 20,
    careerGoals: 24,
    careerGames: 42,
    seasons: [finished, hotStart],
    fallbackClub: getClub('barcelona')!,
    contractYearsRemaining: 5,
    seasonNumber: 4,
    calendarWeek: 2,
  });
  const fromFinishedOnly = playerMarketValueFromSeasons({
    age: 20,
    careerGoals: 20,
    careerGames: 40,
    seasons: [finished],
    fallbackClub: getClub('barcelona')!,
    contractYearsRemaining: 5,
    seasonNumber: 4,
    calendarWeek: 2,
  });
  console.log('early-season value', afterHotStart, 'finished-only', fromFinishedOnly);
  if (afterHotStart !== fromFinishedOnly) {
    console.error('market value must ignore a 2-game hot start and stay on completed seasons');
    process.exitCode = 1;
  }
  if (seasonLeagueLabel({ ...dummySeason, clubId: 'leicester', league: 'Premier League' }) !== 'Premier League') {
    console.error('career cards must show the league the club played after promotion');
    process.exitCode = 1;
  }
  const trophyTally = careerTrophyCounts([
    { ...dummySeason, trophies: ['La Liga', 'Copa del Rey'] },
    { ...dummySeason, trophies: ['La Liga'] },
  ]);
  const awardTally = careerAwardCounts([
    { ...dummySeason, topGoalscorer: true, playerOfTheYear: true, wonWpy: true },
    { ...dummySeason, topGoalscorer: true, playerOfTheYear: false, wonWpy: false },
  ]);
  console.log('trophy counts', trophyTally, 'award counts', awardTally, formatGamesGoals(2, 0));
  if (trophyTally.find((t) => t.name === 'La Liga')?.count !== 2 || trophyTally.find((t) => t.name === 'Copa del Rey')?.count !== 1) {
    console.error('career trophies must count how many times each title was won');
    process.exitCode = 1;
  }
  if (
    awardTally.find((a) => a.name === 'Top goalscorer')?.count !== 2 ||
    awardTally.find((a) => a.name === 'Player of the Year')?.count !== 1 ||
    awardTally.find((a) => a.name === 'World Player of the Year')?.count !== 1
  ) {
    console.error('career awards must count top scorer, player of the year and WPY');
    process.exitCode = 1;
  }
  if (formatGamesGoals(2, 0) !== '2 games · 0 goals') {
    console.error('international lines must show games and goals, not “0 in 2”');
    process.exitCode = 1;
  }
}
