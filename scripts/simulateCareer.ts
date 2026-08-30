/**
 * Dev-only balance tool for the season/career scaffolding: chance
 * distributions, league qualification, knockout pairing, and transfer terms.
 *
 * Run with: npm run simulate:career
 */
import { buildSeasonCalendar, fixtureIsHome, fixtureIsNeutral, fixtureIsNight, INTERNATIONAL_BREAK_WEEKS, isFinalFixture, nationsLeagueKnockoutWeeks, tournamentWeekCount } from '../src/game/career/calendar';
import { INJURY_CHANCE_PER_MATCH, injuryDuration } from '../src/game/career/injury';
import {
  chancesForKnockoutTie,
  chancesForLeagueMatch,
  meanChancesFromStrength,
} from '../src/game/career/chanceEngine';
import { assignClubTier, CLUBS, clubsForSeason, clubsInLeague, earnedPromotion, getClub, goalRatioFromStrength, leagueMatchWeeks, TARGET_LEAGUE_SIZE, TIER_LABEL } from '../src/game/career/data/clubs';
import { consecutivePoorFactor, contractValueFactor, formAdjustedRatio, loanContractYearsRemaining, maxContractYearsForAge, MEGA_CLUB_IDS, playerMarketValue, playerMarketValueFromSeasons, RESERVE_CONTRACT_YEARS, seasonalSponsorship, tierForMarketValue, transferFeeFromValue, weeklyWageForClub, YOUTH_MARKET_VALUE } from '../src/game/career/playerValue';
import { NATIONS, getNation } from '../src/game/career/data/nations';
import { nationKit } from '../src/game/career/data/nationColours';
import { reserveStadium, resolveCareerStadium, resolveMatchStadium, trialStadium } from '../src/game/career/matchVenue';
import { crowdSwatch, kitFromColor, kitFromScheme, luminance } from '../src/game/shooting/kitPalette';
import { createPitchView, idleKeeperPose, MAX_SHOT_DISTANCE_M, MIN_SHOT_DISTANCE_M, PLAYER_SKIN_TONES, pickPlayerSkin, SHORTS_HALF_H, THIGH_SHARE } from '../src/game/shooting/render';
import { standBottomY, crowdCellSize, stadiumLayout, stadiumRoofBand } from '../src/game/shooting/stadium';
import {
  CLUB_GROUNDS,
  CUP_FINAL_CAPACITY,
  CUP_FINAL_GROUND,
  LISTED_MIN_CAPACITY,
  UNLISTED_GROUND,
  groundForClub,
  isListedGround,
} from '../src/game/shooting/grounds';
import { clubKit } from '../src/game/career/data/clubKits';
import { clubContinentalCup, internationalCampaignForSeason, internationalTournamentForSeason } from '../src/game/career/data/competitions';
import { cupFromLeaguePosition, continentalQualificationForNextSeason } from '../src/game/career/europeanQualification';
import { fifaRank, knockoutRankCap, tournamentOpponents, worldCupKnockoutRankCap } from '../src/game/career/data/fifaRankings';
import { displaySeasonLabel, displaySeasonNumber } from '../src/game/career/seasonDisplay';
import { isSelectedForNationalTeam, selectionRatioForNation } from '../src/game/career/international';
import { missedChanceWinFactor, simulateClubMatch, simulateLeagueSeason } from '../src/game/career/matchEngine';
import { leaguePhaseOpponents } from '../src/game/career/continentalDraw';
import { canWinLeague, hydrateSeason, leagueFixtureIsHome, nextPlayableFixture, pickTitleRival, resolveFixture, shouldSkipFixture } from '../src/game/career/seasonSim';
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
import {
  evaluateInternationalTournamentAwards,
  internationalAwardWinChance,
} from '../src/game/career/internationalAwards';
import { formatInternationalSeason, careerAwardCounts, careerTrophyCounts, formatGamesGoals, seasonLeagueLabel } from '../src/game/career/honoursDisplay';
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

console.log('\n--- Finals use the regular chance distribution, not a single chance ---');
const finalChanceCounts = new Set(Array.from({ length: 200 }, () => chancesForLeagueMatch({ strength: 90 }).count));
console.log(`elite final chance counts seen: [${[...finalChanceCounts].sort((a, b) => a - b).join(', ')}]`);
if (finalChanceCounts.size < 2) {
  console.error('finals must not be locked to a single chance');
  process.exitCode = 1;
}

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
  console.error('season 2 must play five World Cup qualifiers then a 32-team World Cup');
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
  console.log('mean pre-assigned chances', chanceAvg.toFixed(2), `(elite club, target ~${meanChancesFromStrength(madrid.strength).toFixed(2)})`);
  if (chanceAvg < 2.4) {
    console.error('Real Madrid should generate well above 2 chances a game on average');
    process.exitCode = 1;
  }
  const missingOpp = calendar.fixtures.filter((f) => f.kind !== 'rest' && !f.opponentLabel).length;
  console.log('fixtures missing an opponent', missingOpp, '(expect 0)');
  if (missingOpp > 0) {
    const orphans = calendar.fixtures.filter((f) => f.kind !== 'rest' && !f.opponentLabel).map((f) => `w${f.week} ${f.kind} leg${f.leg ?? '-'}`);
    console.error('every playable fixture must have an opponent', orphans);
    process.exitCode = 1;
  }
  const koSeconds = calendar.fixtures.filter(
    (f) => (f.kind === 'continental-knockout' || f.kind === 'continental-semi-final') && f.leg === 2,
  );
  if (koSeconds.some((f) => !f.opponentLabel)) {
    console.error('Knockout 2nd legs must list the same opponent as the 1st leg');
    process.exitCode = 1;
  }
  const koFirsts = calendar.fixtures.filter(
    (f) => (f.kind === 'continental-knockout' || f.kind === 'continental-semi-final') && f.leg === 1,
  );
  for (const first of koFirsts) {
    const second = koSeconds.find((s) => s.kind === first.kind && s.week > first.week && s.opponentId === first.opponentId);
    if (!second) {
      console.error(`no paired 2nd leg for ${first.kind} vs ${first.opponentLabel} in week ${first.week}`);
      process.exitCode = 1;
    }
  }
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
  console.error('season 1 must have no international tournament for the player');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(1, 'UEFA').phase !== 'qualifiers-hidden') {
  console.error('season 1 is hidden World Cup qualifying — the player is not called up');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(2, 'UEFA').tournament !== 'world-cup') {
  console.error('season 2 is the World Cup');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(3, 'UEFA').tournament !== 'nations-league' || internationalCampaignForSeason(3, 'UEFA').phase !== 'nations-league') {
  console.error('season 3 is the Nations League');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(4, 'UEFA').tournament !== 'euro' || internationalCampaignForSeason(4, 'UEFA').phase !== 'tournament-only') {
  console.error('season 4 is the Euros with no qualifying');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(5, 'UEFA').phase !== 'qualifiers-hidden') {
  console.error('season 5 is hidden World Cup qualifying');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(6, 'UEFA').tournament !== 'world-cup' || internationalCampaignForSeason(6, 'UEFA').qualifierGames !== 5) {
  console.error('season 6 is the second five World Cup qualifiers plus the tournament');
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

const nationsCalendar = buildSeasonCalendar({
  seasonNumber: 3,
  leagueMatchWeeks: 38,
  clubTier: 1,
  confederation: 'UEFA',
  country: 'Spain',
  nationConfederation: 'UEFA',
});
const nationsRounds = nationsCalendar.fixtures.filter((f) => f.kind === 'international').map((f) => f.internationalRound);
console.log('season 3 international rounds', nationsRounds);
const expectedNations = [
  'group',
  'group',
  'group',
  'group',
  'group',
  'group',
  'quarter-final',
  'semi-final',
  'final',
];
if (nationsRounds.join() !== expectedNations.join()) {
  console.error('season 3 must schedule six Nations League group games then QF/SF/final');
  process.exitCode = 1;
}
const [qfWeek, sfWeek, finalWeek] = nationsLeagueKnockoutWeeks(38);
const nationsKoWeeks = nationsCalendar.fixtures
  .filter((f) => f.kind === 'international' && (f.internationalRound === 'quarter-final' || f.internationalRound === 'semi-final' || f.internationalRound === 'final'))
  .map((f) => f.week);
console.log('Nations League knockout weeks', nationsKoWeeks, 'expect', [qfWeek, sfWeek, finalWeek]);
if (nationsKoWeeks.join() !== [qfWeek, sfWeek, finalWeek].join() || finalWeek > 31 || qfWeek < 24) {
  console.error('Nations League knockout must sit around week 30, not after the season');
  process.exitCode = 1;
}
if (nationsCalendar.fixtures.some((f) => f.kind === 'international' && f.week > 38 && (f.internationalRound === 'quarter-final' || f.internationalRound === 'final'))) {
  console.error('Nations League finals must not be parked after the club season');
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
  'group',
  'group',
  'group',
  'round-of-16',
  'quarter-final',
  'semi-final',
  'final',
];
if (euroFinalsRounds.join() !== expectedEuro.join()) {
  console.error('season 4 must play the Euros with no qualifying — 3 group games and a last-16 knockout');
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

if (internationalCampaignForSeason(2, 'UEFA').qualifierGames !== 5) {
  console.error('season 2 World Cup qualifying must be 5 games');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(3, 'UEFA').qualifierGames !== 0) {
  console.error('season 3 Nations League has no qualifying');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(4, 'UEFA').qualifierGames !== 0) {
  console.error('season 4 continental tournament has no qualifying');
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
  const groupIds = finals.filter((f) => f.internationalRound === 'group').map((f) => f.opponentId);
  const earlyKo = finals.filter(
    (f) => f.internationalRound === 'round-of-32' || f.internationalRound === 'round-of-16',
  );
  if (earlyKo.some((f) => groupIds.includes(f.opponentId))) {
    console.error('group opponents must not reappear before the quarter-final');
    process.exitCode = 1;
  }
  if (new Set(groupIds).size < groupIds.length) {
    console.error('World Cup group opponents should not repeat');
    process.exitCode = 1;
  }
  if (!ranks.some((r) => r > 20)) {
    console.error('at least one opponent should sit outside the world top 20');
    process.exitCode = 1;
  }
}

console.log('\n--- Season 3 is Nations League; season 4 is tournament-only ---');
if (madridClub) {
  const s3 = hydrateSeason({
    seasonNumber: 3,
    club: madridClub,
    careerGoalRatio: 0.8,
    nationId: 'spain',
  });
  const s3Intl = s3.calendar.fixtures.filter((f) => f.kind === 'international');
  const s3Groups = s3Intl.filter((f) => f.internationalRound === 'group');
  const s3Ko = s3Intl.filter((f) => f.internationalRound === 'quarter-final' || f.internationalRound === 'semi-final' || f.internationalRound === 'final');
  console.log('S3', s3.sim.internationalTournament, s3.sim.internationalStage, 'group', s3Groups.length, 'ko', s3Ko.map((f) => f.week));
  if (s3.sim.internationalTournament !== 'nations-league' || s3.sim.internationalStage !== 'group') {
    console.error('season 3 must start in the Nations League group stage');
    process.exitCode = 1;
  }
  if (s3Groups.length !== 6 || s3Ko.length !== 3) {
    console.error('season 3 must schedule 6 group games and QF/SF/final');
    process.exitCode = 1;
  }
  if (s3Intl.some((f) => f.internationalRound === 'qualifier')) {
    console.error('Nations League has no qualifying matches');
    process.exitCode = 1;
  }

  const s4 = hydrateSeason({
    seasonNumber: 4,
    club: madridClub,
    careerGoalRatio: 0.8,
    nationId: 'spain',
  });
  const s4Intl = s4.calendar.fixtures.filter((f) => f.kind === 'international');
  const s4Quals = s4Intl.filter((f) => f.internationalRound === 'qualifier');
  console.log('S4', s4.sim.internationalTournament, s4.sim.internationalPhase, 'stage', s4.sim.internationalStage, 'quals', s4Quals.length, 'target', s4.sim.qualifierTarget);
  if (s4.sim.internationalTournament !== 'euro' || s4.sim.internationalPhase !== 'tournament-only') {
    console.error('season 4 must be the Euros with no qualifying campaign');
    process.exitCode = 1;
  }
  if (s4Quals.length !== 0 || s4.sim.qualifierTarget !== 0 || s4.sim.internationalStage !== 'group') {
    console.error('season 4 must start at the tournament group stage with zero qualifiers');
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
  const feeFive = transferFeeFromValue(fiveYear, 5);
  const feeOne = transferFeeFromValue(oneYear, 1);
  console.log('contract value 5yr', fiveYear, '1yr', oneYear, 'fees', feeFive, feeOne, 'factor', contractValueFactor(1));
  if (fiveYear !== oneYear) {
    console.error('intrinsic market value must ignore contract length');
    process.exitCode = 1;
  }
  if (feeOne !== 0 || feeFive !== fiveYear) {
    console.error('an expiring deal must be a free transfer; a 5-year deal asks the full fee');
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
  const expiringPerm = (expiring.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent');
  const expiringFees = expiringPerm.map((o) => o.fee);
  const expiringTiers = expiringPerm.map((o) => getClub(o.clubId)?.tier ?? 5);
  console.log('expiring fees', expiringFees, 'count', expiringPerm.length, 'tiers', expiringTiers);
  if (expiringFees.some((fee) => fee !== 0)) {
    console.error('when the contract expires, transfer fees must be zero');
    process.exitCode = 1;
  }
  if (expiringPerm.length < 5 || expiringTiers.some((tier) => tier >= 4)) {
    console.error('an expiring star must get more quality-club free bids, not weaker clubs');
    process.exitCode = 1;
  }
  const paidStar = resolveSeasonTransition({
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
    contractYearsRemaining: 5,
  });
  const paidPerm = (paidStar.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent');
  const paidIds = paidPerm.map((o) => o.clubId);
  console.log('€200m 5yr bidders', paidIds, paidPerm.map((o) => o.fee));
  if (paidIds.length === 0 || paidIds.some((id) => !MEGA_CLUB_IDS.has(id))) {
    console.error('a €200m fee must only attract PSG, Real Madrid or Manchester City');
    process.exitCode = 1;
  }
  if (paidPerm.some((o) => o.fee < 180_000_000)) {
    console.error('a 5-year deal at star value must ask a mega-club fee');
    process.exitCode = 1;
  }

  const firstSeason = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'barcelona', goals: 32, gamesPlayed: 38 },
    role: 'first-team',
    clubId: 'barcelona',
    parentClubId: 'barcelona',
    seasonsAtCurrentClub: 0,
    age: 19,
    careerGoals: 32,
    careerGames: 38,
    nationality: 'spain',
    loansUsed: 0,
    contractYearsRemaining: 5,
  });
  const firstLoans = (firstSeason.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
  const firstYears = (firstSeason.pendingTransfer?.offers ?? []).map((o) => o.contractYears);
  console.log('first-season (ratio met) loans', firstLoans.length, 'contract years', firstYears);
  if (firstLoans.length !== 0) {
    console.error('the first season at a club must not offer loans when the ratio is met');
    process.exitCode = 1;
  }
  if (firstYears.length === 0 || firstYears.some((y) => y == null || y < 1)) {
    console.error('transfer offers must list a contract length beside the wage');
    process.exitCode = 1;
  }

  const firstMissed = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'barcelona', goals: 8, gamesPlayed: 38 },
    role: 'first-team',
    clubId: 'barcelona',
    parentClubId: 'barcelona',
    seasonsAtCurrentClub: 0,
    age: 19,
    careerGoals: 8,
    careerGames: 38,
    nationality: 'spain',
    loansUsed: 0,
    contractYearsRemaining: 5,
  });
  const missedLoans = (firstMissed.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
  console.log('first-season (ratio missed) loans', missedLoans.length);
  if (missedLoans.length !== 3) {
    console.error('the first season at a club must still offer loans when the ratio is missed');
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
  const promotedLowRatio = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'leicester', goals: 8, gamesPlayed: 38 },
    role: 'first-team',
    clubId: 'leicester',
    parentClubId: 'leicester',
    seasonsAtCurrentClub: 1,
    age: 22,
    careerGoals: 20,
    careerGames: 70,
    nationality: 'england',
    loansUsed: 0,
    leaguePosition: 1,
    clubLeague: 'Championship',
  });
  if (promotedLowRatio.pendingTransfer?.stay?.clubLeague !== 'Premier League') {
    console.error('winning promotion must still offer a stay in the Premier League');
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

console.log('\n--- League position qualifies for Europe next season ---');
{
  const palace = getClub('crystal-palace')!;
  if (cupFromLeaguePosition('Premier League', 4) !== 'ucl' || cupFromLeaguePosition('Premier League', 5) !== 'uel' || cupFromLeaguePosition('Premier League', 6) !== 'uecl') {
    console.error('Premier League places must be 1–4 CL, 5 EL, 6 ECL');
    process.exitCode = 1;
  }
  if (cupFromLeaguePosition('Premier League', 7) != null || cupFromLeaguePosition('Championship', 1) != null) {
    console.error('mid-table PL and Championship sides must not get Europe from the table');
    process.exitCode = 1;
  }
  if (cupFromLeaguePosition('Ligue 1', 3) !== 'ucl' || cupFromLeaguePosition('Ligue 1', 4) !== 'uel') {
    console.error('Ligue 1 must give three CL places then EL');
    process.exitCode = 1;
  }
  if (cupFromLeaguePosition('Saudi Pro League', 4) !== 'acle' || cupFromLeaguePosition('Saudi Pro League', 5) != null) {
    console.error('Saudi top four must play the AFC Champions League Elite');
    process.exitCode = 1;
  }
  const uelUpgrade = continentalQualificationForNextSeason({
    club: palace,
    league: 'Premier League',
    position: 12,
    defendingContinental: 'uel',
  });
  if (uelUpgrade !== 'ucl') {
    console.error('Europa League winners must play the Champions League even from mid-table');
    process.exitCode = 1;
  }
  const sixth = hydrateSeason({
    seasonNumber: 3,
    club: palace,
    careerGoalRatio: 0.4,
    nationId: 'england',
    continentalCup: cupFromLeaguePosition('Premier League', 6),
  });
  const sixthCups = new Set(sixth.calendar.fixtures.map((f) => f.continentalCup).filter(Boolean));
  console.log('Palace 6th next cup', [...sixthCups], 'stage', sixth.sim.europeanStanding);
  if (!sixthCups.has('uecl') || sixth.sim.europeanStanding?.cup !== 'uecl') {
    console.error('finishing 6th in the Premier League must schedule the Conference League');
    process.exitCode = 1;
  }
  const tenth = hydrateSeason({
    seasonNumber: 3,
    club: getClub('real-madrid')!,
    careerGoalRatio: 0.8,
    nationId: 'spain',
    continentalCup: cupFromLeaguePosition('La Liga', 10),
  });
  if (tenth.calendar.fixtures.some((f) => f.kind.startsWith('continental'))) {
    console.error('a 10th-place La Liga finish must not schedule European football');
    process.exitCode = 1;
  }
  const fallback = continentalQualificationForNextSeason({
    club: getClub('real-madrid')!,
    league: 'La Liga',
    position: null,
  });
  if (fallback !== clubContinentalCup(getClub('real-madrid')!)) {
    console.error('a missing table must fall back to the club’s typical European status');
    process.exitCode = 1;
  }
}

console.log('\n--- International group sides stay out of early knockouts ---');
{
  let groupReuse = 0;
  for (let i = 0; i < 40; i++) {
    const drawn = tournamentOpponents('spain', 'world-cup');
    const group = drawn.slice(0, 3).map((n) => n.id);
    const early = drawn.slice(3, 5).map((n) => n.id);
    if (early.some((id) => group.includes(id))) groupReuse += 1;
  }
  console.log('WC group reused before QF across 40 draws', groupReuse);
  if (groupReuse > 0) {
    console.error('World Cup group opponents must not appear before the quarter-final');
    process.exitCode = 1;
  }
  const euro = tournamentOpponents('spain', 'euro');
  const euroGroup = euro.slice(0, 3).map((n) => n.id);
  const euroR16Qf = euro.slice(3, 5).map((n) => n.id);
  if (euroR16Qf.some((id) => euroGroup.includes(id))) {
    console.error('Euro last-16 and quarter-final must not reuse a group opponent');
    process.exitCode = 1;
  }
}

console.log('\n--- Missed chances cut win probability ---');
{
  if (
    missedChanceWinFactor(0) !== 1 ||
    missedChanceWinFactor(1) >= missedChanceWinFactor(0) ||
    missedChanceWinFactor(2) >= missedChanceWinFactor(1) ||
    missedChanceWinFactor(3) >= missedChanceWinFactor(2) ||
    missedChanceWinFactor(4) >= missedChanceWinFactor(3)
  ) {
    console.error('more missed chances must reduce win odds in steps');
    process.exitCode = 1;
  }
  const trials = 2500;
  const rate = (goals: number, chances?: number) => {
    let wins = 0;
    for (let i = 0; i < trials; i++) {
      const r = simulateClubMatch(
        { clubStrength: 86, opponentStrength: 80, isHome: true },
        Math.random,
        goals,
        chances,
      );
      if (r.outcome === 'win') wins += 1;
    }
    return wins / trials;
  };
  const baseline = rate(0);
  const oneMiss = rate(0, 1);
  const fourMiss = rate(0, 4);
  console.log('win rate 0 goals: baseline', baseline.toFixed(3), '1 miss', oneMiss.toFixed(3), '4 misses', fourMiss.toFixed(3));
  if (fourMiss >= baseline - 0.08) {
    console.error('missing all four chances must cut the club’s win rate');
    process.exitCode = 1;
  }
  if (oneMiss <= fourMiss || oneMiss > baseline + 0.03) {
    console.error('missing one chance must sit between a normal result and four misses');
    process.exitCode = 1;
  }
}

if (madrid) {
  const { calendar } = hydrateSeason({ seasonNumber: 2, club: madrid, careerGoalRatio: 0.8, nationId: 'spain' });
  const cupFinal = calendar.fixtures.find((f) => f.kind === 'domestic-cup' && f.domesticCupStage === 'final');
  const euroFinal = calendar.fixtures.find((f) => f.kind === 'continental-final');
  const intlSf = calendar.fixtures.find((f) => f.kind === 'international' && f.internationalRound === 'semi-final');
  if (cupFinal?.isDecisive || euroFinal?.isDecisive || intlSf?.isDecisive) {
    console.error('domestic, European and international finals must not be one-chance matches');
    process.exitCode = 1;
  }
}

console.log('\n--- Five unique qualifying opponents, not a repeating draw ---');
{
  const draws: string[][] = [];
  for (let i = 0; i < 12; i++) {
    const { calendar } = hydrateSeason({
      seasonNumber: 2,
      club: getClub('real-madrid')!,
      careerGoalRatio: 0.8,
      nationId: 'spain',
    });
    const quals = calendar.fixtures
      .filter((f) => f.kind === 'international' && f.internationalRound === 'qualifier' && f.opponentId)
      .map((f) => f.opponentId as string);
    draws.push(quals);
    if (quals.length !== 5) {
      console.error(`World Cup qualifying must schedule 5 matches, got ${quals.length}`);
      process.exitCode = 1;
    }
    if (new Set(quals).size !== quals.length) {
      console.error('a qualifying campaign must not repeat an opponent');
      process.exitCode = 1;
    }
  }
  const identical = draws.filter((d) => d.join() === draws[0].join()).length;
  console.log('Spain WC qualifier draws', draws.map((d) => d.join(', ')), `same-as-first ${identical}/12`);
  if (identical === 12) {
    console.error('qualifying opponents must vary across seasons rather than repeating the same countries');
    process.exitCode = 1;
  }

  const s3 = hydrateSeason({
    seasonNumber: 3,
    club: getClub('real-madrid')!,
    careerGoalRatio: 0.8,
    nationId: 'spain',
  });
  const s3Group = s3.calendar.fixtures
    .filter((f) => f.kind === 'international' && f.internationalRound === 'group' && f.opponentId)
    .map((f) => f.opponentId as string);
  const s4 = hydrateSeason({
    seasonNumber: 4,
    club: getClub('real-madrid')!,
    careerGoalRatio: 0.8,
    nationId: 'spain',
  });
  const s4Quals = s4.calendar.fixtures
    .filter((f) => f.kind === 'international' && f.internationalRound === 'qualifier' && f.opponentId)
    .map((f) => f.opponentId as string);
  console.log('S3 Nations group', s3Group, 'S4 quals', s4Quals);
  if (s3Group.length !== 6) {
    console.error('Nations League group must list six opponents');
    process.exitCode = 1;
  }
  if (s4Quals.length !== 0) {
    console.error('season 4 must not schedule qualifying opponents');
    process.exitCode = 1;
  }
}

console.log('\n--- International knockout rank caps ---');
{
  if (
    knockoutRankCap('round-of-16') !== 16
    || knockoutRankCap('quarter-final') !== 8
    || worldCupKnockoutRankCap('semi-final') !== 8
    || knockoutRankCap('final') !== 8
  ) {
    console.error('Last 16 must be top 16; quarter-final, semi-final and final must be top 8');
    process.exitCode = 1;
  }
  let r16Over = 0;
  let qfOver = 0;
  let sfOver = 0;
  let finalOver = 0;
  let euroR16Over = 0;
  let euroQfOver = 0;
  for (let i = 0; i < 30; i++) {
    const drawn = tournamentOpponents('spain', 'world-cup');
    const r16 = drawn[4];
    const qf = drawn[5];
    const sf = drawn[6];
    const fin = drawn[7];
    if (!r16 || fifaRank(r16.id) > 16) r16Over += 1;
    if (!qf || fifaRank(qf.id) > 8) qfOver += 1;
    if (!sf || fifaRank(sf.id) > 8) sfOver += 1;
    if (!fin || fifaRank(fin.id) > 8) finalOver += 1;
    const euro = tournamentOpponents('spain', 'euro');
    const euroR16 = euro[3];
    const euroQf = euro[4];
    if (!euroR16 || fifaRank(euroR16.id) > 16) euroR16Over += 1;
    if (!euroQf || fifaRank(euroQf.id) > 8) euroQfOver += 1;
  }
  console.log('rank-cap misses WC R16/QF/SF/final', r16Over, qfOver, sfOver, finalOver, 'Euro R16/QF', euroR16Over, euroQfOver);
  if (r16Over > 0 || qfOver > 0 || sfOver > 0 || finalOver > 0 || euroR16Over > 0 || euroQfOver > 0) {
    console.error('knockout opponents must respect FIFA rank caps in every tournament');
    process.exitCode = 1;
  }
}

console.log('\n--- Player goals cannot produce a 1–0 when the player scored two ---');
{
  let undercounted = 0;
  let oneNilWithTwo = 0;
  for (let i = 0; i < 400; i++) {
    const r = simulateClubMatch(
      { clubStrength: 90, opponentStrength: 88, isHome: true },
      Math.random,
      2,
      2,
    );
    if (r.scoreFor < 2) undercounted += 1;
    if (r.scoreFor === 1 && r.scoreAgainst === 0) oneNilWithTwo += 1;
  }
  console.log('undercounted player goals', undercounted, '1-0 with 2 goals', oneNilWithTwo);
  if (undercounted > 0 || oneNilWithTwo > 0) {
    console.error('the scoreline must be at least the number of goals the player scored');
    process.exitCode = 1;
  }
  const madridClub = getClub('real-madrid')!;
  const { calendar, sim } = hydrateSeason({
    seasonNumber: 2,
    club: madridClub,
    careerGoalRatio: 0.8,
    nationId: 'spain',
  });
  const finalFx = calendar.fixtures.find((f) => f.kind === 'continental-final') ?? calendar.fixtures.find((f) => f.kind === 'international' && f.internationalRound === 'final');
  if (finalFx) {
    let badFinal = 0;
    for (let i = 0; i < 80; i++) {
      const { result } = resolveFixture(sim, finalFx, madridClub, 2);
      if (result.scoreFor < 2) badFinal += 1;
    }
    console.log('finals with 2 player goals undercounted', badFinal);
    if (badFinal > 0) {
      console.error('a final win screen must not show 1–0 when the player scored two');
      process.exitCode = 1;
    }
  }
}

console.log('\n--- World Cup and continental tournament awards ---');
{
  if (
    internationalAwardWinChance('world-cup', 5) !== 0 ||
    internationalAwardWinChance('world-cup', 6) !== 0.5 ||
    internationalAwardWinChance('world-cup', 7) !== 0.75 ||
    internationalAwardWinChance('world-cup', 8) !== 0.9 ||
    internationalAwardWinChance('world-cup', 9) !== 0.9
  ) {
    console.error('World Cup award chances must be 6/50, 7/75, 8+/90');
    process.exitCode = 1;
  }
  if (
    internationalAwardWinChance('euro', 4) !== 0 ||
    internationalAwardWinChance('euro', 5) !== 0.5 ||
    internationalAwardWinChance('euro', 6) !== 0.75 ||
    internationalAwardWinChance('euro', 7) !== 0.9
  ) {
    console.error('continental award chances must be 5/50, 6/75, 7+/90');
    process.exitCode = 1;
  }
  const always = evaluateInternationalTournamentAwards({
    tournament: 'world-cup',
    finalsGoals: 8,
    rng: () => 0,
  });
  const never = evaluateInternationalTournamentAwards({
    tournament: 'world-cup',
    finalsGoals: 8,
    rng: () => 0.99,
  });
  const below = evaluateInternationalTournamentAwards({
    tournament: 'world-cup',
    finalsGoals: 5,
    rng: () => 0,
  });
  console.log('award rolls always/never/below', always, never, below);
  if (!always.playerOfTheTournament || !always.topGoalscorer || never.playerOfTheTournament || never.topGoalscorer || below.playerOfTheTournament) {
    console.error('tournament awards must roll independently against the chance table');
    process.exitCode = 1;
  }
  const line = formatInternationalSeason({
    tournament: 'world-cup',
    qualifyingGames: 5,
    qualifyingGoals: 3,
    qualifyingOutcome: 'qualified',
    finalsGames: 6,
    finalsGoals: 4,
    tournamentOutcome: 'quarter-final',
    playerOfTheTournament: false,
    topGoalscorer: false,
  });
  console.log('career intl line', line);
  if (!line || !line.qualifying?.includes('qualified') || !line.tournament?.includes('quarter-finals')) {
    console.error('career record must show each qualifying period and tournament outcome');
    process.exitCode = 1;
  }
}

console.log('\n--- Stadium home/away crowd and opposition defender kit ---');
{
  const juve = kitFromColor('#000000');
  const madridClub = getClub('real-madrid')!;
  const madrid = kitFromScheme(clubKit(madridClub));
  const barca = kitFromScheme(clubKit(getClub('barcelona')));
  const crowdBlack = crowdSwatch('#000000');
  console.log('juve kit', juve, 'madrid kit', madrid, 'barca kit', barca, 'black crowd', crowdBlack);
  if (luminance(juve.shorts) < 0.5) {
    console.error('a black kit must wear light shorts');
    process.exitCode = 1;
  }
  if (luminance(madrid.shirt) < 0.85 || luminance(madrid.shorts) < 0.85) {
    console.error('Real Madrid must wear an all-white kit');
    process.exitCode = 1;
  }
  if (barca.pattern !== 'vertical' || !barca.stripe) {
    console.error('Barcelona must wear blaugrana stripes');
    process.exitCode = 1;
  }
  const city = kitFromScheme(clubKit(getClub('man-city')));
  const chelsea = kitFromScheme(clubKit(getClub('chelsea')));
  const liverpool = kitFromScheme(clubKit(getClub('liverpool')));
  const united = kitFromScheme(clubKit(getClub('man-united')));
  console.log('socks city/chelsea/liverpool/united/barca', city.socks, chelsea.socks, liverpool.socks, united.socks, barca.socks);
  if (luminance(city.socks) < 0.8 || luminance(chelsea.socks) < 0.8) {
    console.error('City and Chelsea wear white home socks');
    process.exitCode = 1;
  }
  if (luminance(liverpool.socks) > 0.4) {
    console.error('Liverpool must wear red socks');
    process.exitCode = 1;
  }
  if (luminance(united.socks) > 0.25) {
    console.error('Manchester United must wear black socks');
    process.exitCode = 1;
  }
  if (barca.socks.toLowerCase() !== '#004d98') {
    console.error('Barcelona must wear blue socks');
    process.exitCode = 1;
  }
  if (luminance(madrid.socks) < 0.85) {
    console.error('Real Madrid must wear white socks');
    process.exitCode = 1;
  }
  const sevilla = kitFromScheme(clubKit(getClub('sevilla')));
  const tottenham = kitFromScheme(clubKit(getClub('tottenham')));
  const arsenal = kitFromScheme(clubKit(getClub('arsenal')));
  if (luminance(sevilla.socks) < 0.8 || luminance(arsenal.socks) < 0.8) {
    console.error('Sevilla and Arsenal wear white home socks');
    process.exitCode = 1;
  }
  if (luminance(tottenham.socks) > 0.25) {
    console.error('Tottenham must wear navy home socks');
    process.exitCode = 1;
  }
  if (SHORTS_HALF_H + 0.08 >= THIGH_SHARE * 3) {
    console.error('shorts must sit above the knee so bare thighs stay visible');
    process.exitCode = 1;
  }
  if (SHORTS_HALF_H < 0.6) {
    console.error('shorts should read as football shorts, not a thin belt under the jersey');
    process.exitCode = 1;
  }
  const skins = new Set(PLAYER_SKIN_TONES.map((c) => c.toLowerCase()));
  if (skins.size < 4) {
    console.error('keepers and defenders need a range of skin tones');
    process.exitCode = 1;
  }
  const lightSkin = Math.max(...PLAYER_SKIN_TONES.map((c) => luminance(c)));
  const darkSkin = Math.min(...PLAYER_SKIN_TONES.map((c) => luminance(c)));
  if (lightSkin < 0.7 || darkSkin > 0.28 || darkSkin < 0.12) {
    console.error('skin tones must span fair through deep brown without reading as black legs');
    process.exitCode = 1;
  }
  if (pickPlayerSkin(0) === pickPlayerSkin(3)) {
    console.error('skin tone must change with the seed');
    process.exitCode = 1;
  }
  const idleSkin = idleKeeperPose(() => 0.8).skinTone;
  if (!skins.has(idleSkin.toLowerCase())) {
    console.error('the idle keeper must pick a listed skin tone');
    process.exitCode = 1;
  }
  if (luminance(crowdBlack) <= luminance('#000000') + 0.05) {
    console.error('a black kit must still produce a visible crowd colour');
    process.exitCode = 1;
  }

  const spain = getNation('spain')!;
  const homeFx = {
    week: 3,
    kind: 'league' as const,
    isDecisive: false,
    opponentId: 'barcelona',
    opponentLabel: 'Barcelona',
    isHome: true,
  };
  const awayFx = { ...homeFx, isHome: false };
  const homeLook = resolveMatchStadium({ fixture: homeFx, club: madridClub, nation: spain });
  const awayLook = resolveMatchStadium({ fixture: awayFx, club: madridClub, nation: spain });
  console.log('home stadium', homeLook.homeColor, 'away stadium', awayLook.homeColor, 'defender', homeLook.opponentColor, awayLook.opponentColor, 'night', homeLook.night);
  if (homeLook.homeColor !== madridClub.color || awayLook.homeColor !== getClub('barcelona')!.color) {
    console.error('majority crowd must follow the side whose ground it is');
    process.exitCode = 1;
  }
  if (homeLook.opponentPattern !== 'vertical' || homeLook.opponentColor !== getClub('barcelona')!.color) {
    console.error('the defender must wear the opponent striped kit');
    process.exitCode = 1;
  }
  if (homeLook.night || awayLook.night) {
    console.error('league games must be played in daylight');
    process.exitCode = 1;
  }
  if (homeLook.isHome !== true || awayLook.isHome !== false) {
    console.error('isHome must pass through to the stadium');
    process.exitCode = 1;
  }

  const trialLook = trialStadium(spain);
  const reserveLook = resolveCareerStadium({ club: madridClub, nation: spain, seasonNumber: 1, role: 'reserve' });
  const firstTeamLook = resolveCareerStadium({
    fixture: homeFx,
    club: madridClub,
    nation: spain,
    seasonNumber: 2,
    role: 'first-team',
  });
  console.log(
    'trial/reserve/first-team venues',
    trialLook.bowl,
    reserveLook.groundName,
    reserveLook.capacity,
    firstTeamLook.groundName,
    firstTeamLook.capacity,
  );
  if (trialLook.bowl !== false) {
    console.error('the trial must use the original pitch with no stadium');
    process.exitCode = 1;
  }
  if (
    reserveLook.groundName !== UNLISTED_GROUND.name
    || reserveLook.standTiers !== UNLISTED_GROUND.tiers
    || (reserveLook.capacity ?? 0) >= LISTED_MIN_CAPACITY
    || reserveStadium(madridClub).groundName !== UNLISTED_GROUND.name
  ) {
    console.error('the reserve season must play in the generic municipal stadium');
    process.exitCode = 1;
  }
  if (firstTeamLook.groundName !== groundForClub('real-madrid').name || firstTeamLook.capacity !== 83_186) {
    console.error('first-team matches must still use the club ground');
    process.exitCode = 1;
  }

  const groupFx = {
    week: 20,
    kind: 'international' as const,
    isDecisive: false,
    opponentId: 'italy',
    opponentLabel: 'Italy',
    internationalRound: 'group' as const,
    isHome: true,
  };
  const koFx = { ...groupFx, internationalRound: 'quarter-final' as const };
  const uclFx = {
    week: 12,
    kind: 'continental-knockout' as const,
    isDecisive: false,
    opponentId: 'bayern',
    opponentLabel: 'Bayern Munich',
    isHome: true,
    leg: 1 as const,
  };
  const groupLook = resolveMatchStadium({ fixture: groupFx, club: madridClub, nation: spain });
  const koLook = resolveMatchStadium({ fixture: koFx, club: madridClub, nation: spain });
  const uclLook = resolveMatchStadium({ fixture: uclFx, club: madridClub, nation: spain });
  console.log('kickoffs group/ko/ucl night', groupLook.night, koLook.night, uclLook.night);
  if (groupLook.night || !koLook.night || !uclLook.night) {
    console.error('only international knockouts and European club games are at night');
    process.exitCode = 1;
  }
  if (fixtureIsNight(homeFx) || !fixtureIsNight(uclFx) || fixtureIsNight(groupFx) || !fixtureIsNight(koFx)) {
    console.error('fixtureIsNight must match league-day / europe-night / group-day / knockout-night');
    process.exitCode = 1;
  }

  const spainRed = nationKit('spain').primary;
  const italyBlue = nationKit('italy').primary;
  console.log('intl crowd', groupLook.homeColor, 'defender', groupLook.opponentColor);
  if (groupLook.homeColor !== spainRed || groupLook.opponentColor !== italyBlue) {
    console.error('international crowds and defenders must use nation kit colours');
    process.exitCode = 1;
  }
  if (spainRed === italyBlue) {
    console.error('Spain and Italy must not share a kit colour');
    process.exitCode = 1;
  }

  for (const nation of NATIONS) {
    const kit = nationKit(nation.id);
    if (!kit.primary || !kit.primary.startsWith('#')) {
      console.error(`nation ${nation.id} is missing a kit colour`);
      process.exitCode = 1;
      break;
    }
  }

  const { calendar } = hydrateSeason({
    seasonNumber: 2,
    club: madridClub,
    careerGoalRatio: 0.8,
    nationId: 'spain',
  });
  const ko1 = calendar.fixtures.find((f) => f.kind === 'continental-knockout' && f.leg === 1);
  const ko2 = calendar.fixtures.find((f) => f.kind === 'continental-knockout' && f.leg === 2);
  const leagueHome = calendar.fixtures.filter((f) => f.kind === 'league' && f.isHome).length;
  const leagueAway = calendar.fixtures.filter((f) => f.kind === 'league' && f.isHome === false).length;
  console.log('ko home/away', ko1 && fixtureIsHome(ko1), ko2 && fixtureIsHome(ko2), 'league H/A', leagueHome, leagueAway);
  const cupFinalFx = calendar.fixtures.find((f) => f.kind === 'domestic-cup' && f.domesticCupStage === 'final');
  const euroFinalFx = calendar.fixtures.find((f) => f.kind === 'continental-final');
  const cupFinalLook = cupFinalFx ? resolveMatchStadium({ fixture: cupFinalFx, club: madridClub, nation: spain }) : null;
  const euroFinalLook = euroFinalFx ? resolveMatchStadium({ fixture: euroFinalFx, club: madridClub, nation: spain }) : null;
  console.log(
    'neutral finals',
    cupFinalFx && fixtureIsNeutral(cupFinalFx),
    euroFinalFx && fixtureIsNeutral(euroFinalFx),
    cupFinalLook?.groundName,
    cupFinalLook?.capacity,
    euroFinalLook?.awayShare,
  );
  if (!cupFinalFx || !euroFinalFx || !fixtureIsNeutral(cupFinalFx) || !fixtureIsNeutral(euroFinalFx)) {
    console.error('domestic and European finals must be neutral');
    process.exitCode = 1;
  } else if (fixtureIsHome(cupFinalFx) || fixtureIsHome(euroFinalFx)) {
    console.error('a neutral final must not be treated as home or away');
    process.exitCode = 1;
  } else if (
    !cupFinalLook
    || !euroFinalLook
    || cupFinalLook.groundName !== CUP_FINAL_GROUND.name
    || cupFinalLook.capacity !== CUP_FINAL_CAPACITY
    || (cupFinalLook.standTiers ?? 0) < 4
    || euroFinalLook.capacity !== CUP_FINAL_CAPACITY
    || euroFinalLook.awayShare !== 0.5
  ) {
    console.error('cup finals must be staged at the large neutral stadium with a split crowd');
    process.exitCode = 1;
  }

  if (!ko1 || !ko2 || !fixtureIsHome(ko1) || fixtureIsHome(ko2)) {
    console.error('two-legged ties must be home then away');
    process.exitCode = 1;
  }
  if (leagueHome < 8 || leagueAway < 8) {
    console.error('league fixtures must include both home and away matches');
    process.exitCode = 1;
  }
  const leagueFlags = calendar.fixtures.filter((f) => f.kind === 'league').map((f) => Boolean(f.isHome));
  const firstTwelve = leagueFlags.slice(0, 12);
  const firstTwelveHome = firstTwelve.filter(Boolean).length;
  const firstTwelveAway = firstTwelve.length - firstTwelveHome;
  let maxAwayRun = 0;
  let run = 0;
  for (const home of leagueFlags) {
    if (!home) {
      run += 1;
      maxAwayRun = Math.max(maxAwayRun, run);
    } else {
      run = 0;
    }
  }
  console.log('league first-12 H/A', firstTwelveHome, firstTwelveAway, 'max away run', maxAwayRun);
  if (firstTwelveHome < 3 || firstTwelveAway < 3) {
    console.error('league home and away must be interleaved, not a home block then an away block');
    process.exitCode = 1;
  }
  if (maxAwayRun > 2) {
    console.error('league away games must not run for more than two in a row');
    process.exitCode = 1;
  }
  if (!leagueFixtureIsHome(0, 38) || leagueFixtureIsHome(1, 38) || !leagueFixtureIsHome(2, 38)) {
    console.error('opening league games should be home, away, home');
    process.exitCode = 1;
  }

  const madridHome = resolveMatchStadium({
    fixture: { week: 1, kind: 'league', isDecisive: false, isHome: true, opponentId: 'getafe' },
    club: madridClub,
  });
  const getafeHome = resolveMatchStadium({
    fixture: { week: 2, kind: 'league', isDecisive: false, isHome: false, opponentId: 'getafe' },
    club: madridClub,
  });
  const dortmundHome = resolveMatchStadium({
    fixture: { week: 1, kind: 'league', isDecisive: false, isHome: true, opponentId: 'mainz' },
    club: getClub('dortmund'),
  });
  const barcaAway = resolveMatchStadium({
    fixture: { week: 3, kind: 'league', isDecisive: false, isHome: false, opponentId: 'barcelona' },
    club: madridClub,
  });
  console.log(
    'grounds madrid/barca/getafe/dortmund',
    madridHome.capacity,
    madridHome.standTiers,
    barcaAway.capacity,
    barcaAway.standTiers,
    getafeHome.capacity,
    getafeHome.standTiers,
    dortmundHome.capacity,
    dortmundHome.standTiers,
  );
  if (barcaAway.unique !== 'camp-nou' || barcaAway.standTiers !== 5 || madridHome.standTiers !== 5) {
    console.error('Camp Nou and the Bernabéu must both be five-deck bowls, Camp Nou unique');
    process.exitCode = 1;
  }
  if ((barcaAway.capacity ?? 0) <= (madridHome.capacity ?? 0)) {
    console.error('Camp Nou must be taller than the Bernabéu');
    process.exitCode = 1;
  }
  if (dortmundHome.standTiers !== 1 || (dortmundHome.capacity ?? 0) < 80_000) {
    console.error('Signal Iduna Park is a single tall terrace');
    process.exitCode = 1;
  }
  if (getafeHome.standTiers !== 2 || (getafeHome.capacity ?? 99_000) >= LISTED_MIN_CAPACITY) {
    console.error('unlisted clubs must be a two-deck municipal stand smaller than the listed table');
    process.exitCode = 1;
  }

  const close = createPitchView(390, 844, MIN_SHOT_DISTANCE_M);
  const far = createPitchView(390, 844, MAX_SHOT_DISTANCE_M);
  const closeStand = standBottomY(close);
  const farStand = standBottomY(far);
  console.log('stand close/far', closeStand.toFixed(1), farStand.toFixed(1), 'goal close/far', close.goal.botY.toFixed(1), far.goal.botY.toFixed(1));
  if (closeStand > close.goal.botY || farStand > far.goal.botY) {
    console.error('the crowd must sit on or above the goal line');
    process.exitCode = 1;
  }
  if (close.goal.botY - closeStand > 16 || far.goal.botY - farStand > 16) {
    console.error('close-up shots must not leave an empty band behind the net');
    process.exitCode = 1;
  }
  if (closeStand <= close.h * 0.22) {
    console.error('a 6-yard camera must extend the crowd below a 22% screen cap');
    process.exitCode = 1;
  }
  const closeCell = crowdCellSize(closeStand - close.h * 0.028);
  const farCell = crowdCellSize(farStand - far.h * 0.028);
  console.log('crowd cell close/far', closeCell.rowH.toFixed(2), farCell.rowH.toFixed(2));
  if (closeCell.rowH < 6) {
    console.error('close-up fans must be large enough to read as people, not a flat wall');
    process.exitCode = 1;
  }
  if (closeCell.rowH <= farCell.rowH) {
    console.error('close-up fans must scale larger than the 30-yard terrace speckle');
    process.exitCode = 1;
  }
  const eliteBowl = stadiumLayout(close, 'elite');
  const localBowl = stadiumLayout(close, 'local');
  console.log('bowl top elite/local', eliteBowl.top.toFixed(1), localBowl.top.toFixed(1), 'decks', eliteBowl.decks.length, localBowl.decks.length);
  if (localBowl.top <= eliteBowl.top + 80) {
    console.error('a local ground must show more sky above the terrace than an elite bowl');
    process.exitCode = 1;
  }
  if (!localBowl.roof || !eliteBowl.roof) {
    console.error('every bowl, including municipal two-deck stands, needs a visible roof');
    process.exitCode = 1;
  }
  const eliteRoof = stadiumRoofBand(close.h, eliteBowl.top, true);
  const localRoof = stadiumRoofBand(close.h, localBowl.top, false);
  console.log(
    'roof band elite/local',
    (eliteRoof.soffitBottom - eliteRoof.canopyTop).toFixed(1),
    (localRoof.soffitBottom - localRoof.canopyTop).toFixed(1),
    'fascia',
    eliteRoof.fasciaH.toFixed(1),
    localRoof.fasciaH.toFixed(1),
  );
  const eliteRoofH = eliteRoof.soffitBottom - eliteRoof.canopyTop;
  const localRoofH = localRoof.soffitBottom - localRoof.canopyTop;
  if (eliteRoofH > 36 || localRoofH > 36 || eliteRoofH < 12 || localRoofH < 12) {
    console.error('the canopy must be a compact lid on the terrace, not a sky-filling roof or a hairline');
    process.exitCode = 1;
  }
  if (eliteRoof.fasciaH < 7 || eliteRoof.fasciaH > 16 || localRoof.fasciaH < 7 || localRoof.fasciaH > 16) {
    console.error('the roof fascia must be a modest beam on the top deck');
    process.exitCode = 1;
  }
  if (eliteRoof.soffitBottom < eliteBowl.top - 2 || localRoof.soffitBottom < localBowl.top - 2) {
    console.error('the roof must sit on the top deck with no sky gap under the fascia');
    process.exitCode = 1;
  }
  if (localRoof.canopyTop >= localBowl.top - 4) {
    console.error('a municipal roof must leave sky above the canopy');
    process.exitCode = 1;
  }
  if (eliteBowl.decks.length <= localBowl.decks.length) {
    console.error('elite bowls should have more decks than a local terrace');
    process.exitCode = 1;
  }

  const barcaL = stadiumLayout(close, groundForClub('barcelona'));
  const madridL = stadiumLayout(close, groundForClub('real-madrid'));
  const dortmundL = stadiumLayout(close, groundForClub('dortmund'));
  const lazioL = stadiumLayout(close, groundForClub('lazio'));
  const liverpoolL = stadiumLayout(close, groundForClub('liverpool'));
  const milanL = stadiumLayout(close, groundForClub('ac-milan'));
  const interL = stadiumLayout(close, groundForClub('inter'));
  const sociedadL = stadiumLayout(close, groundForClub('real-sociedad'));
  const getafeL = stadiumLayout(close, groundForClub('getafe'));
  console.log(
    'bowl tops barca/madrid/dortmund/lazio/liverpool/getafe',
    barcaL.top.toFixed(1),
    madridL.top.toFixed(1),
    dortmundL.top.toFixed(1),
    lazioL.top.toFixed(1),
    liverpoolL.top.toFixed(1),
    getafeL.top.toFixed(1),
    'decks',
    barcaL.decks.length,
    madridL.decks.length,
    dortmundL.decks.length,
  );
  if (!(barcaL.top + 8 < madridL.top && madridL.top < dortmundL.top)) {
    console.error('Camp Nou must sit above the Bernabéu, which sits above Signal Iduna Park');
    process.exitCode = 1;
  }
  if (barcaL.decks.length !== 5 || madridL.decks.length !== 5 || dortmundL.decks.length !== 1 || lazioL.decks.length !== 1) {
    console.error('deck counts must follow the stadium table');
    process.exitCode = 1;
  }
  const cityL = stadiumLayout(close, groundForClub('man-city'));
  const fourL = stadiumLayout(close, { name: 'Four-deck', capacity: 55_000, tiers: 4 });
  const evenDecks = (layout: ReturnType<typeof stadiumLayout>, n: number, label: string) => {
    if (layout.decks.length !== n) {
      console.error(`${label} must be ${n} decks, got ${layout.decks.length}`);
      process.exitCode = 1;
      return;
    }
    const heights = layout.decks.map((d) => d.bottom - d.top);
    const packed = heights.slice(0, -1);
    const packedSpread = packed.length ? Math.max(...packed) - Math.min(...packed) : 0;
    const lastTaller = heights.length > 1 && heights[heights.length - 1] > heights[0] + 1.2;
    if (packedSpread > 1.2 || (!lastTaller && Math.max(...heights) - Math.min(...heights) > 1.2)) {
      console.error(`${label} decks must be even rings, spread packed=${packedSpread.toFixed(2)}`);
      process.exitCode = 1;
    }
    if (lastTaller && layout.decks[layout.decks.length - 1].top > close.goal.topY + 4) {
      console.error(`${label} lowest ring should meet the crossbar so the goal is not an extra deck`);
      process.exitCode = 1;
    }
    if (n >= 2) {
      const walkway = layout.decks[1].top - layout.decks[0].bottom;
      const minPacked = Math.min(...(packed.length ? packed : heights));
      if (walkway >= minPacked * 0.4) {
        console.error(`${label} walkways must stay thinner than the seating rings`);
        process.exitCode = 1;
      }
      if (layout.aisleEvery !== 0) {
        console.error(`${label} must not paint vomitory aisles inside stacked decks`);
        process.exitCode = 1;
      }
    }
  };
  evenDecks(cityL, 3, 'Etihad');
  evenDecks(barcaL, 5, 'Camp Nou');
  evenDecks(fourL, 4, 'four-deck bowl');
  evenDecks(getafeL, 2, 'Getafe');
  console.log(
    'even decks city/barca/four',
    cityL.decks.map((d) => (d.bottom - d.top).toFixed(1)).join('/'),
    barcaL.decks.map((d) => (d.bottom - d.top).toFixed(1)).join('/'),
    fourL.decks.map((d) => (d.bottom - d.top).toFixed(1)).join('/'),
  );
  if (!(dortmundL.top < lazioL.top && lazioL.top < liverpoolL.top)) {
    console.error('single-deck stands must still scale height with capacity');
    process.exitCode = 1;
  }
  if (milanL.top !== interL.top || milanL.decks.length !== 5) {
    console.error('Milan and Inter share San Siro');
    process.exitCode = 1;
  }
  if (!(sociedadL.top < getafeL.top) || getafeL.decks.length !== 2 || isListedGround('getafe')) {
    console.error('Getafe must be a shorter two-deck municipal than Reale Arena');
    process.exitCode = 1;
  }
  if (Object.keys(CLUB_GROUNDS).length < 36) {
    console.error('the listed stadium table is missing clubs');
    process.exitCode = 1;
  }
}
