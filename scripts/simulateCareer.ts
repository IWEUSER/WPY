/**
 * Dev-only balance tool for the season/career scaffolding: chance
 * distributions, league qualification, knockout pairing, and transfer terms.
 *
 * Run with: npm run simulate:career
 */
import { buildSeasonCalendar, fixtureCrowdAwayShare, fixtureIsHome, fixtureIsNeutral, fixtureIsNight, fixtureShowsSun, fixtureVenueLabel, INTERNATIONAL_BREAK_WEEKS, isClubFinalNeutral, isFinalFixture, nationsLeagueKnockoutWeeks, scoreboardPlayerOnLeft, tournamentWeekCount } from '../src/game/career/calendar';
import { INJURY_CHANCE_PER_MATCH, injuryDuration, sitOutGamesAfterPlayedMatch } from '../src/game/career/injury';
import {
  chancesForKnockoutTie,
  chancesForLeagueMatch,
  meanChancesFromStrength,
} from '../src/game/career/chanceEngine';
import { assignClubTier, CLUBS, clubsForSeason, clubsInLeague, earnedPromotion, getClub, goalRatioFromStrength, leagueMatchWeeks, playableClubsGroupedByLeague, SECOND_DIVISIONS, TARGET_LEAGUE_SIZE, TIER_LABEL } from '../src/game/career/data/clubs';
import { playoffGamesFromOpening, playoffOpeningForPosition } from '../src/game/career/data/leagueFormat';
import { clubTransferBudget, consecutivePoorFactor, contractValueFactor, DEFAULT_CONTRACT_YEARS, ELITE_TRANSFER_VALUE_FLOOR, FIRST_CONTRACT_YEARS, firstTopFlightValueCap, formAdjustedRatio, isSeason1ValueLocked, leagueValueWeight, loanContractYearsRemaining, maxContractYearsForAge, MEGA_CLUB_IDS, MIN_ACCEPTED_FEE_RATIO, newContractYears, playerMarketValue, playerMarketValueFromSeasons, RESERVE_CONTRACT_YEARS, RESERVE_WAGE_FACTOR, RESERVE_WEEKLY_WAGE, seasonalSponsorship, tierForMarketValue, TOP_LEAGUES, transferFeeFromValue, weeklyWageForClub, weeklyWageForRatio, weeklyWageForSquadStatus, YOUTH_MARKET_VALUE } from '../src/game/career/playerValue';
import { NATIONS, getNation } from '../src/game/career/data/nations';
import { nationKit } from '../src/game/career/data/nationColours';
import { reserveStadium, resolveCareerStadium, resolveMatchStadium, trialStadium } from '../src/game/career/matchVenue';
import { crowdSwatch, kitFromColor, kitFromScheme, luminance } from '../src/game/shooting/kitPalette';
import { AFRICA_SKIN_TONES, createPitchView, idleKeeperPose, MAX_SHOT_DISTANCE_M, MIN_SHOT_DISTANCE_M, PLAYER_SKIN_TONES, pickPlayerLook, pickPlayerSkin, SHORTS_HALF_H, THIGH_SHARE } from '../src/game/shooting/render';
import { appearanceRegionForNation, HAIR_SWATCHES, isBlackHair, isBlondeHair, isFairSkin, SKIN_SWATCHES } from '../src/game/shooting/appearance';
import { rollChanceSetup } from '../src/game/shooting/chanceSetup';
import { applyMatchResult, createAvailability } from '../src/game/career/availabilityEngine';
import { useCareerStore } from '../src/game/career/store';
import { standBottomY, crowdCellSize, pitchQualityFromStrength, stadiumLayout, stadiumRoofBand } from '../src/game/shooting/stadium';
import {
  CLUB_GROUNDS,
  CUP_FINAL_CAPACITY,
  CUP_FINAL_GROUND,
  INTERNATIONAL_TOURNAMENT_CAPACITY,
  INTERNATIONAL_TOURNAMENT_GROUND,
  YOUTH_TOURNAMENT_CAPACITY,
  YOUTH_TOURNAMENT_GROUND,
  CLUB_TRIAL_CAPACITY,
  CLUB_TRIAL_GROUND,
  LISTED_MIN_CAPACITY,
  UNLISTED_GROUND,
  groundForClub,
  isListedGround,
} from '../src/game/shooting/grounds';
import { clubKit } from '../src/game/career/data/clubKits';
import { clubContinentalCup, domesticCupForCountry, internationalCalendarSeason, internationalCampaignForSeason, internationalTournamentForSeason } from '../src/game/career/data/competitions';
import { CURRENT_RULES_STAMP, migratedRulesStamp, rebuildCurrentSeason, saveNeedsRebuild } from '../src/game/career/rulesStamp';
import { cupFromLeaguePosition, continentalQualificationForNextSeason } from '../src/game/career/europeanQualification';
import { fifaRank, knockoutRankCap, nationStrength, nationsInConfederation, tournamentOpponents, worldCupKnockoutRankCap } from '../src/game/career/data/fifaRankings';
import { countsTowardCareerRecord, displaySeasonLabel, displaySeasonNumber, isFirstPublicSeason } from '../src/game/career/seasonDisplay';
import { bumpInternationalSeason, callUpRatio, isInternationalFinalsRound, isSelectedForNationalTeam, leagueEligibleForNationalTeam, markInjuryMissedFinals, SEASON_1_CALL_UP_MIN_WEEK, selectionRatioForNation } from '../src/game/career/international';
import { blowoutScorePossible, formatHomeAwayScore, missedChanceWinFactor, plausibleGoalCaps, simulateClubMatch, simulateLeagueSeason, simulateMatchTimeline } from '../src/game/career/matchEngine';
import { chanceImportanceLine, chanceMinute, chanceMinutesForMatch, chancesLeftLine, formatChanceMinute } from '../src/game/shooting/chanceAtmosphere';
import { awardBeat, enqueueLeagueTitleBeat, firstCapBeat, firstTitleBeat, portraitForTrophyName, pushCareerBeat, retirementBeat, seasonAwardBeats, soldBeat, titleBeat } from '../src/game/career/careerBeat';
import { aggregateContinental, aggregateDomesticSplit, clubSeasonTotals, recordClubAppearanceStats, seasonDomesticSplit } from '../src/game/career/seasonStats';
import { evaluateClubPlayerOfTheTournament } from '../src/game/career/clubInternationalAwards';
import { leaguePhaseOpponents, pickSuperCupOpponent } from '../src/game/career/continentalDraw';
import { settleDrawOnPenalties } from '../src/game/career/penalties';
import { planDomesticSuperCup } from '../src/game/career/domesticSuperCup';
import { firstLegStakeLine, formatNextLine, nextMatchBriefing, sitOutRecapLine } from '../src/game/career/matchBriefing';
import { canWinLeague, continentalAggregateLine, ensureInternationalGroup, fixtureTitle, hydrateSeason, internationalStageWhenSelected, leagueFixtureIsHome, liveMatchBoardLine, liveMatchScoreSeed, mulberry32, nextActionableFixture, nextPlayableFixture, pickDomesticCupOpponent, pickTitleRival, remainingPlayableCount, resolveFixture, shouldSimulateNationQualifier, shouldSkipFixture } from '../src/game/career/seasonSim';
import { applyPlayerGroupResult, createGroupState, nationCanProgressKnockout, nationCanWinMajor, simulateNpcRoundAfterPlayerMatch } from '../src/game/career/internationalTable';
import {
  applyTrialMatch,
  applyYouthMatch,
  assignOpeningTrialClub,
  beginClubTrial,
  beginFavouriteClubTrial,
  chooseTrialClub,
  clubTrialComplete,
  createYouthCampaign,
  failClubTrial,
  repairOpeningCampaign,
  resolveOpeningMatch,
  youthTournamentComplete,
} from '../src/game/career/openingFlow';
import {
  CLUB_TRIAL_CHANCE_SPLIT,
  CLUB_TRIAL_GAMES,
  pickTrialClub,
  pickTrialClubs,
  tierForYouthGoals,
  trialContractWon,
  TRIALS_AT_LEVEL,
} from '../src/game/career/trial';
import { trialDestinationCountries, youthTierForNation, youthTrialsAreMlsOnly } from '../src/game/career/trialGeography';
import { nextYouthKnockoutRound, pickYouthGroupOpponents, pickYouthKnockoutOpponent, youthMaxGames } from '../src/game/career/youthTournament';
import { chancesForSquadStatus, consecutiveScoringAsImpact, consecutiveScoringGames, describeSquadStatus, IMPACT_CHANCES, IMPACT_STREAK, isLowerDivisionLoan, isSquadRotationSitOut, isToughMinutesFixture, nextSquadStatusAfterSeason, openingSquadStatus, promoteSquadStatusDuringSeason, reservePrioritisesContinental, reserveSitsChampionsLeague, RISING_STAR_MIN_RATIO, ROLE_REVIEW_WEEK, seasonOverridesRatioBar, shouldSitLeagueFixture, shouldSitToughFixture, squadStatusOnArrival, STARTER_STREAK, youthRolesAllowed } from '../src/game/career/squadStatus';
import { consecutiveLoanSpells, LOAN_OFFER_COUNT, SAUDI_OFFER_MIN_AGE, TRANSFER_MARKET_CAP, TRANSFER_OFFER_COUNT, offerFormRatio, offerTierFromStanding, pickLoanClubsForMiss, pickLoanClubsFromOrigin, pickPermanentClubs, requiredGoalRatio, resolveSeasonTransition, sellingClubAcceptsOffer, TWILIGHT_MLS_CLUB_IDS, TWILIGHT_SAUDI_CLUB_IDS, trialFailTransferPending, tierForRatio } from '../src/game/career/transfers';
import { evaluateWpy } from '../src/game/career/wpy';
import {
  evaluatePlayerOfTheYear,
  evaluateTopGoalscorer,
  goldenBootTarget,
  goldenBootWinChance,
  playerOfTheYearWinChance,
} from '../src/game/career/domesticAwards';
import {
  evaluateInternationalTournamentAwards,
  internationalAwardWinChance,
} from '../src/game/career/internationalAwards';
import { formatInternationalSeason, awardLabels, careerAwardCounts, careerTrophyCounts, formatGamesGoals, seasonLeagueLabel } from '../src/game/career/honoursDisplay';
import { formatLiveBuildStamp, LIVE_SHIP_LABEL, liveMenuStamp } from '../src/game/branding';
import type { CareerState, SeasonRecord } from '../src/game/career/types';

const N = 50000;

{
  const stamped = liveMenuStamp('2026-09-18T18:30:00.000Z');
  if (formatLiveBuildStamp('2026-09-18T18:30:00.000Z') !== '18 Sep 18:30 UTC') {
    console.error('live build stamp must print a UTC clock');
    process.exitCode = 1;
  }
  if (stamped !== `${LIVE_SHIP_LABEL} · 18 Sep 18:30 UTC` || !stamped.includes('Sideways knock')) {
    console.error('the first menu stamp must name the ship and the build clock');
    process.exitCode = 1;
  }
}

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
  'friendly',
  'friendly',
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
  console.error('season 2 must play five World Cup qualifiers, two friendlies, then a 32-team World Cup');
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
  console.error('World Cup finals must occupy a week per friendly, group game, and knockout round');
  process.exitCode = 1;
}
if (calendar.totalWeeks !== leagueWeeks + 1 + 1 + INTERNATIONAL_BREAK_WEEKS + tournamentWeekCount('world-cup')) {
  console.error(`La Liga World Cup season must be ${leagueWeeks + 1 + 1 + INTERNATIONAL_BREAK_WEEKS + tournamentWeekCount('world-cup')} weeks`);
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
  includeDomesticCup: false,
  includeInternational: false,
  continentalCup: null,
});
const s1Kinds = [...new Set(s1Calendar.fixtures.map((f) => f.kind))];
const s1Intl = s1Calendar.fixtures.filter((f) => f.kind === 'international').length;
console.log('season 1 fixtures', s1Calendar.fixtures.length, s1Kinds, 'intl', s1Intl);
if (s1Intl !== 0 || s1Kinds.join() !== 'league' || s1Calendar.fixtures.length !== leagueMatchWeeks('La Liga')) {
  console.error('the reserve year must be league-only: no cups, continentals, or internationals');
  process.exitCode = 1;
}
const madridClubForReserve = getClub('real-madrid')!;
const reserveHydrated = hydrateSeason({
  seasonNumber: 1,
  club: madridClubForReserve,
  careerGoalRatio: 0,
  nationId: 'spain',
  leagueOnly: true,
});
const reserveKinds = [...new Set(reserveHydrated.calendar.fixtures.map((f) => f.kind))];
const reserveChances = reserveHydrated.calendar.fixtures.map((f) => f.playerChances ?? -1);
console.log('hydrated reserve', reserveHydrated.calendar.fixtures.length, reserveKinds, 'chance sample', reserveChances.slice(0, 6));
if (
  reserveKinds.join() !== 'league'
  || reserveHydrated.calendar.fixtures.length !== leagueMatchWeeks('La Liga', madridClubForReserve)
  || reserveChances.some((n) => n < 0)
) {
  console.error('hydrateSeason(leagueOnly) must be a full league with first-team chance rolls');
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

console.log('\n--- Domestic awards: 20-goal golden boot table in every league ---');
{
  const leagues = ['Premier League', 'La Liga', 'Serie A', 'Championship', 'La Liga 2'];
  for (const league of leagues) {
    if (goldenBootTarget(league) !== 20) {
      console.error(`${league} golden boot must start at 20, not ${goldenBootTarget(league)}`);
      process.exitCode = 1;
    }
    if (evaluateTopGoalscorer(16, league, () => 0).won || evaluateTopGoalscorer(19, league, () => 0).won) {
      console.error(`${league} must never award the golden boot below 20 goals`);
      process.exitCode = 1;
    }
  }
  const expected: Record<number, number> = {
    20: 0.2, 21: 0.25, 22: 0.3, 23: 0.4, 24: 0.5, 25: 0.6, 26: 0.7, 27: 0.8, 28: 0.9, 29: 0.95, 30: 0.99,
  };
  for (const [goals, chance] of Object.entries(expected)) {
    if (goldenBootWinChance(Number(goals)) !== chance) {
      console.error(`${goals} goals must be ${chance} golden-boot chance, got ${goldenBootWinChance(Number(goals))}`);
      process.exitCode = 1;
    }
  }
  const trials = 2000;
  let twenty = 0;
  for (let i = 0; i < trials; i++) {
    if (evaluateTopGoalscorer(20, 'La Liga').won) twenty += 1;
  }
  const twentyRate = twenty / trials;
  console.log(`La Liga 20 goals ${(twentyRate * 100).toFixed(1)}% (expect ~20%)`);
  if (twentyRate < 0.12 || twentyRate > 0.28) {
    console.error('20 league goals must be about a 20% golden boot, same in every league');
    process.exitCode = 1;
  }
  const sixteenCopy = evaluateTopGoalscorer(16, 'La Liga', () => 0);
  if (sixteenCopy.reason.toLowerCase().includes('target') || sixteenCopy.reason.includes('16 at')) {
    console.error('golden boot copy must not publish a target');
    process.exitCode = 1;
  }
  const potyNoTitle = evaluatePlayerOfTheYear({
    leagueChampion: false,
    leagueGoals: 24,
    league: 'La Liga',
    topGoalscorer: true,
    rng: () => 0,
  });
  const potyNoTitleNever = evaluatePlayerOfTheYear({
    leagueChampion: false,
    leagueGoals: 24,
    league: 'La Liga',
    topGoalscorer: true,
    rng: () => 0.99,
  });
  const potyLow = evaluatePlayerOfTheYear({
    leagueChampion: true,
    leagueGoals: 8,
    league: 'La Liga',
    topGoalscorer: false,
    rng: () => 0,
  });
  console.log('POTY top scorer no title', potyNoTitle.won, potyNoTitleNever.won, 'low goals title', potyLow.won);
  if (!potyNoTitle.won || potyNoTitleNever.won || potyLow.won) {
    console.error('Player of the Year must be a chance roll, including for top scorers who did not win the league');
    process.exitCode = 1;
  }
  if (potyNoTitle.reason.toLowerCase().includes('requires winning') || potyNoTitle.reason.toLowerCase().includes('bar ')) {
    console.error('Player of the Year copy must not use a hard title rule or bar');
    process.exitCode = 1;
  }
  const potyForty = evaluatePlayerOfTheYear({
    leagueChampion: false,
    leagueGoals: 43,
    league: 'La Liga',
    topGoalscorer: true,
    rng: () => 0.99,
  });
  if (playerOfTheYearWinChance({ leagueChampion: false, topGoalscorer: false, leagueGoals: 40 }) !== 1 || !potyForty.won) {
    console.error('40+ league goals must always win league Player of the Year');
    process.exitCode = 1;
  }
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
if (internationalTournamentForSeason(1, 'UEFA') !== 'world-cup') {
  console.error('season 1 is World Cup qualifying — the player can be selected');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(1, 'UEFA').phase !== 'qualifiers' || internationalCampaignForSeason(1, 'UEFA').qualifierGames !== 5) {
  console.error('season 1 is World Cup qualifying with five games the player can play');
  process.exitCode = 1;
}
if (internationalCampaignForSeason(2, 'UEFA').tournament !== 'world-cup' || internationalCampaignForSeason(2, 'UEFA').phase !== 'qualifiers-and-tournament') {
  console.error('season 2 is World Cup qualifying plus the tournament');
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
if (internationalCampaignForSeason(5, 'UEFA').phase !== 'qualifiers' || internationalCampaignForSeason(5, 'UEFA').qualifierGames !== 5) {
  console.error('season 5 is World Cup qualifying again');
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
if (internationalCalendarSeason(1, { careerStart: 'youth' }) !== 1) {
  console.error('youth-path Season 1 is World Cup qualifying');
  process.exitCode = 1;
}
if (internationalCalendarSeason(1, { careerStart: 'favourite-first-team' }) !== 1) {
  console.error('favourite first-team Season 1 is World Cup qualifying, not the tournament');
  process.exitCode = 1;
}
if (internationalCalendarSeason(1, { leagueOnly: true, careerStart: 'youth' }) !== 0) {
  console.error('the reserve year has no international campaign');
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
  'quarter-final',
  'semi-final',
  'final',
];
if (nationsRounds.join() !== expectedNations.join()) {
  console.error('season 3 must schedule three Nations League group games, then QF/SF/final, with no friendlies');
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
  'friendly',
  'friendly',
  'group',
  'group',
  'group',
  'round-of-16',
  'quarter-final',
  'semi-final',
  'final',
];
if (euroFinalsRounds.join() !== expectedEuro.join()) {
  console.error('season 4 must play the Euros with two friendlies, 3 group games and a last-16 knockout');
  process.exitCode = 1;
}
const euroFinalsWeeks = [...new Set(euroFinalsCalendar.fixtures.filter((f) => f.kind === 'international' && f.internationalRound !== 'qualifier').map((f) => f.week))];
if (euroFinalsWeeks.length !== tournamentWeekCount('euro')) {
  console.error('non-World Cup tournaments must occupy a week per friendly, group game, and knockout round');
  process.exitCode = 1;
}
if (euroFinalsRounds.includes('round-of-32')) {
  console.error('continental tournaments do not have a last 32');
  process.exitCode = 1;
}

{
  const wcCalendar = buildSeasonCalendar({
    seasonNumber: 2,
    leagueMatchWeeks: 38,
    clubTier: 1,
    confederation: 'UEFA',
    country: 'Spain',
    nationConfederation: 'UEFA',
  });
  const wcIntl = wcCalendar.fixtures.filter((f) => f.kind === 'international');
  const wcQuals = wcIntl.filter((f) => f.internationalRound === 'qualifier');
  const wcTournament = wcIntl.filter((f) => f.internationalRound !== 'qualifier');
  const nationsTournament = nationsCalendar.fixtures.filter((f) => f.kind === 'international');
  const euroTournament = euroFinalsCalendar.fixtures.filter((f) => f.kind === 'international');
  const wcFinals = wcTournament.filter((f) => f.internationalRound !== 'friendly');
  const nationsFinals = nationsTournament.filter((f) => f.internationalRound !== 'friendly');
  const euroFinals = euroTournament.filter((f) => f.internationalRound !== 'friendly');
  const wcFriendlies = wcTournament.filter((f) => f.internationalRound === 'friendly');
  const nationsGroups = nationsFinals.filter((f) => f.internationalRound === 'group');
  const nationsKnockouts = nationsFinals.filter((f) => f.internationalRound !== 'group');
  const continentalFriendlies = [...nationsTournament, ...euroTournament].filter((f) => f.internationalRound === 'friendly');
  console.log(
    'venues WC quals',
    wcQuals.map((f) => fixtureVenueLabel(f)),
    'WC finals',
    wcFinals.map((f) => fixtureVenueLabel(f)),
    'Nations',
    nationsFinals.map((f) => fixtureVenueLabel(f)),
    'Euro',
    euroFinals.map((f) => fixtureVenueLabel(f)),
  );
  if (wcQuals.length === 0 || wcQuals.some((f) => fixtureIsNeutral(f) || fixtureCrowdAwayShare(f) !== 0.2)) {
    console.error('World Cup qualifiers must stay home/away with a home crowd');
    process.exitCode = 1;
  }
  if (wcFriendlies.length !== 2 || fixtureVenueLabel(wcFriendlies[0]!) !== 'Home' || !fixtureIsNeutral(wcFriendlies[1]!)) {
    console.error('World Cup friendlies must be one home game then a neutral');
    process.exitCode = 1;
  }
  if (continentalFriendlies.some((f) => fixtureIsNeutral(f))) {
    console.error('continental pre-tournament friendlies must stay home or away');
    process.exitCode = 1;
  }
  if (
    wcFinals.some((f) => fixtureVenueLabel(f) !== 'Neutral' || fixtureCrowdAwayShare(f) !== 0.5)
    || nationsKnockouts.some((f) => fixtureVenueLabel(f) !== 'Neutral' || fixtureCrowdAwayShare(f) !== 0.5)
    || euroFinals.some((f) => fixtureVenueLabel(f) !== 'Neutral' || fixtureCrowdAwayShare(f) !== 0.5)
    || nationsGroups.some((f) => fixtureIsNeutral(f))
  ) {
    console.error('World Cup and Euro tournament games stay Neutral; Nations League groups are home and away');
    process.exitCode = 1;
  }
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
      if (fixture.kind !== 'international') continue;
      if (shouldSimulateNationQualifier(fixture, state)) {
        state = resolveFixture(state, fixture, madridClub!, 0, () => 0.3, { playerParticipated: false }).sim;
        continue;
      }
      if (shouldSkipFixture(fixture, state)) continue;
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

console.log('\n--- Display seasons ---');
console.log('unspecified 1', displaySeasonLabel(1), displaySeasonNumber(1));
console.log('first-team 1', displaySeasonLabel(1, { role: 'first-team' }), displaySeasonNumber(1, { role: 'first-team' }));
if (displaySeasonNumber(1, { role: 'first-team', careerStart: 'youth' }) !== 1) {
  console.error('youth-path first-team season 1 is public Season 1');
  process.exitCode = 1;
}
if (displaySeasonNumber(1, { role: 'reserve' }) !== null || displaySeasonLabel(1, { role: 'reserve' }) !== 'Reserves') {
  console.error('a leftover academy role must not show as Season 1');
  process.exitCode = 1;
}
if (displaySeasonNumber(1, { careerStart: 'favourite-first-team', role: 'first-team' }) !== 1) {
  console.error('favourite first-team starts as public Season 1');
  process.exitCode = 1;
}
if (!countsTowardCareerRecord(1, 'first-team') || countsTowardCareerRecord(1, 'reserve')) {
  console.error('first-team Season 1 must count for awards; reserve year must not');
  process.exitCode = 1;
}

console.log('\n--- International selection uses career ratio, nation rank, and league ---');
console.log('Spain bar', selectionRatioForNation('spain'), '(expect 0.66)');
console.log('San Marino bar', selectionRatioForNation('san-marino'));
if (selectionRatioForNation('spain') !== 0.66) {
  console.error('top-ranked countries must require a 0.66 career ratio');
  process.exitCode = 1;
}
const spainRising = isSelectedForNationalTeam({ clubTier: 1, careerGoalRatio: 0.66, nationId: 'spain', squadStatus: 'rising-star', league: 'Premier League' });
const spainStarter = isSelectedForNationalTeam({ clubTier: 1, careerGoalRatio: 0.66, nationId: 'spain', squadStatus: 'starter', league: 'Premier League' });
const spainMiss = isSelectedForNationalTeam({ clubTier: 1, careerGoalRatio: 0.65, nationId: 'spain', squadStatus: 'starter', league: 'Premier League' });
const lutonPick = isSelectedForNationalTeam({ clubTier: 5, careerGoalRatio: 1, nationId: 'spain', squadStatus: 'starter', league: 'Championship' });
const palacePick = isSelectedForNationalTeam({ clubTier: 4, careerGoalRatio: 0.66, nationId: 'spain', squadStatus: 'starter', league: 'Premier League' });
const ajaxSpain = isSelectedForNationalTeam({ clubTier: 2, careerGoalRatio: 0.9, nationId: 'spain', squadStatus: 'starter', league: 'Eredivisie' });
console.log('Spain starter/rising', spainStarter, spainRising, 'Spain 0.65', spainMiss, 'Spain at Luton', lutonPick, 'Spain at Palace', palacePick, 'Spain at Ajax', ajaxSpain);
if (!spainStarter || spainRising) {
  console.error('international call-ups must be starters only');
  process.exitCode = 1;
}
if (spainMiss || lutonPick || ajaxSpain || !palacePick) {
  console.error('Spain must pick Premier League starters on 0.66, not Championship or Eredivisie');
  process.exitCode = 1;
}
const albaniaLuton = isSelectedForNationalTeam({ clubTier: 5, careerGoalRatio: 0.4, nationId: 'albania', league: 'Championship' });
const albaniaAjax = isSelectedForNationalTeam({ clubTier: 2, careerGoalRatio: 0.4, nationId: 'albania', league: 'Eredivisie' });
const albaniaMiss = isSelectedForNationalTeam({ clubTier: 5, careerGoalRatio: 0.39, nationId: 'albania', league: 'Eredivisie' });
console.log('Albania Championship', albaniaLuton, 'Albania Ajax', albaniaAjax, 'Albania 0.39', albaniaMiss);
if (albaniaLuton || !albaniaAjax || albaniaMiss || leagueEligibleForNationalTeam('Championship', 'albania') || !leagueEligibleForNationalTeam('Premier League', 'spain')) {
  console.error('second divisions must never get a call-up; weaker nations can pick from any top flight');
  process.exitCode = 1;
}

{
  const fromCareer = callUpRatio({ season: { goals: 0, gamesPlayed: 0 }, careerGoals: 45, careerGames: 40 });
  const thinSample = callUpRatio({ season: { goals: 0, gamesPlayed: 13 }, careerGoals: 45, careerGames: 53 });
  const afterSample = callUpRatio({ season: { goals: 0, gamesPlayed: 15 }, careerGoals: 45, careerGames: 55 });
  const hotStart = callUpRatio({ season: { goals: 1, gamesPlayed: 1 }, careerGoals: 1, careerGames: 1 });
  console.log('call-up ratio career/thin/15-blank/hot', fromCareer.toFixed(2), thinSample.toFixed(2), afterSample.toFixed(2), hotStart.toFixed(2));
  if (fromCareer < 0.66 || thinSample < 0.66 || afterSample !== 0 || hotStart < 0.66) {
    console.error('call-up must use career or a hot start until 15 games, then this season');
    process.exitCode = 1;
  }
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
    console.error('Spain must not schedule internationals from the Championship');
    process.exitCode = 1;
  }
}
{
  const luton = getClub('luton');
  if (luton) {
    const hydrated = hydrateSeason({
      seasonNumber: 2,
      club: luton,
      careerGoalRatio: 0.5,
      nationId: 'albania',
    });
    console.log('Albania at Luton S2 intl selected', hydrated.sim.internationalSelected, '(expect false)');
    if (hydrated.sim.internationalSelected) {
      console.error('Albania must not call a player up from a second division');
      process.exitCode = 1;
    }
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
  if (s3Groups.length !== 3 || s3Ko.length !== 3) {
    console.error('season 3 must schedule 3 group games and QF/SF/final');
    process.exitCode = 1;
  }
  if (s3Intl.some((f) => f.internationalRound === 'qualifier')) {
    console.error('Nations League has no qualifying matches');
    process.exitCode = 1;
  }
  const spainRank = fifaRank('spain');
  const nlGroupOpp = s3Groups.filter((f) => f.opponentId);
  const nlNonUefa = nlGroupOpp.filter((f) => getNation(f.opponentId!)?.confederation !== 'UEFA');
  const nlFar = nlGroupOpp.filter((f) => Math.abs(fifaRank(f.opponentId!) - spainRank) > 35);
  console.log(
    'NL group ranks',
    nlGroupOpp.map((f) => `${f.opponentLabel} #${fifaRank(f.opponentId!)}`),
  );
  if (nlNonUefa.length > 0 || nlFar.length > 0) {
    console.error('Nations League group games must be closely ranked European countries only');
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
  if (s4Quals.length !== 0 || s4.sim.qualifierTarget !== 0 || (s4.sim.internationalStage !== 'group' && s4.sim.internationalStage !== 'friendly')) {
    console.error('season 4 must start at the tournament friendlies or group stage with zero qualifiers');
    process.exitCode = 1;
  }

  const youthFirst = hydrateSeason({
    seasonNumber: 1,
    club: madridClub,
    careerGoalRatio: 0.8,
    nationId: 'spain',
    careerStart: 'youth',
  });
  const youthIntl = youthFirst.calendar.fixtures.filter((f) => f.kind === 'international');
  console.log('youth first-team year 1', youthFirst.sim.internationalPhase, youthIntl.map((f) => f.internationalRound));
  if (youthFirst.sim.internationalPhase !== 'qualifiers' || youthIntl.some((f) => f.internationalRound !== 'qualifier')) {
    console.error('youth-path first-team Season 1 must be World Cup qualifying, not the tournament');
    process.exitCode = 1;
  }
  if (youthFirst.sim.internationalSelected) {
    console.error('Season 1 must not call the player up before week 20');
    process.exitCode = 1;
  }
  if (youthIntl.length < 5) {
    console.error('World Cup qualifying fixtures must still be on the Season 1 calendar');
    process.exitCode = 1;
  }
  const mixedWc = hydrateSeason({
    seasonNumber: 2,
    club: madridClub,
    careerGoalRatio: 0.8,
    nationId: 'spain',
  });
  const strippedGroup = ensureInternationalGroup(
    { ...mixedWc.sim, internationalGroup: null, internationalStage: 'qualifying' },
    mixedWc.calendar,
    2,
  );
  const wrongKind = ensureInternationalGroup(
    {
      ...mixedWc.sim,
      internationalStage: 'qualifying',
      internationalGroup: {
        letter: 'A',
        kind: 'finals',
        teamIds: ['spain', 'germany', 'brazil', 'serbia'],
        rows: [],
      },
    },
    mixedWc.calendar,
    2,
  );
  if (strippedGroup.internationalGroup?.kind !== 'qualifying' || wrongKind.internationalGroup?.kind !== 'qualifying') {
    console.error('existing saves must rebuild a qualifying table after restart, not the World Cup finals group');
    process.exitCode = 1;
  }
  const friendlyRec = bumpInternationalSeason(undefined, 'world-cup', false, 1, false);
  if (friendlyRec.finalsGames !== 0 || !isInternationalFinalsRound('round-of-16') || isInternationalFinalsRound('friendly')) {
    console.error('friendlies must not count as World Cup tournament games');
    process.exitCode = 1;
  }
  const shield = planDomesticSuperCup({
    nextClub: madridClub,
    previousClubId: madridClub.id,
    wonLeague: true,
    wonCup: false,
    previousLeague: 'La Liga',
  });
  if (!shield.include || shield.name !== 'Supercopa de España') {
    console.error('La Liga title winners must play the Supercopa de España');
    process.exitCode = 1;
  }
  const withShield = hydrateSeason({
    seasonNumber: 3,
    club: madridClub,
    careerGoalRatio: 0.8,
    nationId: 'spain',
    includeDomesticSuperCup: true,
    domesticSuperCupName: shield.name,
    domesticSuperCupOpponentId: shield.opponentId,
  });
  if (!withShield.calendar.fixtures.some((f) => f.domesticSuperCup && f.domesticSuperCupName === 'Supercopa de España')) {
    console.error('domestic super cups must be scheduled at the start of the next season');
    process.exitCode = 1;
  }

  const favFirst = hydrateSeason({
    seasonNumber: 1,
    club: madridClub,
    careerGoalRatio: 0.8,
    nationId: 'spain',
    careerStart: 'favourite-first-team',
  });
  const favIntl = favFirst.calendar.fixtures.filter((f) => f.kind === 'international');
  console.log('favourite first-team Season 1', favFirst.sim.internationalPhase, favIntl.map((f) => f.internationalRound));
  if (favFirst.sim.internationalPhase !== 'qualifiers' || favIntl.some((f) => f.internationalRound !== 'qualifier')) {
    console.error('favourite first-team Season 1 must not schedule the World Cup tournament');
    process.exitCode = 1;
  }

  const wolvesClub = getClub('wolves');
  if (wolvesClub) {
    if (clubContinentalCup(wolvesClub) !== 'uecl') {
      console.error('Wolves must play the Conference League, not the Champions League');
      process.exitCode = 1;
    }
    const favBrazilS2 = hydrateSeason({
      seasonNumber: 2,
      club: wolvesClub,
      careerGoalRatio: 1.13,
      nationId: 'brazil',
      careerStart: 'favourite-first-team',
    });
    const favBrazilS2Miss = hydrateSeason({
      seasonNumber: 2,
      club: wolvesClub,
      careerGoalRatio: 0,
      nationId: 'brazil',
      careerStart: 'favourite-first-team',
    });
    const s2Finals = favBrazilS2.calendar.fixtures.filter(
      (f) => f.kind === 'international' && f.internationalRound && f.internationalRound !== 'qualifier',
    );
    const s2Playable = remainingPlayableCount(favBrazilS2.calendar, favBrazilS2.sim);
    const s2MissPlayable = remainingPlayableCount(favBrazilS2Miss.calendar, favBrazilS2Miss.sim);
    console.log(
      'favourite Brazil S2',
      favBrazilS2.sim.internationalTournament,
      favBrazilS2.sim.internationalSelected,
      'finals',
      s2Finals.length,
      'playable',
      s2Playable,
      'unselected playable',
      s2MissPlayable,
      'weeks',
      favBrazilS2.calendar.totalWeeks,
    );
    if (
      favBrazilS2.sim.internationalTournament !== 'world-cup'
      || favBrazilS2.sim.internationalPhase !== 'qualifiers-and-tournament'
      || !favBrazilS2.sim.internationalSelected
      || s2Finals.length === 0
    ) {
      console.error('favourite Season 2 for Brazil must schedule the World Cup and select a 1.13-ratio player');
      process.exitCode = 1;
    }
    if (s2Playable <= s2MissPlayable) {
      console.error('World Cup finals must remain playable when the player is selected');
      process.exitCode = 1;
    }
    const skippedFinal = s2Finals[0];
    if (skippedFinal && !shouldSkipFixture(skippedFinal, favBrazilS2Miss.sim)) {
      console.error('unselected players must skip World Cup finals fixtures');
      process.exitCode = 1;
    }

    const favBrazilS4 = hydrateSeason({
      seasonNumber: 4,
      club: wolvesClub,
      careerGoalRatio: 1.13,
      nationId: 'brazil',
      careerStart: 'favourite-first-team',
    });
    const s4Finals = favBrazilS4.calendar.fixtures.filter((f) => f.kind === 'international');
    const s4Playable = remainingPlayableCount(favBrazilS4.calendar, favBrazilS4.sim);
    console.log(
      'favourite Brazil S4',
      favBrazilS4.sim.internationalTournament,
      favBrazilS4.sim.internationalPhase,
      'games',
      s4Finals.length,
      'playable',
      s4Playable,
      'weeks',
      favBrazilS4.calendar.totalWeeks,
    );
    if (
      favBrazilS4.sim.internationalTournament !== 'copa-america'
      || favBrazilS4.sim.internationalPhase !== 'tournament-only'
      || !favBrazilS4.sim.internationalSelected
      || s4Finals.length === 0
    ) {
      console.error('favourite Season 4 for Brazil must be the Copa América after the club season');
      process.exitCode = 1;
    }
    if (favBrazilS4.calendar.totalWeeks < 45 || s4Playable < 40) {
      console.error('Copa América season must run past the club calendar when the player is selected');
      process.exitCode = 1;
    }
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

console.log('\n--- Club trial: German nationality prefers a German club ---');
let germanTrials = 0;
let germanTierOk = 0;
for (let i = 0; i < 80; i++) {
  const club = pickTrialClub(3, 'germany');
  if (club.country === 'Germany') germanTrials += 1;
  if (Math.abs(club.tier - 3) <= 1) germanTierOk += 1;
}
console.log(`German trial club: ${germanTrials}/80 home; tier near 3: ${germanTierOk}/80`);
if (germanTrials < 80) {
  console.error('German players should trial at a German club when that tier has one');
  process.exitCode = 1;
}
if (germanTierOk < 80) {
  console.error('Home trial club must stay near the tier the U16 tournament earned');
  process.exitCode = 1;
}

console.log('\n--- Youth trials: geography and non-top-20 bands ---');
if (trialDestinationCountries('republic-of-ireland').join() !== 'England' || trialDestinationCountries('northern-ireland').join() !== 'England') {
  console.error('Ireland and Northern Ireland must trial in England');
  process.exitCode = 1;
}
if (trialDestinationCountries('nigeria').join() !== 'France') {
  console.error('African players must see French trial clubs');
  process.exitCode = 1;
}
if (trialDestinationCountries('norway').join() !== 'Germany,Netherlands') {
  console.error('Nordic players must see German or Dutch trial clubs');
  process.exitCode = 1;
}
if (trialDestinationCountries('poland').join() !== 'Germany,Netherlands,Italy') {
  console.error('Eastern Europe must see German, Dutch or Italian trial clubs');
  process.exitCode = 1;
}
if (trialDestinationCountries('brazil').join() !== 'Spain,Portugal') {
  console.error('South American players must see Spain or Portugal');
  process.exitCode = 1;
}
if (trialDestinationCountries('united-states').join() !== 'United States' || trialDestinationCountries('mexico').join() !== 'United States') {
  console.error('CONCACAF players must see MLS');
  process.exitCode = 1;
}
if (trialDestinationCountries('qatar').join() !== 'Saudi Arabia') {
  console.error('Middle East players must see Saudi clubs');
  process.exitCode = 1;
}
let irelandEngland = 0;
for (let i = 0; i < 40; i++) {
  const clubs = pickTrialClubs(3, 'republic-of-ireland', [], 3, { geographyNationId: 'republic-of-ireland' });
  irelandEngland += clubs.filter((club) => club.country === 'England').length >= 2 ? 1 : 0;
}
console.log('Ireland England looks', irelandEngland, '/40');
if (irelandEngland < 32) {
  console.error('Ireland players should usually see two England trial options');
  process.exitCode = 1;
}
if (youthTierForNation(1, 'ghana') !== 3 || youthTierForNation(0.66, 'ghana') !== 4 || youthTierForNation(0.33, 'ghana') !== 5 || youthTierForNation(0, 'ghana') !== 5) {
  console.error('nations outside the FIFA top 20 cannot earn Elite/Strong youth trials');
  process.exitCode = 1;
}
if (tierForYouthGoals(7, 7, 'ghana') !== 3 || tierForYouthGoals(0, 7, 'ghana') !== 5 || !youthTrialsAreMlsOnly(0, 'ghana')) {
  console.error('a blank youth campaign from outside the top 20 must stay lower-level and MLS-only');
  process.exitCode = 1;
}
if (tierForYouthGoals(3, 4, 'spain') !== 1) {
  console.error('top-20 nations keep the existing elite youth band');
  process.exitCode = 1;
}
if (SKIN_SWATCHES.length < 6 || HAIR_SWATCHES.length < 5) {
  console.error('players must be able to pick several skin and hair colours');
  process.exitCode = 1;
}

console.log('\n--- U16 opening: youth goals map to club tiers ---');
if (
  tierForYouthGoals(3, 4) !== 1
  || tierForYouthGoals(3, 3) !== 1
  || tierForYouthGoals(2, 4) !== 3
  || tierForYouthGoals(1, 4) !== 5
  || tierForYouthGoals(0, 4) !== 5
) {
  console.error('3/4 (0.75) must be Elite; 2/4 Mid-table; 1/4 and blanks stay lower level');
  process.exitCode = 1;
}
const chanceSum = CLUB_TRIAL_CHANCE_SPLIT.reduce((sum, n) => sum + n, 0);
console.log('club trial chance split', [...CLUB_TRIAL_CHANCE_SPLIT], 'sum', chanceSum);
if (chanceSum !== 10 || CLUB_TRIAL_CHANCE_SPLIT.length !== CLUB_TRIAL_GAMES) {
  console.error('club trial must be 3 games offering 10 chances in total');
  process.exitCode = 1;
}
if (youthMaxGames() !== 7) {
  console.error('U16 tournament is 7 games at most');
  process.exitCode = 1;
}
if (
  nextYouthKnockoutRound('group', true) !== 'round-of-16'
  || nextYouthKnockoutRound('round-of-16', false) !== 'done'
  || nextYouthKnockoutRound('semi-final', false) !== 'third-place'
  || nextYouthKnockoutRound('semi-final', true) !== 'final'
) {
  console.error('U16 knockout path must include last 16, and a 3rd-place game after a semi-final loss');
  process.exitCode = 1;
}

const fixedRng = (() => {
  let i = 0;
  const seq = [0.11, 0.42, 0.73, 0.28, 0.91, 0.05, 0.64, 0.37, 0.82, 0.19];
  return () => seq[i++ % seq.length];
})();
const youth = createYouthCampaign('spain', fixedRng);
console.log('U16 opener', youth.youthName, 'group', youth.groupOpponents, 'fixtures', youth.calendar.fixtures.length);
if (youth.youthName !== 'UEFA Youth Championship' || youth.calendar.fixtures.length !== 3) {
  console.error('Spain must open in the UEFA Youth Championship group of three matches');
  process.exitCode = 1;
}
if (youth.calendar.fixtures.some((f) => f.kind !== 'international' || f.internationalRound !== 'group')) {
  console.error('the first three U16 matches must be group games');
  process.exitCode = 1;
}

let campaign = youth;
for (let i = 0; i < 3; i++) {
  const fixture = campaign.calendar.fixtures[i];
  const result = resolveOpeningMatch(fixture, 1, null, 'spain', () => 0.2);
  campaign = applyYouthMatch(campaign, fixture, result, 1, 'spain', () => 0.2);
}
console.log('after group', campaign.qualified, 'games', campaign.gamesPlayed, 'next', campaign.calendar.fixtures[3]?.internationalRound);
if (campaign.calendar.fixtures.length !== 3 && campaign.qualified !== true && campaign.qualified !== false) {
  console.error('group stage must resolve qualification');
  process.exitCode = 1;
}
if (campaign.qualified) {
  if (campaign.calendar.fixtures[3]?.internationalRound !== 'round-of-16') {
    console.error('qualifiers must play a last-16 tie next');
    process.exitCode = 1;
  }
} else if (!youthTournamentComplete(campaign)) {
  console.error('failing to qualify must end the U16 tournament');
  process.exitCode = 1;
}

const alwaysWin = { outcome: 'win' as const, scoreFor: 2, scoreAgainst: 0 };
let path = createYouthCampaign('germany', () => 0.4);
for (let i = 0; i < 3; i++) {
  path = applyYouthMatch(path, path.calendar.fixtures[path.fixtureIndex], alwaysWin, 1, 'germany', () => 0.4);
}
if (path.qualified) {
  path = applyYouthMatch(path, path.calendar.fixtures[path.fixtureIndex], alwaysWin, 1, 'germany', () => 0.4);
  path = applyYouthMatch(path, path.calendar.fixtures[path.fixtureIndex], alwaysWin, 1, 'germany', () => 0.4);
  const beforeSemi = path.calendar.fixtures.length;
  path = applyYouthMatch(path, path.calendar.fixtures[path.fixtureIndex], { outcome: 'loss', scoreFor: 0, scoreAgainst: 1 }, 0, 'germany', () => 0.4);
  const afterSemi = path.calendar.fixtures[path.fixtureIndex];
  console.log('semi-final loss next', afterSemi?.internationalRound, 'games so far', path.gamesPlayed);
  if (afterSemi?.internationalRound !== 'third-place') {
    console.error('a semi-final loss must schedule the third-place play-off');
    process.exitCode = 1;
  }
  path = applyYouthMatch(path, path.calendar.fixtures[path.fixtureIndex], alwaysWin, 1, 'germany', () => 0.4);
  if (!youthTournamentComplete(path) || path.gamesPlayed > 7 || path.calendar.fixtures.length > 7) {
    console.error('U16 campaign cannot exceed 7 games');
    process.exitCode = 1;
  }
  if (beforeSemi > 6) {
    console.error('semi-final should be game 6 at most');
    process.exitCode = 1;
  }
}

{
  useCareerStore.getState().resetCareer();
  const opening = createYouthCampaign('spain', () => 0.31);
  const first = opening.calendar.fixtures[0];
  useCareerStore.setState({
    nationality: 'spain',
    careerStart: 'youth',
    openingCampaign: opening,
    liveMatch: {
      fixtureIndex: 0,
      chancesTotal: first?.playerChances ?? 1,
      chancesTaken: first?.playerChances ?? 1,
      goals: 1,
      openPlayGoals: 1,
    },
    seasonCalendar: opening.calendar,
    seasonSim: null,
    currentSeason: null,
    lastMatchResult: null,
    phase: 'match',
  });
  useCareerStore.getState().finishLiveMatch();
  const afterFirst = useCareerStore.getState();
  if (afterFirst.phase !== 'match-result' || afterFirst.lastMatchResult?.afterPhase !== 'hub' || afterFirst.openingCampaign?.fixtureIndex !== 1) {
    console.error('youth match 1 must recap and leave the second group game queued');
    process.exitCode = 1;
  }
  useCareerStore.getState().acknowledgeMatchResult();
  const afterAck = useCareerStore.getState();
  if (afterAck.phase !== 'hub' || afterAck.lastMatchResult) {
    console.error('continuing the youth recap must clear lastMatchResult so the next match can start');
    process.exitCode = 1;
  }
  useCareerStore.getState().advance();
  const matchTwo = useCareerStore.getState();
  console.log('youth match 2', matchTwo.phase, matchTwo.liveMatch?.fixtureIndex, matchTwo.openingCampaign?.fixtureIndex);
  if (matchTwo.phase !== 'match' || matchTwo.liveMatch?.fixtureIndex !== 1 || matchTwo.openingCampaign?.fixtureIndex !== 1) {
    console.error('Play Next Match after youth game 1 must open group match 2');
    process.exitCode = 1;
  }
  useCareerStore.getState().resetCareer();
}

{
  const weak = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const rng = () => (i * 17 + 3) % 1000 / 1000;
    pickYouthGroupOpponents('spain', rng).forEach((id) => weak.add(id));
    pickYouthKnockoutOpponent('spain', [], rng, 'round-of-16');
    for (const round of ['round-of-16', 'quarter-final', 'semi-final', 'final'] as const) {
      weak.add(pickYouthKnockoutOpponent('spain', ['france'], () => (i * 13 + round.length) % 97 / 97, round));
    }
  }
  if (weak.has('gibraltar')) {
    console.error('youth championships must not draw Gibraltar into groups or knockouts');
    process.exitCode = 1;
  }
}

{
  const scoredWins = Array.from({ length: 400 }, () =>
    settleDrawOnPenalties({ scoreFor: 1, scoreAgainst: 1, outcome: 'draw' }, true, Math.random).outcome === 'win',
  ).filter(Boolean).length;
  const missedWins = Array.from({ length: 400 }, () =>
    settleDrawOnPenalties({ scoreFor: 1, scoreAgainst: 1, outcome: 'draw' }, false, Math.random).outcome === 'win',
  ).filter(Boolean).length;
  console.log('knockout pens scored/missed win rates', scoredWins / 400, missedWins / 400);
  if (scoredWins / 400 < 0.7 || scoredWins / 400 > 0.9 || missedWins / 400 < 0.1 || missedWins / 400 > 0.3) {
    console.error('knockout penalties must be 80% if the player scored and 20% if they missed');
    process.exitCode = 1;
  }
  {
    const teamP = 0.5;
    const missP = teamP * missedChanceWinFactor(1);
    const missWithTeam = Array.from({ length: 400 }, () =>
      settleDrawOnPenalties({ scoreFor: 1, scoreAgainst: 1, outcome: 'draw' }, false, Math.random, teamP).outcome === 'win',
    ).filter(Boolean).length / 400;
    console.log('pens miss vs team-win-p', missWithTeam, 'target', missP);
    if (missWithTeam < missP - 0.08 || missWithTeam > missP + 0.08) {
      console.error('a missed shootout kick must scale the original 90-minute win chance');
      process.exitCode = 1;
    }
  }
  const settled = settleDrawOnPenalties({ scoreFor: 2, scoreAgainst: 2, outcome: 'draw' }, true, () => 0);
  if (settled.scoreFor !== 2 || settled.scoreAgainst !== 2 || !settled.penalties?.won) {
    console.error('penalties must keep the 90-minute score and mark who went through');
    process.exitCode = 1;
  }
}

const assigned = assignOpeningTrialClub({ ...path, goals: 7, youthGoals: 7 }, 'germany');
if ((assigned.trialClubIds ?? []).length !== 3 || assigned.trialTier !== 1 || assigned.trialClubId) {
  console.error('a 1.00 U16 ratio must offer three Elite clubs to choose from');
  process.exitCode = 1;
}
if ((assigned.trialClubIds ?? []).some((id) => getClub(id)?.tier !== 1)) {
  console.error('every youth trial offer at 0.75+ must be Elite');
  process.exitCode = 1;
}
const threeFromFour = assignOpeningTrialClub({ ...path, goals: 3, youthGoals: 3, gamesPlayed: 4 }, 'germany');
if (threeFromFour.trialTier !== 1 || (threeFromFour.trialClubIds ?? []).length !== 3) {
  console.error('3 goals in 4 U16 games (0.75) must offer three Elite trials');
  process.exitCode = 1;
}
const staleLower = assignOpeningTrialClub({
  ...path,
  goals: 3,
  youthGoals: 3,
  gamesPlayed: 4,
  eliminated: true,
  trialTier: 5,
  trialClubId: 'luton',
  trialClubIds: [],
}, 'england');
if (
  staleLower.trialTier !== 1
  || staleLower.trialClubId
  || (staleLower.trialClubIds ?? []).length !== 3
  || (staleLower.trialClubIds ?? []).some((id) => getClub(id)?.tier !== 1)
) {
  console.error('a stuck Lower-level 3/4 save must be repaired to three Elite trial buttons');
  process.exitCode = 1;
}
const repairedEngland = repairOpeningCampaign({
  ...path,
  goals: 3,
  youthGoals: 3,
  gamesPlayed: 4,
  eliminated: true,
  trialTier: 5,
  trialClubId: 'luton',
  trialClubIds: [],
}, 'england');
if (repairedEngland.trialTier !== 1 || (repairedEngland.trialClubIds ?? []).length !== 3) {
  console.error('persist repair must refill Elite clubs for a 0.75 England youth finish');
  process.exitCode = 1;
}
{
  useCareerStore.getState().resetCareer();
  useCareerStore.setState({
    nationality: 'england',
    careerStart: 'youth',
    phase: 'opening-brief',
    openingCampaign: {
      ...path,
      goals: 3,
      youthGoals: 3,
      gamesPlayed: 4,
      eliminated: true,
      trialTier: 5,
      trialClubId: 'luton',
      trialClubIds: [],
    },
  });
  useCareerStore.getState().repairOpeningTrialPicker();
  const fixed = useCareerStore.getState().openingCampaign;
  if (fixed?.trialTier !== 1 || (fixed.trialClubIds ?? []).length !== 3) {
    console.error('repairOpeningTrialPicker must unstick a 3/4 England brief with no buttons');
    process.exitCode = 1;
  }
  useCareerStore.getState().resetCareer();
}
const germanElite = pickTrialClub(1, 'germany');
console.log('German elite trial', germanElite.id, germanElite.country, germanElite.tier);
if (germanElite.country !== 'Germany' || germanElite.tier !== 1) {
  console.error('a German player who earned elite should trial at a German elite club when one exists');
  process.exitCode = 1;
}

const trialStart = chooseTrialClub(assigned, assigned.trialClubIds?.[0] ?? '');
console.log('club trial fixtures', trialStart.calendar.fixtures.map((f) => `${f.opponentLabel} ${f.isHome ? 'H' : 'A'} x${f.playerChances}`));
if (
  trialStart.calendar.fixtures.length !== 3
  || trialStart.calendar.fixtures.some((f) => f.kind !== 'league')
  || trialStart.calendar.fixtures.map((f) => f.playerChances).join() !== '4,3,3'
  || trialStart.calendar.fixtures.filter((f) => f.isHome).length !== 2
) {
  console.error('club trial must be 3 league games, 4+3+3 chances, home/away/home');
  process.exitCode = 1;
}
const trialClub = getClub(trialStart.trialClubId ?? '');
if (!trialClub || trialStart.calendar.fixtures.some((f) => {
  const opp = f.opponentId ? getClub(f.opponentId) : undefined;
  return !opp || opp.league !== trialClub.league || opp.id === trialClub.id;
})) {
  console.error('trial opponents must be other clubs in the same league');
  process.exitCode = 1;
}

let failed = trialStart;
failed = applyTrialMatch(failed, 0);
failed = applyTrialMatch(failed, 0);
failed = applyTrialMatch(failed, 0);
if (!clubTrialComplete(failed) || trialContractWon(trialClub, failed.goals, failed.gamesPlayed)) {
  console.error('a blank trial must fail the club ratio');
  process.exitCode = 1;
}
const firstFail = failClubTrial(failed, 'germany');
console.log('same-level retry', failed.trialClubId, '->', firstFail.opening.trialClubIds, firstFail.opening.trialTier, 'exhausted', firstFail.exhausted);
if (
  firstFail.exhausted
  || firstFail.opening.trialTier !== trialStart.trialTier
  || firstFail.opening.trialClubId
  || (firstFail.opening.trialClubIds ?? []).length !== 2
  || (firstFail.opening.trialClubIds ?? []).includes(trialStart.trialClubId ?? '')
) {
  console.error('failing a trial must leave the other two clubs at the same level');
  process.exitCode = 1;
}
let secondLook = chooseTrialClub(firstFail.opening, firstFail.opening.trialClubIds?.[0] ?? '');
secondLook = applyTrialMatch(secondLook, 1);
secondLook = applyTrialMatch(secondLook, 0);
secondLook = applyTrialMatch(secondLook, 0);
const secondFail = failClubTrial(secondLook, 'germany');
if (
  secondFail.exhausted
  || secondFail.opening.trialTier !== trialStart.trialTier
  || (secondFail.opening.trialClubIds ?? []).length !== 1
) {
  console.error('the second miss must still offer the last club at the same level');
  process.exitCode = 1;
}
let thirdLook = chooseTrialClub(secondFail.opening, secondFail.opening.trialClubIds?.[0] ?? '');
thirdLook = applyTrialMatch(thirdLook, 0);
thirdLook = applyTrialMatch(thirdLook, 0);
thirdLook = applyTrialMatch(thirdLook, 0);
const thirdFail = failClubTrial(thirdLook, 'germany');
console.log('three looks drop', thirdFail.exhausted, thirdFail.opening.trialClubIds, thirdFail.opening.trialTier, 'best', thirdFail.opening.bestTrialRatio.toFixed(2));
if (
  thirdFail.exhausted
  || thirdFail.opening.trialTier !== (trialStart.trialTier ?? 1) + 1
  || (thirdFail.opening.trialClubIds ?? []).length !== 3
) {
  console.error('three missed looks at a level must offer three clubs one band down');
  process.exitCode = 1;
}
if (Math.abs(thirdFail.opening.bestTrialRatio - 1 / 3) > 1e-9) {
  console.error('best trial ratio must keep the highest of the three looks');
  process.exitCode = 1;
}
let dropLook = thirdFail.opening;
for (let i = 0; i < 3; i++) {
  dropLook = chooseTrialClub(dropLook, dropLook.trialClubIds?.[0] ?? '');
  dropLook = applyTrialMatch(dropLook, 0);
  dropLook = applyTrialMatch(dropLook, 0);
  dropLook = applyTrialMatch(dropLook, 0);
  const dropped = failClubTrial(dropLook, 'germany');
  if (i < 2 && (dropped.exhausted || dropped.opening.trialTier !== thirdFail.opening.trialTier)) {
    console.error('the dropped band must still give three looks before offers');
    process.exitCode = 1;
  }
  if (i === 2 && !dropped.exhausted) {
    console.error('six missed looks must open transfer offers');
    process.exitCode = 1;
  }
  dropLook = dropped.opening;
}
const trialOffers = trialFailTransferPending({
  bestRatio: dropLook.bestTrialRatio,
  nationality: 'germany',
  excludeIds: dropLook.rejectedClubIds,
  homeCountry: dropLook.originCountry ?? 'Germany',
  minFromCountry: 4,
});
const trialOfferTier = tierForRatio(dropLook.bestTrialRatio);
const trialOfferTiers = (trialOffers.offers ?? []).map((o) => getClub(o.clubId)?.tier ?? 0);
const trialOfferHome = (trialOffers.offers ?? []).filter((o) => getClub(o.clubId)?.country === 'Germany').length;
console.log('trial-fail offers', trialOffers.kind, trialOfferTiers, 'band', trialOfferTier, 'home', trialOfferHome);
if (trialOffers.kind !== 'trial-offers' || trialOffers.allowDecline || trialOffers.offers.some((o) => o.move !== 'permanent')) {
  console.error('exhausted trials must produce transfer offers, not loans');
  process.exitCode = 1;
}
if (trialOfferTiers.length === 0 || trialOfferTiers.some((tier) => tier !== trialOfferTier)) {
  console.error('trial-fail offers must all come from the best-ratio band');
  process.exitCode = 1;
}
  if (trialOffers.offers.some((o) => {
  const dest = getClub(o.clubId);
  return !dest || o.weeklyWage !== weeklyWageForSquadStatus(dest, 0, 'rising-star') || o.contractYears !== FIRST_CONTRACT_YEARS || o.squadStatus !== 'rising-star';
})) {
  console.error('trial-fail offers are 3-year Rising star deals at 10% of each club’s average wage');
  process.exitCode = 1;
}
if (trialOfferHome < 4) {
  console.error('trial-fail offers must prefer four clubs from the original country when that band has them');
  process.exitCode = 1;
}
const blankOffers = trialFailTransferPending({
  bestRatio: 0,
  nationality: 'spain',
  excludeIds: ['real-madrid'],
  homeCountry: 'Spain',
  minFromCountry: 4,
});
const blankHome = (blankOffers.offers ?? []).filter((o) => getClub(o.clubId)?.country === 'Spain').length;
if ((blankOffers.offers ?? []).some((o) => (getClub(o.clubId)?.tier ?? 1) !== 5) || blankOffers.offers.length === 0) {
  console.error('a 0.00 trial ratio must only attract lower-level clubs');
  process.exitCode = 1;
}
if (blankHome < 4) {
  console.error('a 0.00 Spanish favourite path must offer four Spanish lower-level clubs when they exist');
  process.exitCode = 1;
}
const favouriteClub = getClub('real-madrid');
if (favouriteClub) {
  let favourite = beginFavouriteClubTrial(favouriteClub);
  favourite = applyTrialMatch(favourite, 0);
  favourite = applyTrialMatch(favourite, 0);
  favourite = applyTrialMatch(favourite, 0);
  const favRetry = failClubTrial(favourite, 'spain');
  console.log('favourite trial retry', favourite.trialClubId, '->', favRetry.opening.trialClubIds, favRetry.opening.trialTier);
  if (
    favRetry.exhausted
    || (favRetry.opening.trialClubIds ?? []).includes('real-madrid')
    || (favRetry.opening.trialClubIds ?? []).length !== 2
    || favRetry.opening.trialTier !== favouriteClub.tier
  ) {
    console.error('missing a favourite-club trial must offer two more clubs at the same level, not a forced loan');
    process.exitCode = 1;
  }
  let favLook = favRetry.opening;
  for (let i = 0; i < 2; i++) {
    favLook = chooseTrialClub(favLook, favLook.trialClubIds?.[0] ?? '');
    favLook = applyTrialMatch(favLook, 0);
    favLook = applyTrialMatch(favLook, 0);
    favLook = applyTrialMatch(favLook, 0);
    favLook = failClubTrial(favLook, 'spain').opening;
  }
  console.log('favourite drop', favLook.trialClubIds, favLook.trialTier, favLook.originCountry);
  if (favLook.trialTier !== favouriteClub.tier + 1 || (favLook.trialClubIds ?? []).length !== 3) {
    console.error('failing three elite favourite trials must offer three clubs one level down');
    process.exitCode = 1;
  }
  const secondRound = [...(favLook.trialClubIds ?? []), ...favLook.rejectedClubIds]
    .map((id) => (id ? getClub(id) : undefined))
    .filter((c) => c && c.tier === favLook.trialTier);
  const homeSecond = secondRound.filter((c) => c?.country === 'Spain').length;
  if (homeSecond < 1) {
    console.error('the dropped trial band should prefer clubs from the original favourite country');
    process.exitCode = 1;
  }
}
const passClub = trialClub;
if (!trialContractWon(passClub, 3, 3)) {
  console.error('3 goals in 3 trial games must beat every club ratio');
  process.exitCode = 1;
}

const picker = playableClubsGroupedByLeague();
if (picker.some((g) => g.league === 'Liga MX' || g.clubs.some((c) => c.playable === false))) {
  console.error('the favourite-club picker must hide cup-only guest clubs');
  process.exitCode = 1;
}
if (!picker.some((g) => g.league === 'Premier League' && g.clubs.some((c) => c.id === 'liverpool'))) {
  console.error('the favourite-club picker must include playable league clubs');
  process.exitCode = 1;
}
if (
  !picker.some((g) => g.league === 'Primeira Liga' && g.clubs.some((c) => c.id === 'benfica'))
  || !picker.some((g) => g.league === 'Eredivisie' && g.clubs.some((c) => c.id === 'ajax'))
  || !picker.some((g) => g.league === 'Super Lig' && g.clubs.some((c) => c.id === 'galatasaray'))
) {
  console.error('the favourite-club picker must include Primeira Liga, Eredivisie and Super Lig');
  process.exitCode = 1;
}

console.log('\n--- Transfer offers: at least one home-nation club ---');
const dummySeason: SeasonRecord = {
  seasonNumber: 3,
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
if (saleLoans !== LOAN_OFFER_COUNT || salePerms.length !== TRANSFER_OFFER_COUNT) {
  console.error('a failed first-team season must offer 3 loans and 6 transfers');
  process.exitCode = 1;
}
if (salePerms.some((o) => {
  const expected = o.squadStatus === 'reserve' ? RESERVE_CONTRACT_YEARS : newContractYears(20);
  return o.contractYears !== expected;
})) {
  console.error('permanent sale offers for a 20-year-old must be 5-year starter deals or 3-year reserve deals');
  process.exitCode = 1;
}
{
  const saleValue = playerMarketValueFromSeasons({
    age: 20,
    careerGoals: 2,
    careerGames: 24,
    seasons: [dummySeason],
    fallbackClub: getClub('bayern')!,
    contractYearsRemaining: DEFAULT_CONTRACT_YEARS,
    seasonNumber: 3,
    calendarWeek: 99,
  });
  if (!salePerms.some((o) => {
    const dest = getClub(o.clubId);
    return o.squadStatus === 'reserve' && dest != null && o.weeklyWage === weeklyWageForSquadStatus(dest, saleValue, 'reserve');
  })) {
    console.error('a low-ratio sale window must include reserve roles at 20% of that club’s starter wage');
    process.exitCode = 1;
  }
}
{
  const saleSaudi = salePerms.filter((o) => getClub(o.clubId)?.league === 'Saudi Pro League');
  if (saleSaudi.length !== 1) {
    console.error('a 20-year-old sale window must include exactly one Saudi offer');
    process.exitCode = 1;
  }
  const teenSale = resolveSeasonTransition({
    season: { ...dummySeason, age: 17 },
    role: 'first-team',
    clubId: 'bayern',
    parentClubId: 'bayern',
    seasonsAtCurrentClub: 1,
    age: 17,
    careerGoals: 2,
    careerGames: 24,
    nationality: 'germany',
    loansUsed: 0,
  });
  const teenSaudi = (teenSale.pendingTransfer?.offers ?? []).filter((o) => getClub(o.clubId)?.league === 'Saudi Pro League');
  console.log('Saudi age gate', '20', saleSaudi.map((o) => o.clubId), '17', teenSaudi.map((o) => o.clubId));
  if (teenSaudi.length !== 0) {
    console.error('Saudi offers must not appear before age 20');
    process.exitCode = 1;
  }
}

{
  const loanSale = resolveSeasonTransition({
    season: {
      ...dummySeason,
      clubId: 'luton',
      role: 'loan',
      goals: 4,
      gamesPlayed: 24,
      leagueGoals: 4,
    },
    role: 'loan',
    clubId: 'luton',
    parentClubId: 'real-madrid',
    seasonsAtCurrentClub: 1,
    age: 19,
    careerGoals: 8,
    careerGames: 48,
    nationality: 'spain',
    loansUsed: 2,
  });
  const saleOffers = (loanSale.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent');
  const saleOfferTiers = [...new Set(saleOffers.map((o) => getClub(o.clubId)?.tier))];
  console.log('reserve-path two-loan sale tiers', saleOfferTiers, loanSale.pendingTransfer?.kind);
  if (loanSale.pendingTransfer?.kind !== 'sold' || saleOfferTiers.length !== 1) {
    console.error('after two failed loans the sale window must stay on one ratio-earned band');
    process.exitCode = 1;
  }
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
for (const [league, target] of Object.entries(TARGET_LEAGUE_SIZE)) {
  const size = clubsInLeague(league).filter((c) => c.playable !== false).length;
  if (size !== target) {
    console.error(`${league} has ${size} clubs; need ${target}`);
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

console.log('\n--- Primeira Liga, Eredivisie, Super Lig calendars ---');
{
  const benfica = getClub('benfica');
  const ajax = getClub('ajax');
  const gala = getClub('galatasaray');
  if (!benfica || !ajax || !gala) {
    console.error('Benfica, Ajax and Galatasaray must exist');
    process.exitCode = 1;
  } else {
    const benficaSeason = hydrateSeason({ seasonNumber: 2, club: benfica, careerGoalRatio: 0.8, nationId: 'portugal' });
    const leagueGames = benficaSeason.calendar.fixtures.filter((f) => f.kind === 'league' && f.opponentId).length;
    console.log(
      'Benfica league games',
      leagueGames,
      'cup',
      benficaSeason.sim.domesticCup,
      'europe',
      clubContinentalCup(benfica),
    );
    if (leagueGames !== 34 || leagueMatchWeeks('Primeira Liga', benfica) !== 34) {
      console.error('Primeira Liga must be 18 clubs / 34 league weeks');
      process.exitCode = 1;
    }
    if (benficaSeason.sim.domesticCup !== 'taca-de-portugal' || domesticCupForCountry('Portugal') !== 'taca-de-portugal') {
      console.error('Benfica must play the Taça de Portugal');
      process.exitCode = 1;
    }
    if (clubContinentalCup(benfica) !== 'uel') {
      console.error('Benfica typical status is Europa League');
      process.exitCode = 1;
    }
    const ajaxSeason = hydrateSeason({ seasonNumber: 2, club: ajax, careerGoalRatio: 0.8, nationId: 'netherlands' });
    const galaSeason = hydrateSeason({ seasonNumber: 2, club: gala, careerGoalRatio: 0.8, nationId: 'turkey' });
    if (ajaxSeason.sim.domesticCup !== 'knvb-beker' || galaSeason.sim.domesticCup !== 'turkish-cup') {
      console.error('Ajax and Galatasaray must play their domestic cups');
      process.exitCode = 1;
    }
    if (leagueMatchWeeks('Eredivisie', ajax) !== 34 || leagueMatchWeeks('Super Lig', gala) !== 34) {
      console.error('Eredivisie and Super Lig must be 34-game seasons');
      process.exitCode = 1;
    }
  }
}

console.log('\n--- Old-save rules stamp rebuilds the remaining calendar ---');
{
  const benfica = getClub('benfica')!;
  const { calendar, sim } = hydrateSeason({ seasonNumber: 4, club: benfica, careerGoalRatio: 0.72, nationId: 'portugal' });
  const mid = calendar.fixtures.findIndex((f) => f.week >= 12);
  sim.fixtureIndex = mid >= 0 ? mid : 8;
  const currentSeason: SeasonRecord = {
    seasonNumber: 4,
    clubId: 'benfica',
    role: 'first-team',
    matches: [],
    goals: 11,
    gamesPlayed: 14,
    ratioMet: true,
    age: 19,
    leagueGoals: 9,
    leagueGames: 11,
    cupGames: 2,
    cupGoals: 1,
    domesticGames: 13,
    domesticGoals: 10,
    continentalStats: [],
    trophies: [],
    topGoalscorer: false,
    playerOfTheYear: false,
    wonWpy: false,
  };
  const stale = {
    phase: 'hub' as const,
    clubId: 'benfica',
    role: 'first-team' as const,
    seasonNumber: 4,
    nationality: 'portugal',
    clubLeague: 'Primeira Liga',
    seasonCalendar: calendar,
    seasonSim: sim,
    currentSeason,
    careerGoals: 40,
    careerGames: 70,
    careerStart: 'favourite-first-team' as const,
    rulesStamp: null,
    intlQualifying: null,
    nationalTeam: null,
    qualifiedContinentalCup: 'uel' as const,
  };
  if (!saveNeedsRebuild(stale)) {
    console.error('an in-progress save without the current rules stamp must offer a rebuild');
    process.exitCode = 1;
  }
  if (migratedRulesStamp({ phase: 'menu' }) !== CURRENT_RULES_STAMP) {
    console.error('menu saves must quiet-migrate onto the current rules stamp');
    process.exitCode = 1;
  }
  if (migratedRulesStamp(stale) != null) {
    console.error('in-progress saves must keep a missing stamp so the hub can rebuild');
    process.exitCode = 1;
  }
  const rebuilt = rebuildCurrentSeason(stale as CareerState);
  const rebuiltWeek = rebuilt.seasonCalendar && rebuilt.seasonSim
    ? rebuilt.seasonCalendar.fixtures[rebuilt.seasonSim.fixtureIndex]?.week
    : 0;
  console.log('rebuild stamp', rebuilt.rulesStamp, 'week', rebuiltWeek, 'goals kept', currentSeason.goals);
  if (rebuilt.rulesStamp !== CURRENT_RULES_STAMP) {
    console.error('rebuild must stamp the current rules');
    process.exitCode = 1;
  }
  if (!rebuilt.seasonSim || rebuilt.seasonSim.fixtureIndex === 0 || (rebuiltWeek ?? 0) < 12) {
    console.error('rebuild must skip ahead to the same calendar week');
    process.exitCode = 1;
  }
  if (currentSeason.goals !== 11 || currentSeason.gamesPlayed !== 14) {
    console.error('rebuild must not wipe stats already earned');
    process.exitCode = 1;
  }
  if (!rebuilt.seasonCalendar?.fixtures.some((f) => f.domesticCup === 'taca-de-portugal')) {
    console.error('rebuilt Benfica calendar must still include the Taça de Portugal');
    process.exitCode = 1;
  }
  if (!rebuilt.seasonCalendar?.fixtures.some((f) => f.continentalCup === 'uel')) {
    console.error('rebuilt Benfica calendar must keep the Europa League campaign');
    process.exitCode = 1;
  }
  if (saveNeedsRebuild({ ...stale, ...rebuilt })) {
    console.error('a rebuilt save must not keep asking to rebuild');
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
  const plPeer = getClub('aston-villa');
  const plSameStrength = plPeer ? playerMarketValue({ age: 18, ratio: 0.9, careerGoals: 22, club: plPeer }) : 0;
  if (mlsSpell >= young * 0.5) {
    console.error('goals in MLS must be worth less than the same spell at Barcelona');
    process.exitCode = 1;
  }
  if (!plPeer || plSameStrength <= mlsSpell * 2.5) {
    console.error('a 0.9 ratio in the Premier League must count for far more than the same ratio in MLS');
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
  console.log('MLS spell', mlsSpell, 'PL similar strength', plSameStrength, 'mixed Barca/MLS', mixed, 'all Barca', allBarca);
  if (mixed >= allBarca) {
    console.error('a Barcelona/MLS split must be worth less than the same goals only at Barcelona');
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
  // Listed European tops (Atlético €400k) now sit in the elite band. Saudi stays
  // on the previous formula: above MLS, well below published European salaries.
  if (saudiWage <= mlsWage * 3 || saudiWage < 20_000) {
    console.error('Saudi formula wages must stay well above MLS');
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
  if (highWage <= 0 || euroWage <= highWage) {
    console.error('elite weekly wages must sit above a high-tier club');
    process.exitCode = 1;
  }
  const madridWage = weeklyWageForClub(getClub('real-madrid')!, 0);
  const risingMadrid = weeklyWageForSquadStatus(getClub('real-madrid')!, 0, 'rising-star');
  const madridAt066 = weeklyWageForRatio(getClub('real-madrid')!, 0, 0.66, 'starter');
  const madridAt12 = weeklyWageForRatio(getClub('real-madrid')!, 0, 1.2, 'starter');
  console.log('listed RM starter/rising/0.66', madridWage, risingMadrid, madridAt066);
  if (madridWage < 600_000 || risingMadrid < 20_000 || risingMadrid > 22_000) {
    console.error('Real Madrid starter must use the listed top wage and Rising star 10% of the squad average');
    process.exitCode = 1;
  }
  if (madridAt066 !== Math.round((madridWage * 0.66) / 500) * 500 || madridAt12 !== madridWage) {
    console.error('starter offers must pay last season’s ratio of the club’s 1.0 wage, capped at the listed band');
    process.exitCode = 1;
  }
  const getafeWage = getClub('getafe') ? weeklyWageForClub(getClub('getafe')!, 0) : 0;
  if (getafeWage <= 0 || getafeWage >= 60_192) {
    console.error('unlisted La Liga clubs must sit well below the cheapest listed side');
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
  if (starAfterCollapse >= starKeptForm * 0.55) {
    console.error('a 0.08 season must cut a star’s fee substantially');
    process.exitCode = 1;
  }
  if (starAfterCollapse > starKeptForm * 0.85) {
    console.error('one collapse year must not leave market value almost unchanged');
    process.exitCode = 1;
  }
  const threeBlank = [
    { ...dummySeason, seasonNumber: 2, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
    { ...dummySeason, seasonNumber: 3, clubId: 'barcelona', goals: 40, gamesPlayed: 50 },
    { ...dummySeason, seasonNumber: 4, clubId: 'al-hilal', goals: 8, gamesPlayed: 34 },
    { ...dummySeason, seasonNumber: 5, clubId: 'fiorentina', goals: 3, gamesPlayed: 36 },
    { ...dummySeason, seasonNumber: 6, clubId: 'inter', goals: 3, gamesPlayed: 30 },
  ];
  const afterThreeBlank = playerMarketValueFromSeasons({
    age: 26,
    careerGoals: 94,
    careerGames: 200,
    seasons: threeBlank,
    fallbackClub: getClub('inter') ?? barca,
  });
  console.log('three-blank value', afterThreeBlank, 'one-collapse', starAfterCollapse);
  if (afterThreeBlank >= starAfterCollapse * 0.7) {
    console.error('three consecutive poor seasons must cut value harder than a single collapse');
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
  if (starLoanCount !== LOAN_OFFER_COUNT) {
    console.error('a failed ratio at Barcelona must still offer loans back to the parent club');
    process.exitCode = 1;
  }
  if (starPermTiers.some((tier) => tier > 3) || starPermTiers.length === 0) {
    console.error('a high remaining market value must still draw elite or high-level clubs, not League Two fees');
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
  const paidSaudi = paidIds.filter((id) => getClub(id)?.league === 'Saudi Pro League');
  const paidEurope = paidIds.filter((id) => getClub(id)?.league !== 'Saudi Pro League');
  console.log('€200m 5yr bidders', paidIds, paidPerm.map((o) => o.fee));
  if (paidEurope.length < 3) {
    console.error('a star fee must still attract several European bids, not a Saudi-only list');
    process.exitCode = 1;
  }
  if (!paidEurope.some((id) => MEGA_CLUB_IDS.has(id))) {
    console.error('PSG, Real Madrid or Manchester City must still appear for a mega asking price');
    process.exitCode = 1;
  }
  if (paidSaudi.length > 1 || (paidSaudi.length === 1 && paidSaudi.some((id) => !(TWILIGHT_SAUDI_CLUB_IDS as readonly string[]).includes(id)))) {
    console.error('at most one Saudi giant should sit alongside the European bids');
    process.exitCode = 1;
  }
  if (paidPerm.some((o) => {
    const dest = getClub(o.clubId);
    return dest != null && o.fee > clubTransferBudget(dest) + 1;
  })) {
    console.error('no club may bid above its transfer budget');
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

  const reservePromo = resolveSeasonTransition({
    season: {
      ...dummySeason,
      seasonNumber: 1,
      clubId: 'real-madrid',
      role: 'reserve',
      goals: 30,
      gamesPlayed: 38,
      leagueGoals: 30,
      ratioMet: true,
      age: 16,
    },
    role: 'reserve',
    clubId: 'real-madrid',
    parentClubId: 'real-madrid',
    seasonsAtCurrentClub: 0,
    age: 16,
    careerGoals: 0,
    careerGames: 0,
    nationality: 'spain',
    loansUsed: 0,
    contractYearsRemaining: 1,
  });
  const reservePromoLoans = (reservePromo.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
  const reservePromoPerm = (reservePromo.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent');
  console.log(
    'reserve ratio met',
    reservePromo.headline,
    'immediate',
    reservePromo.immediate?.role,
    reservePromo.immediate?.contractYearsRemaining,
    'pending',
    Boolean(reservePromo.pendingTransfer),
    'loans',
    reservePromoLoans.length,
    'transfers',
    reservePromoPerm.length,
  );
  if (reservePromo.pendingTransfer || reservePromoLoans.length !== 0 || reservePromoPerm.length !== 0) {
    console.error('hitting the reserve ratio must promote immediately with no transfer offers');
    process.exitCode = 1;
  }
  if (reservePromo.immediate?.role !== 'first-team') {
    console.error('hitting the reserve ratio must promote to the first team');
    process.exitCode = 1;
  }
  if (reservePromo.immediate?.contractYearsRemaining !== FIRST_CONTRACT_YEARS) {
    console.error('the first senior contract after a leftover academy year must be 3 years');
    process.exitCode = 1;
  }
  const reserveBar = getClub('real-madrid')!.reserveGoalRatio.toFixed(2);
  const reserveRatio = (30 / 38).toFixed(2);
  if (!reservePromo.detail.includes(`met the ${reserveBar}`) || !reservePromo.detail.includes(reserveRatio)) {
    console.error('reserve complete copy must say the player met the required ratio');
    process.exitCode = 1;
  }
  if (reservePromo.immediate?.squadStatus !== 'rising-star') {
    console.error('reserve promotion must start the player as a Rising star, not an automatic starter');
    process.exitCode = 1;
  }

  const starterHold = nextSquadStatusAfterSeason({
    role: 'first-team',
    current: 'starter',
    ratio: 0.55,
    gamesPlayed: 38,
    bar: 0.5,
  });
  const starterKeepS1 = nextSquadStatusAfterSeason({
    role: 'first-team',
    current: 'starter',
    ratio: 0.42,
    gamesPlayed: 36,
    bar: 0.5,
  });
  const starterCollapse = nextSquadStatusAfterSeason({
    role: 'first-team',
    current: 'starter',
    ratio: 0.28,
    gamesPlayed: 36,
    bar: 0.5,
  });
  const reserveUp = nextSquadStatusAfterSeason({
    role: 'first-team',
    current: 'reserve',
    ratio: 0.58,
    gamesPlayed: 24,
    bar: 0.5,
    allowRisingStar: false,
  });
  const starterDropS3 = nextSquadStatusAfterSeason({
    role: 'first-team',
    current: 'starter',
    ratio: 0.42,
    gamesPlayed: 36,
    bar: 0.5,
    allowRisingStar: false,
  });
  console.log('squad status after season', starterHold, starterKeepS1, starterCollapse, reserveUp, starterDropS3);
  if (starterHold !== 'starter' || starterKeepS1 !== 'starter' || starterCollapse !== 'reserve' || reserveUp !== 'starter' || starterDropS3 !== 'reserve') {
    console.error('end-of-season squad status must keep a Season 1 starter above 0.33 and only assign Reserve at season end');
    process.exitCode = 1;
  }
  const risingKeep = nextSquadStatusAfterSeason({
    role: 'first-team',
    current: 'rising-star',
    ratio: 0.4,
    gamesPlayed: 24,
    bar: 0.5,
  });
  const risingPromote = nextSquadStatusAfterSeason({
    role: 'first-team',
    current: 'rising-star',
    ratio: 0.55,
    gamesPlayed: 24,
    bar: 0.5,
  });
  const impactKeep = nextSquadStatusAfterSeason({
    role: 'first-team',
    current: 'impact',
    ratio: 0.4,
    gamesPlayed: 24,
    bar: 0.5,
  });
  if (risingKeep !== 'rising-star' || risingPromote !== 'starter' || impactKeep !== 'impact') {
    console.error('Season 1 must keep Rising star / Impact above 0.33 and promote to starter on the club bar');
    process.exitCode = 1;
  }
  const honourOverride = nextSquadStatusAfterSeason({
    role: 'first-team',
    current: 'rising-star',
    ratio: 0.4,
    gamesPlayed: 51,
    bar: 0.5,
    honoursClear: true,
  });
  if (honourOverride !== 'rising-star') {
    console.error('Rising star with a tournament honour stays Rising star unless they hit the club bar');
    process.exitCode = 1;
  }
  const stepUp = squadStatusOnArrival({
    fromClub: getClub('getafe'),
    toClub: getClub('real-madrid'),
    move: 'permanent',
    nextIfStay: 'starter',
  });
  const stepDown = squadStatusOnArrival({
    fromClub: getClub('real-madrid'),
    toClub: getClub('getafe'),
    move: 'permanent',
    nextIfStay: 'reserve',
  });
  if (stepUp !== 'reserve' || stepDown !== 'starter') {
    console.error('joining a higher-tier club must start as reserve; a step down is a starter');
    process.exitCode = 1;
  }

  const reserveSits: boolean[] = [];
  for (let i = 0; i < 9; i++) reserveSits.push(shouldSitLeagueFixture('reserve', i));
  const risingSits: boolean[] = [];
  for (let i = 0; i < 8; i++) risingSits.push(shouldSitLeagueFixture('rising-star', i));
  const impactSits: boolean[] = [];
  for (let i = 0; i < 8; i++) impactSits.push(shouldSitLeagueFixture('impact', i));
  console.log('reserve sit pattern', reserveSits.filter(Boolean).length, '/9', 'rising', risingSits.filter(Boolean).length, '/8', 'impact', impactSits.filter(Boolean).length, '/8');
  if (reserveSits.filter(Boolean).length !== 4 || reserveSits[0] !== false || reserveSits[1] !== true) {
    console.error('a reserve player must sit every other fixture');
    process.exitCode = 1;
  }
  if (risingSits.filter(Boolean).length !== 2 || risingSits[3] !== true || risingSits[0] !== false) {
    console.error('a Rising star must sit every fourth fixture');
    process.exitCode = 1;
  }
  if (impactSits.filter(Boolean).length !== 2 || impactSits[3] !== true || impactSits[0] !== false || impactSits[1] !== false) {
    console.error('an impact player must sit the same every-fourth pattern as Rising star');
    process.exitCode = 1;
  }
  if (shouldSitLeagueFixture('starter', 2)) {
    console.error('a starter must play every fixture');
    process.exitCode = 1;
  }
  if (chancesForSquadStatus('rising-star', 4) !== 1 || chancesForSquadStatus('impact', 4) !== IMPACT_CHANCES || chancesForSquadStatus('starter', 3) !== 3) {
    console.error('Rising star matches must be one chance, Impact two, starters the drawn looks');
    process.exitCode = 1;
  }
  if (openingSquadStatus('first-team') !== 'rising-star') {
    console.error('every first-team path must open as Rising star');
    process.exitCode = 1;
  }
  if (!/league, cups and internationals/.test(describeSquadStatus('starter')) || /league games/.test(describeSquadStatus('starter'))) {
    console.error('starter copy must say the XI is across all competitions, not only league games');
    process.exitCode = 1;
  }
  if (!/Rising star/.test(describeSquadStatus('rising-star')) || !/one chance/.test(describeSquadStatus('rising-star')) || !/3 consecutive/.test(describeSquadStatus('rising-star'))) {
    console.error('Rising star copy must mention one chance and the 3-game Impact promotion');
    process.exitCode = 1;
  }
  if (!/two chances/.test(describeSquadStatus('impact')) || !/same games as Rising star/.test(describeSquadStatus('impact'))) {
    console.error('Impact copy must match Rising star minutes with two chances');
    process.exitCode = 1;
  }
  if (isSquadRotationSitOut('reserve', 'reserve', 'league', 0, { seasonMatchCount: 0 }) !== false
    || isSquadRotationSitOut('reserve', 'reserve', 'league', 12, { seasonMatchCount: 12 }) !== false) {
    console.error('academy reserve players must play every match except injury');
    process.exitCode = 1;
  }
  if (isSquadRotationSitOut('first-team', 'rising-star', 'league', 0, { seasonMatchCount: 0 }) !== true
    || isSquadRotationSitOut('first-team', 'rising-star', 'league', 1, { seasonMatchCount: 1 }) !== false) {
    console.error('a Rising star must sit the first first-team match of the season');
    process.exitCode = 1;
  }
  if (shouldSitToughFixture('rising-star', 0) !== false || shouldSitToughFixture('rising-star', 1) !== true) {
    console.error('Rising star must sit two of three tournament or stronger-side games');
    process.exitCode = 1;
  }
  if (shouldSitToughFixture('reserve', 0) !== false || shouldSitToughFixture('reserve', 1) !== false) {
    console.error('first-team reserve must not add extra tough-game sits on top of every-other minutes');
    process.exitCode = 1;
  }
  if (shouldSitToughFixture('impact', 0) !== false || shouldSitToughFixture('impact', 1) !== true) {
    console.error('Impact must sit two of three tournament or stronger-side games, same as Rising star');
    process.exitCode = 1;
  }
  const foxesClub = getClub('leicester')!;
  if (!isToughMinutesFixture({ kind: 'league', opponentId: 'man-city', week: 1 } as never, foxesClub)) {
    console.error('a Championship side must treat Manchester City as a stronger opponent');
    process.exitCode = 1;
  }
  const recallStatus = squadStatusOnArrival({
    fromClub: getClub('mainz'),
    toClub: getClub('bayern'),
    move: 'recall',
    nextIfStay: 'starter',
    playerRatio: 0.83,
  });
  const lowerRecall = squadStatusOnArrival({
    fromClub: getClub('hamburg'),
    toClub: getClub('bayern'),
    move: 'recall',
    nextIfStay: 'starter',
    playerRatio: 0.83,
  });
  if (recallStatus !== 'starter' || lowerRecall !== 'reserve') {
    console.error('same-division recall that hits the parent bar is a starter; lower-division recall stays reserve');
    process.exitCode = 1;
  }
  if (!isLowerDivisionLoan(getClub('leicester'), getClub('man-city')) || isLowerDivisionLoan(getClub('leeds'), getClub('man-city'))) {
    console.error('Championship to Premier League is a lower-division loan; Premier League to Premier League is not');
    process.exitCode = 1;
  }

  const madridCal = hydrateSeason({
    seasonNumber: 2,
    club: getClub('real-madrid')!,
    careerGoalRatio: 0.6,
    nationId: 'spain',
  });
  let completed = 0;
  let reserveSitsAll = 0;
  let reservePlaysAll = 0;
  let uclSits = 0;
  let uclPlays = 0;
  let leagueSits = 0;
  let leaguePlays = 0;
  for (const fixture of madridCal.calendar.fixtures) {
    if (shouldSkipFixture(fixture, madridCal.sim)) continue;
    const sits = isSquadRotationSitOut('first-team', 'reserve', fixture.kind, completed, {
      continentalCup: fixture.continentalCup,
    });
    if (sits) reserveSitsAll += 1;
    else reservePlaysAll += 1;
    if (reserveSitsChampionsLeague(fixture.kind, fixture.continentalCup)) {
      if (sits) uclSits += 1;
      else uclPlays += 1;
    }
    if (fixture.kind === 'league') {
      if (sits) leagueSits += 1;
      else leaguePlays += 1;
    }
    completed += 1;
  }
  console.log('reserve sit/play', reserveSitsAll, reservePlaysAll, 'ucl sit/play', uclSits, uclPlays, 'league sit/play', leagueSits, leaguePlays);
  if (uclPlays !== 0 || uclSits < 4) {
    console.error('a reserve must sit every Champions League fixture');
    process.exitCode = 1;
  }
  if (leaguePlays < 6 || leagueSits < 6) {
    console.error('a Champions League reserve still rotates league games');
    process.exitCode = 1;
  }
  if (
    isSquadRotationSitOut('first-team', 'reserve', 'continental-group', 0, { continentalCup: 'ucl' }) !== true
    || isSquadRotationSitOut('first-team', 'reserve', 'continental-knockout', 4, { continentalCup: 'ucl' }) !== true
  ) {
    console.error('Champions League nights are always a reserve sit');
    process.exitCode = 1;
  }
  if (
    isSquadRotationSitOut('first-team', 'reserve', 'continental-group', 1, { continentalCup: 'uel' }) !== false
    || isSquadRotationSitOut('first-team', 'reserve', 'continental-knockout', 3, { continentalCup: 'uecl' }) !== false
    || isSquadRotationSitOut('first-team', 'reserve', 'league', 1, { continentalCup: undefined }) !== true
  ) {
    console.error('Europa League or lower must be played; the league is the one that sits');
    process.exitCode = 1;
  }
  if (!reserveSitsChampionsLeague('continental-group', 'ucl') || reservePrioritisesContinental('continental-group', 'ucl')) {
    console.error('UCL helpers must sit Champions League and not treat it as a lower cup');
    process.exitCode = 1;
  }
  if (!reservePrioritisesContinental('continental-group', 'uel') || !reservePrioritisesContinental('leagues-cup', 'leagues-cup')) {
    console.error('Europa League and lower continental cups must be prioritised for a reserve');
    process.exitCode = 1;
  }
  const arsenalCal = hydrateSeason({
    seasonNumber: 2,
    club: getClub('arsenal')!,
    careerGoalRatio: 0.6,
    nationId: 'england',
  });
  let europaSits = 0;
  let europaPlays = 0;
  let arsenalLeagueSits = 0;
  let arsenalCompleted = 0;
  for (const fixture of arsenalCal.calendar.fixtures) {
    if (shouldSkipFixture(fixture, arsenalCal.sim)) continue;
    const sits = isSquadRotationSitOut('first-team', 'reserve', fixture.kind, arsenalCompleted, {
      continentalCup: fixture.continentalCup,
    });
    if (reservePrioritisesContinental(fixture.kind, fixture.continentalCup)) {
      if (sits) europaSits += 1;
      else europaPlays += 1;
    }
    if (fixture.kind === 'league' && sits) arsenalLeagueSits += 1;
    arsenalCompleted += 1;
  }
  console.log('arsenal reserve europa sit/play', europaSits, europaPlays, 'league sits', arsenalLeagueSits);
  if (europaSits !== 0 || europaPlays < 4 || arsenalLeagueSits < 4) {
    console.error('a Europa League reserve must play every European night and sit league games instead');
    process.exitCode = 1;
  }
  if (!/Champions League/.test(describeSquadStatus('reserve')) || !/Europa/.test(describeSquadStatus('reserve'))) {
    console.error('reserve copy must mention sitting Champions League and prioritising Europa');
    process.exitCode = 1;
  }
  const scored = (n: number, scoredFlag: boolean) => ({ matchNumber: n, played: true, scored: scoredFlag });
  const sat = (n: number) => ({ matchNumber: n, played: false, scored: null });
  if (consecutiveScoringGames([scored(1, true), sat(2), scored(3, true), scored(4, true)]) !== IMPACT_STREAK) {
    console.error('sit-outs must not break a consecutive scoring run');
    process.exitCode = 1;
  }
  const twoUp = promoteSquadStatusDuringSeason({
    current: 'rising-star',
    matches: [scored(1, true), scored(2, true)],
    ratio: 0.25,
    gamesPlayed: 8,
    bar: 0.5,
    allowYouthRoles: true,
  });
  const threeUp = promoteSquadStatusDuringSeason({
    current: 'rising-star',
    matches: [scored(1, true), scored(2, true), scored(3, true)],
    ratio: 0.25,
    gamesPlayed: 8,
    bar: 0.5,
    allowYouthRoles: true,
    openedAs: 'rising-star',
  });
  const sixUp = promoteSquadStatusDuringSeason({
    current: 'impact',
    matches: [scored(1, true), scored(2, true), scored(3, true), scored(4, true), scored(5, true), scored(6, true)],
    ratio: 0.25,
    gamesPlayed: 8,
    bar: 0.5,
    allowYouthRoles: true,
    openedAs: 'rising-star',
  });
  const fiveHoldsImpact = promoteSquadStatusDuringSeason({
    current: 'impact',
    matches: [scored(1, true), scored(2, true), scored(3, true), scored(4, true), scored(5, true)],
    ratio: 0.25,
    gamesPlayed: 8,
    bar: 0.5,
    allowYouthRoles: true,
    openedAs: 'rising-star',
  });
  const openedImpactStarter = promoteSquadStatusDuringSeason({
    current: 'impact',
    matches: [scored(1, true), scored(2, true), scored(3, true)],
    ratio: 0.25,
    gamesPlayed: 8,
    bar: 0.5,
    allowYouthRoles: true,
    openedAs: 'impact',
  });
  const impactHolds = promoteSquadStatusDuringSeason({
    current: 'impact',
    matches: [scored(1, true), scored(2, true), scored(3, false)],
    ratio: 0.2,
    gamesPlayed: 10,
    bar: 0.5,
    allowYouthRoles: true,
    openedAs: 'impact',
  });
  const risingHoldsLow = promoteSquadStatusDuringSeason({
    current: 'rising-star',
    matches: [scored(1, false), scored(2, false), scored(3, true)],
    ratio: 0.25,
    gamesPlayed: 8,
    bar: 0.5,
    allowYouthRoles: true,
  });
  const reservePromoted = promoteSquadStatusDuringSeason({
    current: 'reserve',
    matches: [scored(1, true)],
    ratio: 0.55,
    gamesPlayed: 10,
    bar: 0.5,
    allowYouthRoles: false,
  });
  const reserveKeepsStarter = promoteSquadStatusDuringSeason({
    current: 'starter',
    matches: [scored(1, false), scored(2, false), scored(3, false)],
    ratio: 0.2,
    gamesPlayed: 12,
    bar: 0.5,
    allowYouthRoles: false,
  });
  const noMidSeasonReserve = promoteSquadStatusDuringSeason({
    current: 'rising-star',
    matches: [scored(1, false)],
    ratio: 0.1,
    gamesPlayed: 18,
    bar: 0.75,
    allowYouthRoles: true,
  });
  const s3NoImpact = promoteSquadStatusDuringSeason({
    current: 'rising-star',
    matches: [scored(1, true), scored(2, true)],
    ratio: 0.4,
    gamesPlayed: 10,
    bar: 0.5,
    allowYouthRoles: false,
  });
  if (
    twoUp !== 'rising-star'
    || threeUp !== 'impact'
    || sixUp !== 'starter'
    || fiveHoldsImpact !== 'impact'
    || openedImpactStarter !== 'starter'
    || impactHolds !== 'impact'
    || risingHoldsLow !== 'rising-star'
    || consecutiveScoringAsImpact(
      [scored(1, true), scored(2, true), scored(3, true), scored(4, true), scored(5, true)],
      'rising-star',
    ) !== 2
  ) {
    console.error('3 scoring games make Impact, then a fresh 3 make Starter; extra goals in one game still count as one');
    process.exitCode = 1;
  }
  if (reservePromoted !== 'starter' || reserveKeepsStarter !== 'starter' || noMidSeasonReserve !== 'rising-star' || s3NoImpact !== 'rising-star') {
    console.error('Reserve promotes to Starter on the bar and keeps it; no mid-season Reserve and no Season 3 Impact streak');
    process.exitCode = 1;
  }
  if (!youthRolesAllowed(1) || !youthRolesAllowed(2) || youthRolesAllowed(3) || IMPACT_STREAK !== 3 || STARTER_STREAK !== 3) {
    console.error('Impact and Rising star are Season 1–2 only; streaks are 3 then another 3');
    process.exitCode = 1;
  }
  if (ROLE_REVIEW_WEEK !== 20 || RISING_STAR_MIN_RATIO !== 0.33) {
    console.error('Season 1 call-ups stay week 20; Rising star stay bar is 0.33');
    process.exitCode = 1;
  }

  const cityBid = {
    clubId: 'man-city',
    move: 'permanent' as const,
    fee: 80_000_000,
    weeklyWage: 200_000,
    contractYears: 5,
  };
  const getafeBid = { ...cityBid, clubId: 'getafe', fee: 45_000_000 };
  const starterVeto = sellingClubAcceptsOffer({
    offer: cityBid,
    kind: 'end-of-season',
    allowDecline: true,
    currentClubId: 'real-madrid',
    role: 'first-team',
    squadStatus: 'starter',
    contractYearsLeft: 4,
    playerValue: 120_000_000,
  });
  const weakerAccept = sellingClubAcceptsOffer({
    offer: getafeBid,
    kind: 'end-of-season',
    allowDecline: true,
    currentClubId: 'real-madrid',
    role: 'first-team',
    squadStatus: 'starter',
    contractYearsLeft: 4,
    playerValue: 120_000_000,
  });
  const forcedSale = sellingClubAcceptsOffer({
    offer: cityBid,
    kind: 'sold',
    allowDecline: false,
    currentClubId: 'real-madrid',
    role: 'first-team',
    squadStatus: 'starter',
    contractYearsLeft: 4,
    playerValue: 120_000_000,
  });
  const lastYear = sellingClubAcceptsOffer({
    offer: cityBid,
    kind: 'end-of-season',
    allowDecline: true,
    currentClubId: 'real-madrid',
    role: 'first-team',
    squadStatus: 'starter',
    contractYearsLeft: 1,
    playerValue: 120_000_000,
  });
  console.log('selling club veto', starterVeto.accepted, weakerAccept.accepted, forcedSale.accepted, lastYear.accepted);
  if (starterVeto.accepted || weakerAccept.accepted || !forcedSale.accepted || !lastYear.accepted) {
    console.error('a short-fee bid must be vetoed when the player is too expensive; a forced sale or last year must go through');
    process.exitCode = 1;
  }
  if (!/rejected/i.test(starterVeto.detail) || !/Manchester City/i.test(starterVeto.detail)) {
    console.error('a rejected bid must tell the player they agreed terms and the club blocked the fee');
    process.exitCode = 1;
  }
  const listedMega = sellingClubAcceptsOffer({
    offer: {
      clubId: 'man-city',
      move: 'permanent',
      fee: 225_000_000,
      weeklyWage: 300_000,
      contractYears: 5,
    },
    kind: 'end-of-season',
    allowDecline: true,
    currentClubId: 'barcelona',
    role: 'first-team',
    squadStatus: 'starter',
    contractYearsLeft: 5,
    playerValue: 225_000_000,
  });
  const lastOffer = sellingClubAcceptsOffer({
    offer: cityBid,
    kind: 'end-of-season',
    allowDecline: true,
    currentClubId: 'real-madrid',
    role: 'first-team',
    squadStatus: 'starter',
    contractYearsLeft: 4,
    playerValue: 120_000_000,
    remainingPermanentOffers: 0,
  });
  const loanWindowBid = sellingClubAcceptsOffer({
    offer: cityBid,
    kind: 'end-of-season',
    allowDecline: true,
    currentClubId: 'leeds',
    role: 'loan',
    squadStatus: 'starter',
    contractYearsLeft: 4,
    playerValue: 120_000_000,
  });
  const loanMove = sellingClubAcceptsOffer({
    offer: { ...getafeBid, move: 'loan', fee: 0, contractYears: 1 },
    kind: 'end-of-season',
    allowDecline: true,
    currentClubId: 'real-madrid',
    role: 'first-team',
    squadStatus: 'starter',
    contractYearsLeft: 4,
    playerValue: 120_000_000,
  });
  if (lastOffer.accepted || !loanWindowBid.accepted || !loanMove.accepted) {
    console.error('a last remaining bid far below the asking fee must be vetoed; loan-spell sales and loan offers still go through');
    process.exitCode = 1;
  }
  if (!listedMega.accepted) {
    console.error('a mega club paying the listed fee / its budget must not be vetoed at 115% of market value');
    process.exitCode = 1;
  }

  useCareerStore.setState({
    phase: 'transfer-choice',
    clubId: 'real-madrid',
    parentClubId: 'real-madrid',
    role: 'first-team',
    squadStatus: 'starter',
    lastTransferRejection: null,
    age: 22,
    seasonNumber: 5,
    seasonsAtCurrentClub: 3,
    careerGoals: 150,
    careerGames: 180,
    careerStart: 'favourite-first-team',
    nationality: 'spain',
    weeklyWage: 140_000,
    contractYears: 5,
    contractYearsRemaining: 4,
    clubLeague: 'La Liga',
    seasonHistory: [
      {
        seasonNumber: 2,
        clubId: 'real-madrid',
        role: 'first-team',
        squadStatus: 'starter',
        matches: [],
        goals: 50,
        gamesPlayed: 55,
        ratioMet: true,
        age: 19,
        leagueGoals: 38,
        trophies: [],
        topGoalscorer: true,
        playerOfTheYear: true,
        wonWpy: false,
      },
      {
        seasonNumber: 3,
        clubId: 'real-madrid',
        role: 'first-team',
        squadStatus: 'starter',
        matches: [],
        goals: 48,
        gamesPlayed: 52,
        ratioMet: true,
        age: 20,
        leagueGoals: 36,
        trophies: [],
        topGoalscorer: true,
        playerOfTheYear: false,
        wonWpy: false,
      },
    ],
    currentSeason: {
      seasonNumber: 4,
      clubId: 'real-madrid',
      role: 'first-team',
      squadStatus: 'starter',
      matches: [],
      goals: 52,
      gamesPlayed: 50,
      ratioMet: true,
      age: 21,
      leagueGoals: 22,
      trophies: [],
      topGoalscorer: false,
      playerOfTheYear: false,
      wonWpy: false,
    },
    pendingTransfer: {
      kind: 'end-of-season',
      detail: 'These clubs can pay the transfer fee.',
      clubIds: ['man-city', 'getafe'],
      offers: [cityBid, getafeBid],
      allowDecline: true,
      stay: {
        clubId: 'real-madrid',
        parentClubId: 'real-madrid',
        role: 'first-team',
        seasonsAtCurrentClub: 4,
        contractYearsRemaining: 3,
        clubLeague: 'La Liga',
        squadStatus: 'starter',
      },
    },
  });
  useCareerStore.getState().resolveTransferChoice('man-city');
  const afterVeto = useCareerStore.getState();
  console.log('store veto', afterVeto.phase, afterVeto.clubId, afterVeto.pendingTransfer?.offers.map((o) => o.clubId), afterVeto.lastTransferRejection);
  if (
    afterVeto.phase !== 'transfer-choice'
    || afterVeto.clubId !== 'real-madrid'
    || afterVeto.pendingTransfer?.offers.some((o) => o.clubId === 'man-city')
    || !afterVeto.pendingTransfer?.offers.some((o) => o.clubId === 'getafe')
    || !afterVeto.lastTransferRejection
  ) {
    console.error('accepting City terms must stay in the window after Madrid reject the bid');
    process.exitCode = 1;
  }
  useCareerStore.getState().resolveTransferChoice('getafe');
  const afterGetafe = useCareerStore.getState();
  console.log('store getafe veto', afterGetafe.phase, afterGetafe.clubId, afterGetafe.lastTransferRejection);
  if (
    afterGetafe.phase !== 'transfer-choice'
    || afterGetafe.clubId !== 'real-madrid'
    || afterGetafe.pendingTransfer?.offers.some((o) => o.clubId === 'getafe')
  ) {
    console.error('a short Getafe bid must also be vetoed when the player is too expensive');
    process.exitCode = 1;
  }
  useCareerStore.getState().resolveTransferChoice(null);
  const afterStay = useCareerStore.getState();
  console.log('store stay expensive', afterStay.phase, afterStay.clubId);
  if (afterStay.phase !== 'hub' || afterStay.clubId !== 'real-madrid') {
    console.error('after cheap bids are vetoed the player must be able to stay');
    process.exitCode = 1;
  }

  const reserveMiss = resolveSeasonTransition({
    season: {
      ...dummySeason,
      seasonNumber: 1,
      clubId: 'real-madrid',
      role: 'reserve',
      goals: 2,
      gamesPlayed: 38,
      leagueGoals: 2,
      age: 16,
    },
    role: 'reserve',
    clubId: 'real-madrid',
    parentClubId: 'real-madrid',
    seasonsAtCurrentClub: 0,
    age: 16,
    careerGoals: 0,
    careerGames: 0,
    nationality: 'spain',
    loansUsed: 0,
    contractYearsRemaining: 2,
  });
  const missLoans = reserveMiss.pendingTransfer?.offers ?? [];
  const missHome = missLoans.filter((o) => getClub(o.clubId)?.country === 'Spain').length;
  console.log('reserve miss', reserveMiss.headline, 'loans', missLoans.length, 'home', missHome, missLoans.map((o) => o.clubId));
  if (reserveMiss.pendingTransfer?.kind !== 'loan' || missLoans.length !== LOAN_OFFER_COUNT || missLoans.some((o) => o.move !== 'loan')) {
    console.error('missing the reserve ratio must offer three loans and no stay');
    process.exitCode = 1;
  }
  if (missHome < 2) {
    console.error('reserve-miss loans should include two clubs from the player’s nationality when possible');
    process.exitCode = 1;
  }
  {
    const reserveMissValue = playerMarketValueFromSeasons({
      age: 16,
      careerGoals: 0,
      careerGames: 0,
      seasons: [{
        ...dummySeason,
        seasonNumber: 1,
        clubId: 'real-madrid',
        role: 'reserve',
        goals: 2,
        gamesPlayed: 38,
      }],
      fallbackClub: getClub('real-madrid')!,
      contractYearsRemaining: 2,
      seasonNumber: 1,
      calendarWeek: 99,
      role: 'reserve',
    });
    if (missLoans.some((o) => {
      const dest = getClub(o.clubId);
      return !dest || o.contractYears !== 1 || o.weeklyWage !== weeklyWageForRatio(dest, reserveMissValue, 2 / 38, 'starter', dest.league);
    })) {
      console.error('reserve-miss loans must pay each destination’s starter wage, not a flat reserve salary');
      process.exitCode = 1;
    }
  }
  {
    const missLeagues = missLoans.map((o) => getClub(o.clubId)?.league ?? '');
    if (missLeagues.some((league) => !SECOND_DIVISIONS.has(league))) {
      console.error('reserve-miss loans must go to a second division unless the ratio already matches a same-division bar');
      process.exitCode = 1;
    }
    if (missLoans.some((o) => getClub(o.clubId)?.league === 'La Liga')) {
      console.error('a 0.05 reserve ratio must not loan into La Liga');
      process.exitCode = 1;
    }
  }
  if (/career/i.test(`${reserveMiss.detail} ${reserveMiss.pendingTransfer?.detail ?? ''}`) && /2 loans|two loans/i.test(`${reserveMiss.detail} ${reserveMiss.pendingTransfer?.detail ?? ''}`)) {
    console.error('do not tell the player that only two loans are allowed per career');
    process.exitCode = 1;
  }

  const renewalDeal = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'bayern', goals: 30, gamesPlayed: 38 },
    role: 'first-team',
    clubId: 'bayern',
    parentClubId: 'bayern',
    seasonsAtCurrentClub: 1,
    age: 17,
    careerGoals: 30,
    careerGames: 38,
    nationality: 'germany',
    loansUsed: 0,
    contractYearsRemaining: 2,
    weeklyWage: 42_000,
  });
  const ownRenewal = (renewalDeal.pendingTransfer?.offers ?? []).find((o) => o.clubId === 'bayern' && o.move === 'permanent');
  console.log('renewal at 2 years left', ownRenewal, renewalDeal.headline);
  if (!ownRenewal || ownRenewal.contractYears !== 5 || ownRenewal.weeklyWage <= 0 || !ownRenewal.renewal) {
    console.error('when two years remain the current club must offer a new 5-year deal (age 17)');
    process.exitCode = 1;
  }
  if (renewalDeal.pendingTransfer?.stay?.contractYearsRemaining !== 1) {
    console.error('staying without renewing must tick a 2-year deal down to 1 year left');
    process.exitCode = 1;
  }
  if (renewalDeal.pendingTransfer?.stay?.weeklyWage !== 42_000) {
    console.error('keep-the-current-deal must show the original salary, not the renewal wage');
    process.exitCode = 1;
  }
  if ((ownRenewal?.weeklyWage ?? 0) <= 42_000) {
    console.error('the renewal offer must pay more than the current deal');
    process.exitCode = 1;
  }
  const lateRenewal = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'bayern', goals: 30, gamesPlayed: 38 },
    role: 'first-team',
    clubId: 'bayern',
    parentClubId: 'bayern',
    seasonsAtCurrentClub: 2,
    age: 18,
    careerGoals: 60,
    careerGames: 76,
    nationality: 'germany',
    loansUsed: 0,
    contractYearsRemaining: 1,
  });
  const lateOwn = (lateRenewal.pendingTransfer?.offers ?? []).find((o) => o.clubId === 'bayern' && o.renewal);
  console.log('renewal at 1 year left', lateOwn?.contractYears, 'stay', lateRenewal.pendingTransfer?.stay?.contractYearsRemaining);
  if (!lateOwn || lateOwn.contractYears !== 5) {
    console.error('when one year remains the current club must still offer a new contract');
    process.exitCode = 1;
  }
  if (lateRenewal.pendingTransfer?.stay?.contractYearsRemaining !== 0) {
    console.error('declining a last-year renewal must leave 0 years on the existing deal');
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
  if (missedLoans.length !== LOAN_OFFER_COUNT) {
    console.error('the first season at a club must still offer loans when the ratio is missed');
    process.exitCode = 1;
  }

  const favFirstMiss = resolveSeasonTransition({
    season: { ...dummySeason, seasonNumber: 1, clubId: 'real-madrid', goals: 8, gamesPlayed: 38 },
    role: 'first-team',
    clubId: 'real-madrid',
    parentClubId: 'real-madrid',
    seasonsAtCurrentClub: 0,
    age: 17,
    careerGoals: 8,
    careerGames: 38,
    nationality: 'spain',
    loansUsed: 0,
    contractYearsRemaining: 2,
    careerStart: 'favourite-first-team',
    squadStatus: 'rising-star',
  });
  const favFirstMissOffers = favFirstMiss.pendingTransfer?.offers ?? [];
  const favFirstMissLoans = favFirstMissOffers.filter((o) => o.move === 'loan');
  const favFirstMissPerms = favFirstMissOffers.filter((o) => o.move === 'permanent' && !o.renewal);
  console.log(
    'favourite first-team miss',
    favFirstMiss.pendingTransfer?.kind,
    'stay',
    Boolean(favFirstMiss.pendingTransfer?.stay),
    'decline',
    favFirstMiss.pendingTransfer?.allowDecline,
    'loans',
    favFirstMissLoans.length,
    'transfers',
    favFirstMissPerms.length,
  );
  const favFirstRenewal = favFirstMissOffers.find((o) => o.renewal && o.clubId === 'real-madrid');
  if (
    favFirstMiss.pendingTransfer?.kind !== 'loan-or-transfer'
    || !favFirstMiss.pendingTransfer.allowDecline
    || favFirstMiss.pendingTransfer.stay?.squadStatus !== 'reserve'
    || favFirstMissLoans.length === 0
    || favFirstMissPerms.length === 0
  ) {
    console.error('Season 1 below 0.33 must offer a Reserve stay plus loans and transfers');
    process.exitCode = 1;
  }
  if (
    favFirstRenewal
    || favFirstMissPerms.some((o) => o.weeklyWage <= 0)
    || favFirstMissLoans.some((o) => o.weeklyWage <= 0)
  ) {
    console.error('Season 1 that misses the club ratio must not table a current-club renewal; other salary offers stay');
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
    ratio: 0.12,
    careerRatio: 0.12,
    marketValue: 900_000,
    currentTier: 1,
  });
  console.log('€900k offer tier', cheapTier, 'value band', tierForMarketValue(900_000));
  if (cheapTier <= 2) {
    console.error('a €900k player must not attract Strong or Elite transfer offers');
    process.exitCode = 1;
  }
  const hotButCheap = offerTierFromStanding({
    ratio: 1.2,
    careerRatio: 1.2,
    marketValue: 20_000_000,
  });
  console.log('€20m / 1.2 offer tier', hotButCheap, 'elite floor', ELITE_TRANSFER_VALUE_FLOOR);
  if (hotButCheap < 2) {
    console.error('elite clubs must not bid below €50m market value on a paid transfer');
    process.exitCode = 1;
  }
  const freeHotCheap = offerTierFromStanding({
    ratio: 1.2,
    careerRatio: 1.2,
    marketValue: 20_000_000,
    fee: 0,
  });
  if (freeHotCheap > 1) {
    console.error('a free agent with an elite ratio should still attract elite clubs');
    process.exitCode = 1;
  }
  const midRatioHighValue = offerTierFromStanding({
    ratio: 0.53,
    careerRatio: 0.53,
    marketValue: 88_000_000,
    fee: 40_000_000,
  });
  console.log('0.53 ratio / €88m offer tier', midRatioHighValue);
  if (midRatioHighValue <= 2) {
    console.error('a 0.53 season must not draw Strong or Elite clubs even with a high market value');
    process.exitCode = 1;
  }
  const freeEliteForm = offerTierFromStanding({
    ratio: 0.72,
    careerRatio: 0.65,
    marketValue: 144_000_000,
    fee: 0,
  });
  if (freeEliteForm > 1) {
    console.error('a 0.72 last season on a free transfer should attract Elite clubs');
    process.exitCode = 1;
  }
  const city = getClub('man-city');
  if (city) {
    const s1Value = playerMarketValueFromSeasons({
      age: 17,
      careerGoals: 10,
      careerGames: 19,
      seasons: [{ ...dummySeason, seasonNumber: 1, clubId: 'man-city', league: 'Premier League', role: 'first-team', goals: 10, gamesPlayed: 19 }],
      fallbackClub: city,
      seasonNumber: 1,
      calendarWeek: 99,
    });
    const s2Value = playerMarketValueFromSeasons({
      age: 18,
      careerGoals: 33,
      careerGames: 51,
      seasons: [
        { ...dummySeason, seasonNumber: 1, clubId: 'man-city', league: 'Premier League', role: 'first-team', goals: 10, gamesPlayed: 19 },
        { ...dummySeason, seasonNumber: 2, clubId: 'man-city', league: 'Premier League', role: 'first-team', goals: 23, gamesPlayed: 32 },
      ],
      fallbackClub: city,
      seasonNumber: 2,
      calendarWeek: 99,
    });
    console.log('City 10/19 value', s1Value, '33/51 value', s2Value);
    if (s1Value > 40_000_000) {
      console.error('19 games and 10 goals in season 1 must not be worth ~€88m');
      process.exitCode = 1;
    }
    if (s2Value > 110_000_000) {
      console.error('51 games and 33 goals at 18 must not already sit at €144m');
      process.exitCode = 1;
    }
    const s1Offers = resolveSeasonTransition({
      season: { ...dummySeason, seasonNumber: 1, clubId: 'man-city', league: 'Premier League', role: 'first-team', goals: 10, gamesPlayed: 19 },
      role: 'first-team',
      clubId: 'man-city',
      parentClubId: 'man-city',
      seasonsAtCurrentClub: 0,
      age: 17,
      careerGoals: 10,
      careerGames: 19,
      nationality: 'england',
      loansUsed: 0,
      contractYearsRemaining: 2,
      careerStart: 'favourite-first-team',
      squadStatus: 'rising-star',
    });
    const s1PermTiers = (s1Offers.pendingTransfer?.offers ?? [])
      .filter((o) => o.move === 'permanent' && !o.renewal && o.clubId !== 'man-city')
      .map((o) => getClub(o.clubId)?.tier ?? 5);
    console.log('season 1 0.53 perm tiers', s1PermTiers);
    if (s1PermTiers.some((tier) => tier <= 2)) {
      console.error('a 0.53 season 1 must not produce Strong or Elite transfer offers');
      process.exitCode = 1;
    }
    const s2OutOfContract = resolveSeasonTransition({
      season: { ...dummySeason, seasonNumber: 2, clubId: 'man-city', league: 'Premier League', role: 'first-team', goals: 23, gamesPlayed: 32 },
      role: 'first-team',
      clubId: 'man-city',
      parentClubId: 'man-city',
      seasonsAtCurrentClub: 1,
      age: 18,
      careerGoals: 33,
      careerGames: 51,
      nationality: 'england',
      loansUsed: 0,
      seasonHistory: [{ ...dummySeason, seasonNumber: 1, clubId: 'man-city', league: 'Premier League', role: 'first-team', goals: 10, gamesPlayed: 19 }],
      contractYearsRemaining: 0,
      careerStart: 'favourite-first-team',
      squadStatus: 'rising-star',
    });
    const s2FreeTiers = (s2OutOfContract.pendingTransfer?.offers ?? [])
      .filter((o) => o.move === 'permanent')
      .map((o) => getClub(o.clubId)?.tier ?? 5);
    console.log('season 2 0.72 free perm tiers', s2FreeTiers);
    if (!s2FreeTiers.some((tier) => tier === 1)) {
      console.error('a 0.72 season on a free transfer should include Elite clubs');
      process.exitCode = 1;
    }
  }
  const strongArrival = squadStatusOnArrival({
    fromClub: getClub('man-city'),
    toClub: getClub('arsenal'),
    move: 'permanent',
    nextIfStay: 'rising-star',
    playerRatio: 0.53,
  });
  if (strongArrival !== 'rising-star') {
    console.error('a 0.53 ratio must not arrive as a starter at a Strong club');
    process.exitCode = 1;
  }
  const richEnough = offerTierFromStanding({
    ratio: 1.2,
    careerRatio: 1.2,
    marketValue: 55_000_000,
  });
  if (richEnough > 1) {
    console.error('a €55m player with a 1.2 ratio should still attract elite clubs');
    process.exitCode = 1;
  }
  if (lafc && hilal && barca) {
    const mlsHot = playerMarketValueFromSeasons({
      age: 18,
      careerGoals: 36,
      careerGames: 30,
      seasons: [{ ...dummySeason, seasonNumber: 2, clubId: 'lafc', league: 'MLS', goals: 36, gamesPlayed: 30, role: 'first-team' }],
      fallbackClub: lafc,
    });
    const saudiHot = playerMarketValueFromSeasons({
      age: 18,
      careerGoals: 34,
      careerGames: 33,
      seasons: [{ ...dummySeason, seasonNumber: 2, clubId: 'al-hilal', league: 'Saudi Pro League', goals: 34, gamesPlayed: 33, role: 'first-team' }],
      fallbackClub: hilal,
    });
    const ligaHot = playerMarketValueFromSeasons({
      age: 18,
      careerGoals: 34,
      careerGames: 33,
      seasons: [{ ...dummySeason, seasonNumber: 2, clubId: 'real-madrid', league: 'La Liga', goals: 34, gamesPlayed: 33, role: 'first-team' }],
      fallbackClub: barca,
    });
    console.log('value MLS 1.2', mlsHot, 'Saudi 1.02', saudiHot, 'La Liga 1.02', ligaHot);
    if (saudiHot >= 32_000_000) {
      console.error('a first Saudi season at 1.02 must not reach European-star money');
      process.exitCode = 1;
    }
    if (saudiHot >= ligaHot * 0.35) {
      console.error('Saudi market value must sit well below the same ratio in a top European league');
      process.exitCode = 1;
    }
    const mlsOffers = resolveSeasonTransition({
      season: { ...dummySeason, seasonNumber: 2, clubId: 'lafc', league: 'MLS', goals: 36, gamesPlayed: 30, role: 'first-team' },
      role: 'first-team',
      clubId: 'lafc',
      parentClubId: 'lafc',
      seasonsAtCurrentClub: 1,
      age: 18,
      careerGoals: 36,
      careerGames: 30,
      nationality: 'spain',
      loansUsed: 0,
      seasonHistory: [],
      contractYearsRemaining: 2,
      careerStart: 'favourite-first-team',
    });
    const eliteBids = (mlsOffers.pendingTransfer?.offers ?? []).filter((o) => getClub(o.clubId)?.tier === 1);
    console.log('MLS 1.2 transfer elite bids', eliteBids.length, 'value', mlsHot);
    if (mlsHot < ELITE_TRANSFER_VALUE_FLOOR && eliteBids.length > 0) {
      console.error('a sub-€50m MLS season must not produce elite transfer offers');
      process.exitCode = 1;
    }
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
  const cheapEuropeTiers = (cheapSale.pendingTransfer?.offers ?? [])
    .filter((o) => o.move === 'permanent' && getClub(o.clubId)?.league !== 'Saudi Pro League')
    .map((o) => getClub(o.clubId)?.tier ?? 1);
  console.log('collapsed-value perm tiers', cheapPermTiers, 'europe', cheapEuropeTiers, 'value', afterSeven);
  if (afterSeven <= 12_000_000 && cheapEuropeTiers.some((tier) => tier <= 2)) {
    console.error('collapsed-value players must not get Strong or Elite European transfer offers');
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
console.log('high loan ratio', loanBack.headline, loanBack.pendingTransfer?.stay?.squadStatus, loanBack.immediate?.role);
if ((loanBack.pendingTransfer?.stay?.role ?? loanBack.immediate?.role) !== 'first-team') {
  console.error('meeting the parent first-team bar must return to the first team');
  process.exitCode = 1;
}
if ((loanBack.pendingTransfer?.stay?.squadStatus ?? loanBack.immediate?.squadStatus) !== 'starter') {
  console.error('a successful same-division loan return that hits the parent bar must be a starter');
  process.exitCode = 1;
}
if (!/as a starter/.test(loanBack.headline)) {
  console.error('same-division recall copy must say starter, not reserve');
  process.exitCode = 1;
}
if (!loanBack.pendingTransfer || loanBack.pendingTransfer.offers.filter((o) => o.move === 'permanent').length < TRANSFER_OFFER_COUNT) {
  console.error('a successful loan return still offers parallel transfers');
  process.exitCode = 1;
}
if ((loanBack.pendingTransfer?.offers ?? []).some((o) => o.move === 'loan')) {
  console.error('a successful recall must not table further loan offers');
  process.exitCode = 1;
}
if (loanBack.pendingTransfer?.stay?.clubId !== 'bayern' || loanBack.pendingTransfer?.stay?.clubLeague !== 'Bundesliga') {
  console.error('Stay after a recall must name the parent club and their league, not the loan side');
  process.exitCode = 1;
}
if (loanBack.pendingTransfer?.stay?.contractYearsRemaining !== 5) {
  console.error('the first successful recall must offer a new 5-year deal');
  process.exitCode = 1;
}
const citySameDivision = resolveSeasonTransition({
  season: { ...loanSeason, clubId: 'leeds', goals: 70, gamesPlayed: 68 },
  role: 'loan',
  clubId: 'leeds',
  parentClubId: 'man-city',
  seasonsAtCurrentClub: 0,
  age: 18,
  careerGoals: 70,
  careerGames: 68,
  nationality: 'england',
  loansUsed: 1,
  weeklyWage: 42_000,
  homeContractYearsRemaining: 1,
});
if ((citySameDivision.pendingTransfer?.stay?.squadStatus ?? citySameDivision.immediate?.squadStatus) !== 'starter') {
  console.error('a Premier League loan at 1.02 must return to City as a starter, not a reserve');
  process.exitCode = 1;
}
if (citySameDivision.pendingTransfer?.offers?.some((o) => {
  if (o.move !== 'permanent') return false;
  const expected = o.squadStatus === 'reserve' ? RESERVE_CONTRACT_YEARS : newContractYears(18);
  return o.contractYears !== expected;
})) {
  console.error('free or parallel transfer offers after a loan must be 5-year starter deals or 3-year reserve deals');
  process.exitCode = 1;
}
const lowerLoanBack = resolveSeasonTransition({
  season: { ...loanSeason, clubId: 'hamburg', goals: 20, gamesPlayed: 24 },
  role: 'loan',
  clubId: 'hamburg',
  parentClubId: 'bayern',
  seasonsAtCurrentClub: 0,
  age: 18,
  careerGoals: 20,
  careerGames: 24,
  nationality: 'germany',
  loansUsed: 1,
});
if ((lowerLoanBack.pendingTransfer?.stay?.squadStatus ?? lowerLoanBack.immediate?.squadStatus) !== 'reserve') {
  console.error('a lower-division loan return must still be a reserve role at the parent club');
  process.exitCode = 1;
}
{
  const recallClub = getClub('bayern')!;
  const recallValue = playerMarketValueFromSeasons({
    age: 18,
    careerGoals: 20,
    careerGames: 24,
    seasons: [{ ...loanSeason, clubId: 'hamburg', goals: 20, gamesPlayed: 24 }],
    fallbackClub: recallClub,
    contractYearsRemaining: DEFAULT_CONTRACT_YEARS,
    seasonNumber: loanSeason.seasonNumber,
    calendarWeek: 99,
    role: 'loan',
  });
  if ((lowerLoanBack.pendingTransfer?.stay?.weeklyWage ?? 0) !== weeklyWageForSquadStatus(recallClub, recallValue, 'reserve', recallClub.league)) {
    console.error('a reserve recall must pay 20% of the parent club’s starter wage');
    process.exitCode = 1;
  }
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
if (loanMiss.immediate?.role === 'reserve' || loanOffers !== LOAN_OFFER_COUNT || transferOffers !== TRANSFER_OFFER_COUNT) {
  console.error('a missed loan return must offer 3 loans and 6 transfers, never reserves');
  process.exitCode = 1;
}
{
  const paid = 36_000;
  const wageLoan = resolveSeasonTransition({
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
    weeklyWage: paid,
  });
  const nextLoans = (wageLoan.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
  const perms = (wageLoan.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent');
  const missValue = playerMarketValueFromSeasons({
    age: 18,
    careerGoals: 10,
    careerGames: 24,
    seasons: [loanSeason],
    fallbackClub: getClub('bayern')!,
    contractYearsRemaining: DEFAULT_CONTRACT_YEARS,
    seasonNumber: loanSeason.seasonNumber,
    calendarWeek: 99,
    role: 'loan',
  });
  if (nextLoans.length === 0 || nextLoans.every((o) => o.weeklyWage === paid)) {
    console.error('loan offers must vary by destination club instead of copying the current salary');
    process.exitCode = 1;
  }
  if (nextLoans.some((o) => {
    const dest = getClub(o.clubId);
    return !dest || o.weeklyWage !== weeklyWageForRatio(dest, missValue, 10 / 24, 'starter', dest.league);
  })) {
    console.error('loan offers must pay the destination starter wage');
    process.exitCode = 1;
  }
  if (!perms.some((o) => {
    const dest = getClub(o.clubId);
    return o.squadStatus === 'reserve' && dest != null && o.weeklyWage === weeklyWageForSquadStatus(dest, missValue, 'reserve');
  })) {
    console.error('permanent offers must include a reserve role at 20% of that club’s starter wage');
    process.exitCode = 1;
  }
  if (perms.some((o) => {
    const expected = o.squadStatus === 'reserve' ? RESERVE_CONTRACT_YEARS : newContractYears(18);
    return o.contractYears !== expected;
  })) {
    console.error('permanent offers at 18 must be 5-year starter deals or 3-year reserve deals');
    process.exitCode = 1;
  }
  const s2RisingEnd = nextSquadStatusAfterSeason({
    role: 'first-team',
    current: 'rising-star',
    ratio: 0.4,
    gamesPlayed: 24,
    bar: 0.5,
    allowRisingStar: false,
  });
  if (s2RisingEnd !== 'reserve') {
    console.error('after Season 2 a Rising star who misses the starter bar must become a reserve');
    process.exitCode = 1;
  }
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
if (capLoans !== 0 || (loanCap.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent').length < TRANSFER_OFFER_COUNT) {
  console.error('after two consecutive loans at a club the player must transfer');
  process.exitCode = 1;
}
{
  const afterOneLoan = resolveSeasonTransition({
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
    contractYearsRemaining: 1,
    homeContractYearsRemaining: 2,
  });
  const secondLoans = (afterOneLoan.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
  console.log('after one loan with parent years left', afterOneLoan.headline, 'loans', secondLoans.length);
  if (/two consecutive loans/i.test(afterOneLoan.headline) || secondLoans.length !== LOAN_OFFER_COUNT) {
    console.error('one loan on a 3-year Rising-star deal must still offer a second loan into Season 3');
    process.exitCode = 1;
  }
}
{
  const history = [
    { ...loanSeason, role: 'loan' as const },
    { ...loanSeason, role: 'loan' as const },
    { ...dummySeason, role: 'first-team' as const, clubId: 'dortmund' },
  ];
  if (consecutiveLoanSpells(history) !== 0) {
    console.error('a transfer must reset the consecutive-loan count so the player can loan twice at the new club');
    process.exitCode = 1;
  }
  if (consecutiveLoanSpells(history.slice(0, 2)) !== 2) {
    console.error('two trailing loan seasons must count as two consecutive loans');
    process.exitCode = 1;
  }
}

{
  const zeroRatio = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'toulouse', goals: 0, gamesPlayed: 24, leagueGoals: 0 },
    role: 'first-team',
    clubId: 'toulouse',
    parentClubId: 'toulouse',
    seasonsAtCurrentClub: 1,
    age: 18,
    careerGoals: 0,
    careerGames: 24,
    nationality: 'england',
    loansUsed: 0,
    contractYearsRemaining: 5,
  });
  const zeroOffers = zeroRatio.pendingTransfer?.offers ?? [];
  console.log('0.0-ratio offers', zeroOffers.map((o) => `${o.move}:${o.clubId}:${getClub(o.clubId)?.tier}:${getClub(o.clubId)?.league}`));
  const zeroLoans = zeroOffers.filter((o) => o.move === 'loan');
  const zeroPerms = zeroOffers.filter((o) => o.move === 'permanent');
  if (zeroOffers.some((o) => o.clubId === 'west-ham') || zeroPerms.some((o) => (getClub(o.clubId)?.tier ?? 1) < 5)) {
    console.error('a 0.0 ratio must never attract West Ham or any permanent club above the lower-level band');
    process.exitCode = 1;
  }
  if (zeroLoans.some((o) => {
    const dest = getClub(o.clubId);
    return dest?.league === 'Ligue 1' || (dest != null && !SECOND_DIVISIONS.has(dest.league));
  })) {
    console.error('a 0.0 Toulouse miss must loan to a second division, not Ligue 1');
    process.exitCode = 1;
  }
  if (zeroOffers.filter((o) => o.move === 'loan').length !== LOAN_OFFER_COUNT) {
    console.error('a 0.0 ratio must still produce three loan offers at the lower-level band');
    process.exitCode = 1;
  }

  const splitLoans = pickLoanClubsForMiss(0, 'england', LOAN_OFFER_COUNT, ['toulouse'], 'toulouse');
  const splitFrance = splitLoans.filter((c) => c.country === 'France').length;
  const splitEngland = splitLoans.filter((c) => c.country === 'England').length;
  console.log('loan split FR/EN', splitFrance, splitEngland, splitLoans.map((c) => `${c.id}:${c.country}:${c.league}`));
  if (splitLoans.length !== LOAN_OFFER_COUNT || splitLoans.some((c) => !SECOND_DIVISIONS.has(c.league) || c.league === 'Ligue 1')) {
    console.error('a 0.0 Toulouse miss must loan to second divisions, not the same top flight');
    process.exitCode = 1;
  }
  const mediumLoans = pickLoanClubsForMiss(0.45, 'england', LOAN_OFFER_COUNT, ['liverpool'], 'liverpool');
  const mediumSameDiv = mediumLoans.filter((c) => c.league === 'Premier League');
  console.log('liverpool 0.45 loans', mediumLoans.map((c) => `${c.id}:${c.league}`));
  if (mediumLoans.length !== LOAN_OFFER_COUNT || mediumSameDiv.length < 1) {
    console.error('a 0.45 Liverpool ratio must include Premier League loans that already match the bar');
    process.exitCode = 1;
  }
  if (mediumLoans.some((c) => SECOND_DIVISIONS.has(c.league))) {
    console.error('same-division matches must be used before Championship loans');
    process.exitCode = 1;
  }
  if (mediumSameDiv.some((c) => c.firstTeamGoalRatio > 0.45)) {
    console.error('same-division loans are only allowed when the player already matches that club’s first-team bar');
    process.exitCode = 1;
  }
  if (splitEngland < 2 || splitLoans.length !== LOAN_OFFER_COUNT) {
    console.error('two of three loans should come from the player’s nation when that league exists');
    process.exitCode = 1;
  }

  const brazilLoans = pickLoanClubsForMiss(0, 'brazil', LOAN_OFFER_COUNT, ['toulouse'], 'toulouse');
  const brazilGeo = brazilLoans.filter((c) => c.country === 'Spain' || c.country === 'Portugal').length;
  console.log('loan split Brazil at Toulouse', brazilGeo, brazilLoans.map((c) => c.country));
  if (brazilLoans.length !== LOAN_OFFER_COUNT || brazilGeo < 2) {
    console.error('when nationality has no league, two of three loans must use trial geography (Brazil → Spain/Portugal)');
    process.exitCode = 1;
  }
  const irelandLoans = pickLoanClubsForMiss(0, 'republic-of-ireland', LOAN_OFFER_COUNT, ['toulouse'], 'toulouse');
  const irelandEngland = irelandLoans.filter((c) => c.country === 'England').length;
  console.log('loan split Ireland at Toulouse', irelandEngland, irelandLoans.map((c) => c.country));
  if (irelandLoans.length !== LOAN_OFFER_COUNT || irelandEngland < 2) {
    console.error('Ireland has no playable league — two of three loans must come from England');
    process.exitCode = 1;
  }

  const cityLoans = pickLoanClubsForMiss(0.69, 'england', LOAN_OFFER_COUNT, ['man-city'], 'man-city');
  console.log('city 0.69 loans', cityLoans.map((c) => `${c.id}:${c.league}`));
  if (cityLoans.length !== LOAN_OFFER_COUNT || cityLoans.some((c) => c.league !== 'Premier League')) {
    console.error('a 0.69 City ratio must draw Premier League loans, not the Championship');
    process.exitCode = 1;
  }
  const starLoans = pickLoanClubsForMiss(
    0.69,
    'england',
    LOAN_OFFER_COUNT,
    ['man-city'],
    'man-city',
    { marketValue: 100_000_000 },
  );
  if (starLoans.some((c) => SECOND_DIVISIONS.has(c.league))) {
    console.error('a €100m player must not be offered a Championship loan');
    process.exitCode = 1;
  }
  const honourLoans = pickLoanClubsForMiss(
    0.4,
    'england',
    LOAN_OFFER_COUNT,
    ['man-city'],
    'man-city',
    { honoursOverride: true },
  );
  if (honourLoans.some((c) => c.league !== 'Premier League')) {
    console.error('player of the tournament must unlock same-division loans even below the elite bar');
    process.exitCode = 1;
  }

  {
    const barca = getClub('barcelona')!;
    const arsenal = getClub('arsenal')!;
    const palace = getClub('crystal-palace')!;
    const leicester = getClub('leicester')!;
    const barcaLoans = pickLoanClubsFromOrigin(barca, LOAN_OFFER_COUNT, [barca.id], 'spain');
    const arsenalLoans = pickLoanClubsFromOrigin(arsenal, LOAN_OFFER_COUNT, [arsenal.id], 'england');
    const palaceLoans = pickLoanClubsFromOrigin(palace, LOAN_OFFER_COUNT, [palace.id], 'england');
    const leicesterLoans = pickLoanClubsFromOrigin(leicester, LOAN_OFFER_COUNT, [leicester.id], 'england');
    console.log('origin loans Barca', barcaLoans.map((c) => `${c.id}:${c.league}:${c.tier}`));
    console.log('origin loans Arsenal', arsenalLoans.map((c) => `${c.id}:${c.league}:${c.tier}`));
    console.log('origin loans Palace', palaceLoans.map((c) => `${c.id}:${c.league}:${c.tier}`));
    console.log('origin loans Leicester', leicesterLoans.map((c) => `${c.id}:${c.league}:${c.country}`));
    if (
      barcaLoans.length !== LOAN_OFFER_COUNT
      || barcaLoans.some((c) => c.league !== 'La Liga' || c.tier < 3 || c.id === 'barcelona')
    ) {
      console.error('a 0.33+ Barcelona rising star must loan to lower-scale La Liga clubs, not Segunda');
      process.exitCode = 1;
    }
    if (
      arsenalLoans.length !== LOAN_OFFER_COUNT
      || arsenalLoans.some((c) => c.league !== 'Premier League' || c.tier < 3 || c.id === 'arsenal')
    ) {
      console.error('a 0.33+ Arsenal rising star must loan to lower-scale Premier League clubs, not the Championship');
      process.exitCode = 1;
    }
    if (
      palaceLoans.length !== LOAN_OFFER_COUNT
      || palaceLoans.some((c) => c.league !== 'Championship')
    ) {
      console.error('a 0.33+ Palace rising star must loan to Championship clubs');
      process.exitCode = 1;
    }
    if (
      leicesterLoans.length !== LOAN_OFFER_COUNT
      || leicesterLoans.some((c) => {
        const weight = leagueValueWeight(c.league);
        return TOP_LEAGUES.has(c.league) || SECOND_DIVISIONS.has(c.league) || weight + 1e-9 < leagueValueWeight('MLS');
      })
    ) {
      console.error('a 0.33+ Championship rising star must loan to a lower-league country with MLS as the floor');
      process.exitCode = 1;
    }

    const risingS1 = resolveSeasonTransition({
      season: { ...dummySeason, seasonNumber: 1, clubId: 'arsenal', goals: 10, gamesPlayed: 28, league: 'Premier League' },
      role: 'first-team',
      clubId: 'arsenal',
      parentClubId: 'arsenal',
      seasonsAtCurrentClub: 0,
      age: 18,
      careerGoals: 10,
      careerGames: 28,
      nationality: 'england',
      loansUsed: 0,
      contractYearsRemaining: 5,
      careerStart: 'favourite-first-team',
      squadStatus: 'rising-star',
      clubLeague: 'Premier League',
    });
    const risingS1Loans = (risingS1.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
    const risingS1Perms = (risingS1.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent' && !o.renewal);
    const risingValue = playerMarketValueFromSeasons({
      age: 18,
      careerGoals: 10,
      careerGames: 28,
      seasons: [{ ...dummySeason, seasonNumber: 1, clubId: 'arsenal', goals: 10, gamesPlayed: 28, league: 'Premier League' }],
      fallbackClub: arsenal,
      contractYearsRemaining: 5,
      seasonNumber: 1,
      calendarWeek: 99,
      careerStart: 'favourite-first-team',
      role: 'first-team',
    });
    console.log(
      'Arsenal 0.35 S1',
      risingS1.headline,
      'stay',
      Boolean(risingS1.pendingTransfer?.stay),
      'value',
      risingValue,
      'loan leagues',
      risingS1Loans.map((o) => `${o.clubId}:${getClub(o.clubId)?.league}:${o.contractYears}`),
      'perm fees',
      risingS1Perms.map((o) => `${o.clubId}:${o.fee}`),
    );
    if (!risingS1.pendingTransfer?.stay || !risingS1.pendingTransfer.allowDecline) {
      console.error('Season 1 at 0.33+ must still allow a Rising star stay');
      process.exitCode = 1;
    }
    if (
      risingS1Loans.length !== LOAN_OFFER_COUNT
      || risingS1Loans.some((o) => getClub(o.clubId)?.league !== 'Premier League' || o.contractYears !== 1)
    ) {
      console.error('Season 1 Arsenal 0.33+ loans must be 1-year Premier League moves, not lower-level clubs');
      process.exitCode = 1;
    }
    if (risingValue >= 10_000_000 && risingS1Perms.some((o) => o.fee > 0 && o.fee < 4_000_000)) {
      console.error('a €10m+ player must not receive cheap ~€2.5m bids that ignore market value');
      process.exitCode = 1;
    }
    if (risingS1Perms.length > 0 && risingS1Perms.every((o) => (getClub(o.clubId)?.tier ?? 5) >= 5)) {
      console.error('permanent bids for a valuable Rising star must follow market-value clubs, not only lower-level sides');
      process.exitCode = 1;
    }

    const risingS2 = resolveSeasonTransition({
      season: { ...dummySeason, seasonNumber: 2, clubId: 'arsenal', goals: 10, gamesPlayed: 28, league: 'Premier League' },
      role: 'first-team',
      clubId: 'arsenal',
      parentClubId: 'arsenal',
      seasonsAtCurrentClub: 1,
      age: 18,
      careerGoals: 20,
      careerGames: 56,
      nationality: 'england',
      loansUsed: 0,
      contractYearsRemaining: 4,
      careerStart: 'favourite-first-team',
      squadStatus: 'rising-star',
      clubLeague: 'Premier League',
      seasonHistory: [{ ...dummySeason, seasonNumber: 1, clubId: 'arsenal', goals: 10, gamesPlayed: 28, league: 'Premier League' }],
    });
    const risingS2Loans = (risingS2.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
    console.log(
      'Arsenal 0.35 S2',
      risingS2.headline,
      'stay',
      Boolean(risingS2.pendingTransfer?.stay),
      'decline',
      risingS2.pendingTransfer?.allowDecline,
      'loan years',
      risingS2Loans.map((o) => o.contractYears),
    );
    if (risingS2.pendingTransfer?.stay || risingS2.pendingTransfer?.allowDecline) {
      console.error('Season 2 at 0.33+ must force a loan or transfer, not a stay');
      process.exitCode = 1;
    }
    if (risingS2Loans.length === 0 || risingS2Loans.some((o) => o.contractYears !== 1)) {
      console.error('Season 2 loans must only ever be 1 season, not multi-year deals');
      process.exitCode = 1;
    }
    if (risingS2Loans.some((o) => getClub(o.clubId)?.league !== 'Premier League')) {
      console.error('Season 2 Arsenal 0.33+ loans must still follow the origin club’s top-flight level');
      process.exitCode = 1;
    }
  }

  {
    const s1Pick = isSelectedForNationalTeam({
      clubTier: 1,
      careerGoalRatio: 0.8,
      nationId: 'spain',
      publicSeason: 1,
      calendarWeek: 20,
      squadStatus: 'starter',
      league: 'La Liga',
    });
    const s1After = isSelectedForNationalTeam({
      clubTier: 1,
      careerGoalRatio: 0.8,
      nationId: 'spain',
      publicSeason: 1,
      calendarWeek: 21,
      squadStatus: 'starter',
      league: 'La Liga',
    });
    const s2Early = isSelectedForNationalTeam({
      clubTier: 1,
      careerGoalRatio: 0.8,
      nationId: 'spain',
      publicSeason: 2,
      calendarWeek: 4,
      squadStatus: 'starter',
      league: 'La Liga',
    });
    console.log('S1 call-up week 20/21', s1Pick, s1After, 'S2 week 4', s2Early, 'min week', SEASON_1_CALL_UP_MIN_WEEK);
    if (s1Pick || !s1After || !s2Early) {
      console.error('Season 1 internationals must wait until after week 20');
      process.exitCode = 1;
    }
    const s1Hydrate = hydrateSeason({
      seasonNumber: 1,
      club: getClub('man-city')!,
      careerGoalRatio: 0.8,
      nationId: 'england',
      careerStart: 'favourite-first-team',
    });
    if (s1Hydrate.sim.internationalSelected) {
      console.error('Season 1 must start without a national-team call-up');
      process.exitCode = 1;
    }
  }

  {
    const s4 = hydrateSeason({
      seasonNumber: 4,
      club: getClub('real-madrid')!,
      careerGoalRatio: 0.8,
      nationId: 'spain',
      careerStart: 'favourite-first-team',
      squadStatus: 'starter',
    });
    const leftover = { ...s4.sim, internationalStage: 'qualifying' as const };
    const once = ensureInternationalGroup(leftover, s4.calendar, 4);
    const twice = ensureInternationalGroup(once, s4.calendar, 4);
    if (once !== twice) {
      console.error('ensureInternationalGroup must not allocate a new sim every hub render');
      process.exitCode = 1;
    }
    if (once.internationalStage === 'qualifying') {
      console.error('a leftover qualifying stage in a finals year must be corrected to group');
      process.exitCode = 1;
    }
    const leftoverQualGroup = {
      ...s4.sim,
      internationalStage: 'qualifying' as const,
      internationalGroup: {
        letter: 'Q',
        kind: 'qualifying' as const,
        teamIds: ['spain', 'scotland', 'norway', 'georgia'],
        rows: [],
      },
    };
    let hubSim = leftoverQualGroup;
    let hubWrites = 0;
    for (let i = 0; i < 20; i++) {
      const next = ensureInternationalGroup(hubSim, s4.calendar, 4);
      if (next !== hubSim) {
        hubWrites += 1;
        hubSim = next;
      }
    }
    if (hubWrites > 1) {
      console.error('hub must not rewrite seasonSim on every paint after a leftover qualifying group');
      process.exitCode = 1;
    }
    if (hubSim.internationalStage === 'qualifying' || hubSim.internationalGroup?.kind === 'qualifying') {
      console.error('leftover qualifying table in a Euro year must become the finals group');
      process.exitCode = 1;
    }
    if (internationalStageWhenSelected({ internationalStage: 'not-selected', internationalPhase: 'tournament-only' }) !== 'group') {
      console.error('a mid-season call-up in a finals year must not reset to qualifying');
      process.exitCode = 1;
    }
    const s4Rising = hydrateSeason({
      seasonNumber: 4,
      club: getClub('real-madrid')!,
      careerGoalRatio: 0.8,
      nationId: 'spain',
      careerStart: 'favourite-first-team',
      squadStatus: 'rising-star',
    });
    if (s4Rising.sim.internationalSelected) {
      console.error('Season 4 Rising stars must not receive a national-team call-up');
      process.exitCode = 1;
    }
  }

  {
    const risingWindow = resolveSeasonTransition({
      season: {
        ...dummySeason,
        seasonNumber: 1,
        clubId: 'man-city',
        goals: 22,
        gamesPlayed: 40,
        leagueGoals: 12,
        age: 17,
        squadStatus: 'rising-star',
      },
      role: 'first-team',
      clubId: 'man-city',
      parentClubId: 'man-city',
      seasonsAtCurrentClub: 0,
      age: 17,
      careerGoals: 22,
      careerGames: 40,
      nationality: 'england',
      loansUsed: 0,
      contractYearsRemaining: 2,
      careerStart: 'favourite-first-team',
      squadStatus: 'rising-star',
    });
    const risingOffers = risingWindow.pendingTransfer?.offers ?? [];
    const risingLoans = risingOffers.filter((o) => o.move === 'loan');
    const risingPerms = risingOffers.filter((o) => o.move === 'permanent' && !o.renewal);
    console.log(
      'S1 rising window',
      risingWindow.headline,
      'stay',
      risingWindow.pendingTransfer?.stay?.squadStatus,
      'loans',
      risingLoans.map((o) => getClub(o.clubId)?.league),
      'transfers',
      risingPerms.length,
    );
    if (!isFirstPublicSeason(1, { role: 'first-team', careerStart: 'favourite-first-team' })) {
      console.error('favourite first-team season 1 is the first public season');
      process.exitCode = 1;
    }
    if (risingWindow.pendingTransfer?.kind !== 'loan-or-transfer' || !risingWindow.pendingTransfer.allowDecline) {
      console.error('Season 1 must offer stay, loans, and transfers rather than a forced loan');
      process.exitCode = 1;
    }
    if (risingWindow.pendingTransfer?.stay?.squadStatus !== 'rising-star') {
      console.error('a 0.55 Season 1 ratio at City must stay as Rising star when below the live club bar');
      process.exitCode = 1;
    }
    if (risingLoans.length !== LOAN_OFFER_COUNT || risingLoans.some((o) => SECOND_DIVISIONS.has(getClub(o.clubId)?.league ?? ''))) {
      console.error('Season 1 loans at 0.55 from City must stay in top-flight clubs, not the Championship');
      process.exitCode = 1;
    }
    if (!risingLoans.some((o) => getClub(o.clubId)?.league === 'Premier League')) {
      console.error('Season 1 loans at 0.55 from City must include Premier League clubs');
      process.exitCode = 1;
    }
    if (risingPerms.length === 0) {
      console.error('Season 1 must table transfer offers capped per club');
      process.exitCode = 1;
    }
    const honourStay = resolveSeasonTransition({
      season: {
        ...dummySeason,
        seasonNumber: 1,
        clubId: 'man-city',
        goals: 20,
        gamesPlayed: 51,
        leagueGoals: 14,
        age: 17,
        squadStatus: 'rising-star',
        topGoalscorer: true,
        clubPlayerOfTheTournament: true,
      },
      role: 'first-team',
      clubId: 'man-city',
      parentClubId: 'man-city',
      seasonsAtCurrentClub: 0,
      age: 17,
      careerGoals: 20,
      careerGames: 51,
      nationality: 'england',
      loansUsed: 0,
      contractYearsRemaining: 2,
      careerStart: 'favourite-first-team',
      squadStatus: 'rising-star',
    });
    if (honourStay.pendingTransfer?.stay?.squadStatus !== 'rising-star' && honourStay.immediate?.squadStatus !== 'rising-star') {
      console.error('CL player of the tournament at 0.39 must keep Rising star, not convert to starter');
      process.exitCode = 1;
    }
    const s2RisingDone = resolveSeasonTransition({
      season: {
        ...dummySeason,
        seasonNumber: 2,
        clubId: 'man-city',
        goals: 22,
        gamesPlayed: 40,
        leagueGoals: 16,
        age: 18,
        squadStatus: 'rising-star',
      },
      role: 'first-team',
      clubId: 'man-city',
      parentClubId: 'man-city',
      seasonsAtCurrentClub: 1,
      age: 18,
      careerGoals: 44,
      careerGames: 80,
      nationality: 'england',
      loansUsed: 0,
      contractYearsRemaining: 4,
      careerStart: 'favourite-first-team',
      squadStatus: 'rising-star',
    });
    const s2Next = s2RisingDone.pendingTransfer?.stay?.squadStatus ?? s2RisingDone.immediate?.squadStatus;
    if (s2Next === 'rising-star') {
      console.error('Season 2 must not retain Rising star into Season 3');
      process.exitCode = 1;
    }
    if (!seasonOverridesRatioBar({
      topGoalscorer: true,
      playerOfTheYear: false,
      clubPlayerOfTheTournament: true,
      international: undefined,
    })) {
      console.error('golden boot or tournament POT must override the ratio bar');
      process.exitCode = 1;
    }
  }

  {
    const ajax = getClub('ajax');
    const lafc = getClub('lafc');
    const fee64 = 64_000_000;
    if (ajax && clubTransferBudget(ajax) >= fee64) {
      console.error('Ajax cannot afford a €64m fee');
      process.exitCode = 1;
    }
    if (lafc && clubTransferBudget(lafc) >= fee64) {
      console.error('an MLS club cannot afford a €64m fee');
      process.exitCode = 1;
    }
    const midBids = pickPermanentClubs(2, fee64, [], 'netherlands', false, 'Eredivisie', fee64, 22);
    console.log('€64m medium-club budgets', ajax && clubTransferBudget(ajax), lafc && clubTransferBudget(lafc), midBids.map((c) => `${c.id}:${c.league}:${clubTransferBudget(c)}`));
    if (midBids.some((c) => c.league === 'Eredivisie' || c.league === 'MLS')) {
      console.error('€64m bids must not come from Ajax-level Eredivisie or MLS clubs');
      process.exitCode = 1;
    }
  }

  const thinMiss = resolveSeasonTransition({
    season: { ...dummySeason, seasonNumber: 3, clubId: 'wolves', goals: 0, gamesPlayed: 13, leagueGoals: 0 },
    role: 'first-team',
    clubId: 'wolves',
    parentClubId: 'wolves',
    seasonsAtCurrentClub: 2,
    age: 19,
    careerGoals: 80,
    careerGames: 38 + 38 + 13,
    nationality: 'brazil',
    loansUsed: 0,
    contractYearsRemaining: 5,
    seasonHistory: [
      { ...dummySeason, seasonNumber: 1, clubId: 'wolves', role: 'first-team', goals: 40, gamesPlayed: 38 },
      { ...dummySeason, seasonNumber: 2, clubId: 'wolves', role: 'first-team', goals: 40, gamesPlayed: 38 },
    ],
  });
  const thinOffers = thinMiss.pendingTransfer?.offers ?? [];
  const thinLoans = thinOffers.filter((o) => o.move === 'loan');
  const thinPerms = thinOffers.filter((o) => o.move === 'permanent');
  const thinLoanTiers = thinLoans.map((o) => getClub(o.clubId)?.tier ?? 5);
  const thinPermTiers = thinPerms.map((o) => getClub(o.clubId)?.tier ?? 5);
  const form = offerFormRatio({
    lastSeason: { ...dummySeason, seasonNumber: 3, clubId: 'wolves', goals: 0, gamesPlayed: 13 },
    careerGoals: 80,
    careerGames: 89,
  });
  console.log('13-game 0.00 offers', thinOffers.map((o) => `${o.move}:${o.clubId}:${getClub(o.clubId)?.tier}`), 'form', form.toFixed(2));
  if (form < 0.9 || thinPermTiers.some((t) => t > 1) || thinPerms.length === 0) {
    console.error('a 13-game blank must not tank transfers — they still follow career form');
    process.exitCode = 1;
  }
  if (
    thinLoans.length !== LOAN_OFFER_COUNT
    || thinLoans.some((o) => {
      const dest = getClub(o.clubId);
      return !dest || SECOND_DIVISIONS.has(dest.league);
    })
  ) {
    console.error('elite career form must loan in the same division, not dump a star into the Championship');
    process.exitCode = 1;
  }

  const laterRecall = resolveSeasonTransition({
    season: { ...loanSeason, goals: 20, gamesPlayed: 24 },
    role: 'loan',
    clubId: 'mainz',
    parentClubId: 'freiburg',
    seasonsAtCurrentClub: 0,
    age: 21,
    careerGoals: 40,
    careerGames: 80,
    nationality: 'germany',
    loansUsed: 1,
    homeContractYearsRemaining: 2,
    contractYearsRemaining: 1,
  });
  console.log('later recall years', laterRecall.pendingTransfer?.stay?.contractYearsRemaining, laterRecall.pendingTransfer?.stay?.clubId);
  if (laterRecall.pendingTransfer?.stay?.contractYearsRemaining !== 2 || laterRecall.pendingTransfer?.stay?.clubId !== 'freiburg') {
    console.error('a later loan return must keep the remaining parent-club years, not reset to 5');
    process.exitCode = 1;
  }
  if ((laterRecall.pendingTransfer?.offers ?? []).some((o) => o.move === 'loan')) {
    console.error('a later successful recall must not offer another loan');
    process.exitCode = 1;
  }

  const liverpoolMiss = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'liverpool', goals: 12, gamesPlayed: 36, leagueGoals: 12 },
    role: 'first-team',
    clubId: 'liverpool',
    parentClubId: 'liverpool',
    seasonsAtCurrentClub: 0,
    age: 17,
    careerGoals: 12,
    careerGames: 36,
    nationality: 'england',
    loansUsed: 0,
    contractYearsRemaining: 2,
  });
  const liverpoolRenewal = (liverpoolMiss.pendingTransfer?.offers ?? []).find(
    (o) => o.clubId === 'liverpool' && o.move === 'permanent',
  );
  const liverpoolLoanTiers = (liverpoolMiss.pendingTransfer?.offers ?? [])
    .filter((o) => o.move === 'loan')
    .map((o) => getClub(o.clubId)?.tier ?? 1);
  console.log('Liverpool S1 miss renewal', liverpoolRenewal, 'loan tiers', liverpoolLoanTiers);
  if (liverpoolRenewal) {
    console.error('missing the first-team bar must not table a New Contract from the current club');
    process.exitCode = 1;
  }
  const liverpoolLoans = (liverpoolMiss.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
  if (
    liverpoolLoans.length !== LOAN_OFFER_COUNT
    || liverpoolLoans.some((o) => {
      const dest = getClub(o.clubId);
      return !dest || SECOND_DIVISIONS.has(dest.league);
    })
  ) {
    console.error('a Liverpool miss with remaining elite value must loan in the top flight, not the Championship');
    process.exitCode = 1;
  }

  const leHavre = getClub('le-havre');
  const ligue2Value = leHavre
    ? playerMarketValueFromSeasons({
        age: 18,
        careerGoals: 8,
        careerGames: 52,
        seasons: [
          { ...dummySeason, seasonNumber: 2, clubId: 'le-havre', goals: 4, gamesPlayed: 26, league: 'Ligue 2' },
          { ...dummySeason, seasonNumber: 3, clubId: 'darmstadt', goals: 4, gamesPlayed: 26, league: '2. Bundesliga' },
        ],
        fallbackClub: leHavre,
      })
    : 0;
  console.log('Ligue 2 / 2. Bundesliga 0.15 value', ligue2Value);
  if (!leHavre || ligue2Value >= 5_000_000) {
    console.error('a 0.15 ratio in Ligue 2 and 2. Bundesliga must stay well under €5m');
    process.exitCode = 1;
  }

  const midLower = resolveSeasonTransition({
    season: {
      ...dummySeason,
      clubId: 'le-havre',
      goals: 16,
      gamesPlayed: 36,
      leagueGoals: 16,
      league: 'Ligue 2',
    },
    role: 'first-team',
    clubId: 'le-havre',
    parentClubId: 'le-havre',
    seasonsAtCurrentClub: 1,
    age: 19,
    careerGoals: 28,
    careerGames: 82,
    nationality: 'france',
    loansUsed: 0,
    seasonHistory: [
      { ...dummySeason, seasonNumber: 2, clubId: 'darmstadt', goals: 12, gamesPlayed: 46, league: '2. Bundesliga' },
    ],
    contractYearsRemaining: 3,
  });
  const midValue = leHavre
    ? playerMarketValueFromSeasons({
        age: 19,
        careerGoals: 28,
        careerGames: 82,
        seasons: [
          { ...dummySeason, seasonNumber: 2, clubId: 'darmstadt', goals: 12, gamesPlayed: 46, league: '2. Bundesliga' },
          { ...dummySeason, seasonNumber: 3, clubId: 'le-havre', goals: 16, gamesPlayed: 36, league: 'Ligue 2' },
        ],
        fallbackClub: leHavre,
      })
    : 0;
  const midTiers = (midLower.pendingTransfer?.offers ?? []).map((o) => getClub(o.clubId)?.tier ?? 1);
  console.log('0.34/0.45 lower-league value', midValue, 'offer tiers', midTiers);
  if (midValue >= 18_000_000) {
    console.error('a 0.34 career / 0.45 last season in second divisions must not be valued near €25m');
    process.exitCode = 1;
  }
  if (midTiers.some((tier) => tier <= 2)) {
    console.error('a 0.34/0.45 ratio from lower leagues must not attract Strong or Elite clubs');
    process.exitCode = 1;
  }

  const leicester = getClub('leicester');
  if (leicester) {
    const champSeasons = [2, 3, 4].map((n) => ({
      ...dummySeason,
      seasonNumber: n,
      clubId: 'leicester',
      league: 'Championship',
      goals: 22,
      gamesPlayed: 46,
      leagueGoals: 22,
      leagueGames: 46,
      cupGames: 0,
      cupGoals: 0,
      domesticGames: 46,
      domesticGoals: 22,
      topGoalscorer: n === 4,
    }));
    const champStarValue = playerMarketValueFromSeasons({
      age: 20,
      careerGoals: 66,
      careerGames: 138,
      seasons: champSeasons,
      fallbackClub: leicester,
    });
    console.log('Championship star 66 goals / golden boot value', champStarValue);
    if (champStarValue < 28_000_000) {
      console.error('a young Championship golden-boot winner with 66 goals must be worth far more than €4.7m');
      process.exitCode = 1;
    }
    const hotSeasons = champSeasons.map((s) => ({ ...s, goals: 138, leagueGoals: 138, domesticGoals: 138, gamesPlayed: 46 }));
    const hotValue = playerMarketValueFromSeasons({
      age: 20,
      careerGoals: 414,
      careerGames: 138,
      seasons: hotSeasons,
      fallbackClub: leicester,
    });
    console.log('Championship 3.00 ratio over 138 games', hotValue);
    if (hotValue <= champStarValue) {
      console.error('a 3.0 ratio over a large sample must exceed the young-star floor, not sit under a cap');
      process.exitCode = 1;
    }
    const champStarMove = resolveSeasonTransition({
      season: champSeasons[2],
      role: 'first-team',
      clubId: 'leicester',
      parentClubId: 'leicester',
      seasonsAtCurrentClub: 3,
      age: 20,
      careerGoals: 66,
      careerGames: 138,
      nationality: 'england',
      loansUsed: 0,
      seasonHistory: champSeasons.slice(0, 2),
      contractYearsRemaining: 3,
      clubLeague: 'Championship',
    });
    const champPerms = (champStarMove.pendingTransfer?.offers ?? []).filter(
      (o) => o.move === 'permanent' && !o.renewal && o.clubId !== 'leicester',
    );
    const champSaudi = champPerms.filter((o) => getClub(o.clubId)?.league === 'Saudi Pro League');
    const champEurope = champPerms.filter((o) => getClub(o.clubId)?.league !== 'Saudi Pro League');
    const champLeagues = champPerms.map((o) => getClub(o.clubId)?.league);
    const champTiers = [...new Set(champEurope.map((o) => getClub(o.clubId)?.tier))];
    console.log('Championship star offers', champPerms.length, champLeagues, 'tiers', champTiers, 'saudi', champSaudi.map((o) => o.clubId));
    if (champPerms.length !== TRANSFER_OFFER_COUNT) {
      console.error('Championship transfer windows must table six permanent offers');
      process.exitCode = 1;
    }
    if (champSaudi.length !== 1) {
      console.error('a 20-year-old Championship window must include exactly one Saudi offer');
      process.exitCode = 1;
    }
    if (champTiers.length !== 1) {
      console.error('Championship transfer windows must stay on one ratio-earned band');
      process.exitCode = 1;
    }
    const champModest = resolveSeasonTransition({
      season: {
        ...dummySeason,
        clubId: 'leicester',
        league: 'Championship',
        goals: 8,
        gamesPlayed: 46,
        leagueGoals: 8,
      },
      role: 'first-team',
      clubId: 'leicester',
      parentClubId: 'leicester',
      seasonsAtCurrentClub: 1,
      age: 19,
      careerGoals: 8,
      careerGames: 46,
      nationality: 'england',
      loansUsed: 0,
      contractYearsRemaining: 4,
      clubLeague: 'Championship',
    });
    const modestPerms = (champModest.pendingTransfer?.offers ?? []).filter(
      (o) => o.move === 'permanent' && !o.renewal && o.clubId !== 'leicester',
    );
    const modestLeagues = modestPerms.map((o) => getClub(o.clubId)?.league);
    console.log('Championship modest offers', modestPerms.length, modestLeagues);
    if (modestPerms.length !== TRANSFER_OFFER_COUNT) {
      console.error('a modest Championship season must still offer six clubs');
      process.exitCode = 1;
    }
    if (modestLeagues.some((league) => league !== 'Championship')) {
      console.error('a modest Championship market value must only attract Championship clubs');
      process.exitCode = 1;
    }
  }

  const toulouse = getClub('toulouse');
  if (toulouse) {
    const onLoanBar = requiredGoalRatio('loan', getClub('darmstadt')!, toulouse);
    if (onLoanBar !== toulouse.firstTeamGoalRatio) {
      console.error('on loan the required bar is the parent first-team ratio, not the loan club');
      process.exitCode = 1;
    }
  }

  {
    const hamburg = getClub('hamburg');
    const stuttgart = getClub('stuttgart') ?? getClub('bayern');
    if (hamburg && stuttgart) {
      const dualSecond: SeasonRecord[] = [2, 3].map((n) => ({
        ...dummySeason,
        seasonNumber: n,
        clubId: hamburg.id,
        league: '2. Bundesliga',
        role: 'first-team',
        goals: 12,
        gamesPlayed: 34,
        leagueGoals: 12,
        leagueGames: 34,
        domesticGames: 34,
        domesticGoals: 12,
      }));
      const topYear: SeasonRecord = {
        ...dummySeason,
        seasonNumber: 4,
        clubId: stuttgart.id,
        league: 'Bundesliga',
        role: 'first-team',
        goals: 16,
        gamesPlayed: 34,
        leagueGoals: 16,
        leagueGames: 34,
        domesticGames: 34,
        domesticGoals: 16,
      };
      const seasons = [...dualSecond, topYear];
      const value16 = playerMarketValueFromSeasons({
        age: 21,
        careerGoals: 40,
        careerGames: 102,
        seasons,
        fallbackClub: stuttgart,
      });
      const cap16 = firstTopFlightValueCap(seasons);
      console.log('2. Liga + 16 Bundesliga goals value', value16, 'cap', cap16);
      if (value16 >= 40_000_000 || (cap16 != null && cap16 >= 30_000_000)) {
        console.error('16 top-flight goals after two 2. Liga years must not jump to a €64m valuation');
        process.exitCode = 1;
      }
    }
  }
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
  const zero = calendar.fixtures.find((f) => (f.playerChances ?? 1) === 0 && !shouldSkipFixture(f, sim));
  const frontLoaded = {
    ...calendar,
    fixtures: zero ? [zero, ...calendar.fixtures.filter((f) => f !== zero)] : calendar.fixtures,
  };
  const playable = nextPlayableFixture(frontLoaded, { ...sim, fixtureIndex: 0 });
  const actionable = nextActionableFixture(frontLoaded, { ...sim, fixtureIndex: 0 });
  if (zero && playable === zero) {
    console.error('remaining-playable must still skip a 0-chance fixture');
    process.exitCode = 1;
  }
  if (zero && actionable !== zero) {
    console.error('Continue and the hub Next card must land on the 0-chance sit-out, not a later playable game');
    process.exitCode = 1;
  }
  const afterActionableSf = nextActionableFixture(calendar, { ...out, fixtureIndex: Math.max(0, sfIndex + 1) });
  if (afterActionableSf?.internationalRound === 'final') {
    console.error('hub next-match must not preview a final the nation is already out of');
    process.exitCode = 1;
  }
  console.log('eliminated skips final', Boolean(final && shouldSkipFixture(final, out)), 'next after SF', afterSf?.kind, afterSf?.internationalRound ?? afterSf?.opponentLabel);
}

{
  const hamburg = getClub('hamburg');
  if (hamburg) {
    const hydrated = hydrateSeason({
      seasonNumber: 2,
      club: hamburg,
      careerGoalRatio: 0.4,
      nationId: 'germany',
    });
    const cupIdx = hydrated.calendar.fixtures.findIndex((f) => f.kind === 'domestic-cup');
    const leagueAfter = hydrated.calendar.fixtures.findIndex((f, i) => i > cupIdx && f.kind === 'league');
    if (cupIdx >= 0 && leagueAfter >= 0) {
      hydrated.calendar.fixtures[cupIdx] = { ...hydrated.calendar.fixtures[cupIdx], playerChances: 0 };
      const simAtCup = { ...hydrated.sim, fixtureIndex: cupIdx };
      const shown = nextActionableFixture(hydrated.calendar, simAtCup);
      const later = nextPlayableFixture(hydrated.calendar, simAtCup);
      if (shown !== hydrated.calendar.fixtures[cupIdx] || later?.kind !== 'league') {
        console.error('a 0-chance cup must be the next Continue fixture while Playable still looks at the later league game');
        process.exitCode = 1;
      }
      useCareerStore.getState().resetCareer();
      useCareerStore.setState({
        phase: 'hub',
        clubId: hamburg.id,
        parentClubId: hamburg.id,
        role: 'first-team',
        squadStatus: 'starter',
        nationality: 'germany',
        seasonNumber: 2,
        careerStart: 'favourite-first-team',
        currentSeason: {
          ...dummySeason,
          clubId: hamburg.id,
          role: 'first-team',
          goals: 8,
          gamesPlayed: 20,
        },
        seasonCalendar: hydrated.calendar,
        seasonSim: simAtCup,
        availability: createAvailability(),
        injuryGamesRemaining: 0,
        lastMatchResult: null,
        lastMatchSummary: null,
        weeklyWage: 2000,
        careerEarnings: 0,
        openingCampaign: null,
        liveMatch: null,
      });
      useCareerStore.getState().advance();
      const afterSit = useCareerStore.getState();
      const nextAfter = afterSit.seasonSim && afterSit.seasonCalendar
        ? nextActionableFixture(afterSit.seasonCalendar, afterSit.seasonSim)
        : undefined;
      console.log(
        'sit-out recap',
        afterSit.lastMatchResult?.sitOutReason,
        afterSit.lastMatchResult?.headline,
        'next',
        nextAfter?.opponentLabel,
        nextAfter?.kind,
      );
      if (
        afterSit.lastMatchResult?.sitOutReason !== 'no chance this match'
        || sitOutRecapLine(afterSit.lastMatchResult.sitOutReason) !== 'No chance this match'
        || sitOutRecapLine('no chance this match')?.startsWith('You did not play')
        || !afterSit.lastMatchResult.headline
        || nextAfter?.kind !== 'league'
        || nextAfter.opponentLabel === hydrated.calendar.fixtures[cupIdx].opponentLabel
      ) {
        console.error('a no-chance match must not say “you did not play”; Next must move on to a different opponent');
        process.exitCode = 1;
      }
      useCareerStore.getState().resetCareer();
    }

    const finalIdx = hydrated.calendar.fixtures.findIndex(
      (f) => f.kind === 'domestic-cup' && f.domesticCupStage === 'final',
    );
    if (finalIdx >= 0) {
      const finalFx = hydrated.calendar.fixtures[finalIdx];
      const peek = resolveFixture(hydrated.sim, finalFx, hamburg, 0, () => 0.5, {
        settlePenalties: false,
        ninetyScore: { for: 1, against: 1 },
      });
      if (!peek.needsPenalty || peek.result.outcome !== 'draw') {
        console.error('a level cup final must pause for the player to take a penalty');
        process.exitCode = 1;
      }
      const missed = resolveFixture(hydrated.sim, finalFx, hamburg, 0, () => 0.99, {
        ninetyScore: { for: 1, against: 1 },
        penaltyScored: false,
      });
      const scoredPen = resolveFixture(hydrated.sim, finalFx, hamburg, 1, () => 0, {
        ninetyScore: { for: 1, against: 1 },
        penaltyScored: true,
      });
      console.log('cup-final pens', peek.needsPenalty, missed.result.penalties, scoredPen.result.penalties);
      if (!missed.result.penalties || missed.result.scoreFor !== 1 || missed.result.scoreAgainst !== 1) {
        console.error('a missed shootout kick must keep the 90-minute score and still decide the tie');
        process.exitCode = 1;
      }
      if (!scoredPen.result.penalties?.won) {
        console.error('scoring the shootout kick must give the side a strong chance to go through');
        process.exitCode = 1;
      }

      useCareerStore.getState().resetCareer();
      useCareerStore.setState({
        phase: 'match',
        clubId: hamburg.id,
        parentClubId: hamburg.id,
        role: 'first-team',
        squadStatus: 'starter',
        nationality: 'germany',
        seasonNumber: 2,
        careerStart: 'favourite-first-team',
        currentSeason: {
          ...dummySeason,
          clubId: hamburg.id,
          role: 'first-team',
          goals: 8,
          gamesPlayed: 20,
        },
        seasonCalendar: hydrated.calendar,
        seasonSim: { ...hydrated.sim, fixtureIndex: finalIdx },
        availability: createAvailability(),
        injuryGamesRemaining: 0,
        weeklyWage: 2000,
        careerEarnings: 0,
        openingCampaign: null,
        liveMatch: {
          fixtureIndex: finalIdx,
          chancesTotal: 1,
          chancesTaken: 1,
          goals: 0,
          openPlayGoals: 0,
          penaltyKick: true,
          goalsAtNinety: 0,
          ninetyScoreFor: 1,
          ninetyScoreAgainst: 1,
        },
      });
      const realRandom = Math.random;
      Math.random = () => 0.99;
      useCareerStore.getState().finishLiveMatch();
      const recap = useCareerStore.getState();
      Math.random = realRandom;
      console.log('store cup pens', recap.phase, recap.lastMatchResult?.headline);
      if (recap.liveMatch || !/penalt/i.test(recap.lastMatchResult?.headline ?? '')) {
        console.error('after the shootout kick the recap must show the penalty result');
        process.exitCode = 1;
      }
      useCareerStore.getState().resetCareer();
    }
  }
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
  if (phase.some((c) => c.id === 'wolves' || clubContinentalCup(c) === 'uecl')) {
    console.error('Champions League opponents must not include Conference League sides such as Wolves');
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

console.log('\n--- Premier League table: second place needs a real points haul ---');
{
  const trials = 24;
  const seconds: number[] = [];
  const firsts: number[] = [];
  for (let i = 0; i < trials; i++) {
    const table = simulateLeagueSeason('Premier League');
    firsts.push(table[0]?.points ?? 0);
    seconds.push(table[1]?.points ?? 0);
  }
  const avgFirst = firsts.reduce((s, n) => s + n, 0) / trials;
  const avgSecond = seconds.reduce((s, n) => s + n, 0) / trials;
  const minSecond = Math.min(...seconds);
  console.log(
    `PL over ${trials} seasons: 1st avg ${avgFirst.toFixed(1)}, 2nd avg ${avgSecond.toFixed(1)} (min ${minSecond})`,
  );
  if (avgSecond < 72 || minSecond < 68 || avgFirst <= avgSecond) {
    console.error('a 20-team league must need well above 63 points to finish second');
    process.exitCode = 1;
  }
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
  const stayStatus = promoted.pendingTransfer?.stay?.squadStatus ?? 'starter';
  const promoValue = playerMarketValueFromSeasons({
    age: 22,
    careerGoals: 40,
    careerGames: 70,
    seasons: [{ ...dummySeason, clubId: 'leicester', goals: 20, gamesPlayed: 38 }],
    fallbackClub: leicester,
    contractYearsRemaining: DEFAULT_CONTRACT_YEARS,
    seasonNumber: dummySeason.seasonNumber,
    calendarWeek: 99,
    role: 'first-team',
  });
  const expectedStayWage = weeklyWageForRatio(leicester, promoValue, 20 / 38, stayStatus, 'Premier League');
  console.log('promotion stay wage', stayWage, 'years', stayYears, 'expected', expectedStayWage);
  if (stayWage !== expectedStayWage || stayYears == null || stayYears < 1) {
    console.error('promotion stay terms must include a Premier League wage scaled by last season’s ratio');
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
  if (mlsCal.totalWeeks > 56 || leagueMatchWeeks('MLS', lafc) > 26) {
    console.error('an MLS season must not run past 56 weeks or 26 league weeks');
    process.exitCode = 1;
  }
  if ((mlsKinds.playoff ?? 0) < 5 || (mlsKinds['leagues-cup'] ?? 0) < 4) {
    console.error('MLS must schedule playoffs (wild card through MLS Cup) and Leagues Cup');
    process.exitCode = 1;
  }
  const firstMlsSeason = hydrateSeason({
    seasonNumber: 1,
    club: lafc,
    careerGoalRatio: 0.6,
    nationId: 'spain',
    careerStart: 'favourite-first-team',
  });
  const firstMlsLeagues = firstMlsSeason.calendar.fixtures.filter((f) => f.kind === 'leagues-cup');
  const firstMlsMx = firstMlsLeagues.filter((f) => getClub(f.opponentId ?? '')?.league === 'Liga MX');
  console.log('first MLS season after arriving: Leagues Cup', firstMlsLeagues.length, 'Liga MX', firstMlsMx.length);
  if (firstMlsLeagues.length < 4 || firstMlsMx.length < 1) {
    console.error('the first MLS season after moving in must still play Leagues Cup against Liga MX');
    process.exitCode = 1;
  }
  const toronto = getClub('toronto');
  if (toronto) {
    const { calendar: canCal } = hydrateSeason({
      seasonNumber: 1,
      club: toronto,
      careerGoalRatio: 0.55,
      nationId: 'canada',
    });
    if (!canCal.fixtures.some((f) => f.kind === 'leagues-cup')) {
      console.error('a Canadian MLS club must play Leagues Cup in its first season');
      process.exitCode = 1;
    }
  }
  const playoffPath = [1, 4, 5, 6, 7].map((pos) => ({
    pos,
    open: playoffOpeningForPosition(pos),
    games: playoffGamesFromOpening(playoffOpeningForPosition(pos)),
  }));
  console.log('MLS playoff path', playoffPath);
  if (playoffOpeningForPosition(1) !== 'first-round' || playoffOpeningForPosition(4) !== 'first-round') {
    console.error('conference seeds 1–4 must play the first round (no bye)');
    process.exitCode = 1;
  }
  if (playoffOpeningForPosition(5) !== 'wild-card' || playoffOpeningForPosition(6) !== 'wild-card') {
    console.error('conference seeds 5–6 must play a wild-card game');
    process.exitCode = 1;
  }
  if (playoffOpeningForPosition(7) !== 'not-qualified' || playoffGamesFromOpening('not-qualified') !== 0) {
    console.error('7th in conference must miss the playoffs');
    process.exitCode = 1;
  }
  if (playoffGamesFromOpening('first-round') !== 4 || playoffGamesFromOpening('wild-card') !== 5) {
    console.error('MLS playoff length must be 4 games from the first round and 5 from the wild card');
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
  if (saudiCal.totalWeeks > 56) {
    console.error('a Saudi season must not run past 56 weeks');
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
  const twilightSaudi = (twilight.pendingTransfer?.offers ?? []).filter((o) => getClub(o.clubId)?.league === 'Saudi Pro League');
  const ordinaryMlsWage = weeklyWageForClub(getClub('lafc')!, 80_000_000);
  console.log(
    'age-34 MLS offers',
    twilightMls.map((o) => `${o.clubId} ${o.weeklyWage}`),
    'Saudi',
    twilightSaudi.map((o) => `${o.clubId} ${o.weeklyWage}`),
    'ordinary LAFC',
    ordinaryMlsWage,
  );
  const mlsIds = new Set(twilightMls.map((o) => o.clubId));
  const saudiIds = new Set(twilightSaudi.map((o) => o.clubId));
  if (TWILIGHT_MLS_CLUB_IDS.some((id) => !mlsIds.has(id))) {
    console.error('age 34 must be offered LAFC, Inter Miami, NYCFC and LA Galaxy');
    process.exitCode = 1;
  }
  if (twilightSaudi.length !== 1 || ![...saudiIds].every((id) => (TWILIGHT_SAUDI_CLUB_IDS as readonly string[]).includes(id))) {
    console.error('age 34 must see exactly one Saudi giant offer');
    process.exitCode = 1;
  }
  const namedMlsWages = twilightMls.filter((o) => (TWILIGHT_MLS_CLUB_IDS as readonly string[]).includes(o.clubId));
  const namedSaudiWages = twilightSaudi.filter((o) => (TWILIGHT_SAUDI_CLUB_IDS as readonly string[]).includes(o.clubId));
  if (
    namedMlsWages.some((o) => o.weeklyWage < 100_000 || o.weeklyWage <= ordinaryMlsWage)
    || namedSaudiWages.some((o) => o.weeklyWage < 100_000 || o.weeklyWage <= ordinaryMlsWage)
  ) {
    console.error('twilight MLS and Saudi wages must sit at top-tier European level');
    process.exitCode = 1;
  }

  const age32 = resolveSeasonTransition({
    season: { ...dummySeason, clubId: 'barcelona', goals: 20, gamesPlayed: 38 },
    role: 'first-team',
    clubId: 'barcelona',
    parentClubId: 'barcelona',
    seasonsAtCurrentClub: 2,
    age: 32,
    careerGoals: 180,
    careerGames: 360,
    nationality: 'spain',
    loansUsed: 2,
    contractYearsRemaining: 1,
  });
  const age32Mls = (age32.pendingTransfer?.offers ?? []).filter((o) => getClub(o.clubId)?.league === 'MLS');
  const age32Saudi = (age32.pendingTransfer?.offers ?? []).filter((o) => getClub(o.clubId)?.league === 'Saudi Pro League');
  console.log('age-32 Saudi offers', age32Saudi.map((o) => o.clubId), 'MLS', age32Mls.length);
  if (TWILIGHT_MLS_CLUB_IDS.every((id) => age32Mls.some((o) => o.clubId === id))) {
    console.error('MLS twilight offers start at 34, not 32');
    process.exitCode = 1;
  }
  if (age32Saudi.length !== 1 || age32Saudi.some((o) => !(TWILIGHT_SAUDI_CLUB_IDS as readonly string[]).includes(o.clubId))) {
    console.error('from age 32 exactly one Saudi giant must table a star contract');
    process.exitCode = 1;
  }
  if (
    age32Saudi
      .filter((o) => (TWILIGHT_SAUDI_CLUB_IDS as readonly string[]).includes(o.clubId))
      .some((o) => o.weeklyWage < 100_000 || o.weeklyWage <= ordinaryMlsWage)
  ) {
    console.error('age-32 Saudi offers must pay elite European wages');
    process.exitCode = 1;
  }

  const starAt = (age: number) =>
    resolveSeasonTransition({
      season: { ...dummySeason, clubId: 'barcelona', goals: 20, gamesPlayed: 38, age },
      role: 'first-team',
      clubId: 'barcelona',
      parentClubId: 'barcelona',
      seasonsAtCurrentClub: 2,
      age,
      careerGoals: 80,
      careerGames: 120,
      nationality: 'spain',
      loansUsed: 0,
      contractYearsRemaining: 2,
    });
  const age19Saudi = (starAt(19).pendingTransfer?.offers ?? []).filter((o) => getClub(o.clubId)?.league === 'Saudi Pro League');
  const age20Saudi = (starAt(20).pendingTransfer?.offers ?? []).filter((o) => getClub(o.clubId)?.league === 'Saudi Pro League');
  console.log('star Saudi offers', '19', age19Saudi.map((o) => o.clubId), '20', age20Saudi.map((o) => o.clubId));
  if (age19Saudi.length !== 0) {
    console.error('a 19-year-old must not receive a Saudi offer');
    process.exitCode = 1;
  }
  if (age20Saudi.length !== 1 || age20Saudi.some((o) => !(TWILIGHT_SAUDI_CLUB_IDS as readonly string[]).includes(o.clubId))) {
    console.error('from age 20 a star window must include exactly one Saudi giant');
    process.exitCode = 1;
  }

  const sponsorStar = seasonalSponsorship(200_000_000, 'Premier League');
  const sponsorCheap = seasonalSponsorship(900_000, 'Premier League');
  const sponsorFloor = seasonalSponsorship(10_000_000, 'La Liga');
  const sponsorJustUnder = seasonalSponsorship(9_900_000, 'Premier League');
  const sponsorChampionship = seasonalSponsorship(25_000_000, 'Championship');
  const sponsorLigue2 = seasonalSponsorship(25_000_000, 'Ligue 2');
  console.log('sponsorship €200m', sponsorStar, '€900k', sponsorCheap, '€10m', sponsorFloor, '€9.9m', sponsorJustUnder);
  if (sponsorStar < 5_000_000 || sponsorCheap !== 0 || sponsorJustUnder !== 0 || sponsorFloor <= 0 || sponsorCheap >= sponsorStar) {
    console.error('sponsorship must be zero below €10m and scale with market value above that');
    process.exitCode = 1;
  }
  if (sponsorChampionship !== 0 || sponsorLigue2 !== 0) {
    console.error('sponsorship is only for Premier League, Ligue 1, Bundesliga, Serie A and La Liga');
    process.exitCode = 1;
  }
  if (FIRST_CONTRACT_YEARS !== 3 || RESERVE_CONTRACT_YEARS !== 3 || loanContractYearsRemaining(2, 5, 17) !== 1) {
    console.error('the first Rising-star contract is 3 years; reserve deals are 3 years; loans stay 1 year');
    process.exitCode = 1;
  }
  if (loanContractYearsRemaining(5, 5, 22) !== 1 || loanContractYearsRemaining(8, 1, 28) !== 1) {
    console.error('loans must only ever be one season, including later-career windows');
    process.exitCode = 1;
  }

  {
    const arsenalS1 = resolveSeasonTransition({
      season: {
        ...dummySeason,
        seasonNumber: 1,
        clubId: 'arsenal',
        goals: 18,
        gamesPlayed: 38,
        leagueGoals: 14,
        age: 17,
        squadStatus: 'rising-star',
      },
      role: 'first-team',
      clubId: 'arsenal',
      parentClubId: 'arsenal',
      seasonsAtCurrentClub: 0,
      age: 17,
      careerGoals: 18,
      careerGames: 38,
      nationality: 'england',
      loansUsed: 0,
      contractYearsRemaining: FIRST_CONTRACT_YEARS,
      careerStart: 'favourite-first-team',
      squadStatus: 'rising-star',
      weeklyWage: 154_000,
    });
    const arsenalLoans = (arsenalS1.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
    const arsenalPerms = (arsenalS1.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent' && !o.renewal);
    const arsenalRenewal = (arsenalS1.pendingTransfer?.offers ?? []).find((o) => o.renewal && o.clubId === 'arsenal');
    const arsenalLoanWages = new Set(arsenalLoans.map((o) => o.weeklyWage));
    const arsenalTiers = arsenalPerms.map((o) => getClub(o.clubId)?.tier ?? 5);
    console.log('Arsenal 0.48 window', arsenalS1.headline, 'loan wages', [...arsenalLoanWages], 'tiers', arsenalTiers, 'renewal', arsenalRenewal?.weeklyWage);
    if (arsenalRenewal) {
      console.error('Season 1 that misses the club ratio must not table a current-club renewal');
      process.exitCode = 1;
    }
    if (arsenalPerms.some((o) => o.weeklyWage <= 0)) {
      console.error('Season 1 must still table other clubs’ salary offers after a missed ratio');
      process.exitCode = 1;
    }
    if (arsenalLoans.length !== LOAN_OFFER_COUNT || arsenalLoanWages.size < 2 || arsenalLoans.some((o) => o.weeklyWage === 154_000)) {
      console.error('Arsenal 0.48 loan wages must vary by destination instead of copying the current 154k salary');
      process.exitCode = 1;
    }
    const honourAlreadyMet = resolveSeasonTransition({
      season: {
        ...dummySeason,
        seasonNumber: 1,
        clubId: 'arsenal',
        goals: 28,
        gamesPlayed: 38,
        leagueGoals: 22,
        age: 17,
        squadStatus: 'rising-star',
        topGoalscorer: true,
        playerOfTheYear: true,
      },
      role: 'first-team',
      clubId: 'arsenal',
      parentClubId: 'arsenal',
      seasonsAtCurrentClub: 0,
      age: 17,
      careerGoals: 28,
      careerGames: 38,
      nationality: 'england',
      loansUsed: 0,
      contractYearsRemaining: FIRST_CONTRACT_YEARS,
      careerStart: 'favourite-first-team',
      squadStatus: 'rising-star',
    });
    const honourRenewal = (honourAlreadyMet.pendingTransfer?.offers ?? []).find((o) => o.renewal && o.clubId === 'arsenal');
    const honourLoans = (honourAlreadyMet.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
    console.log('S2 honour with ratio met', honourAlreadyMet.headline, honourAlreadyMet.detail, 'renewal', Boolean(honourRenewal), 'loans', honourLoans.length);
    if (/honour/i.test(`${honourAlreadyMet.headline} ${honourAlreadyMet.detail}`)) {
      console.error('honour-override copy must not show when the finishing ratio already cleared the bar');
      process.exitCode = 1;
    }
    if (!honourRenewal || honourRenewal.weeklyWage <= 0) {
      console.error('Season 1 that meets the club ratio must include the current club’s salary offer');
      process.exitCode = 1;
    }
    if (honourLoans.length !== 0) {
      console.error('meeting the club ratio must not table loan offers');
      process.exitCode = 1;
    }
    const arsenalBlank = resolveSeasonTransition({
      season: {
        ...dummySeason,
        seasonNumber: 1,
        clubId: 'arsenal',
        goals: 0,
        gamesPlayed: 38,
        leagueGoals: 0,
        age: 17,
        squadStatus: 'rising-star',
      },
      role: 'first-team',
      clubId: 'arsenal',
      parentClubId: 'arsenal',
      seasonsAtCurrentClub: 0,
      age: 17,
      careerGoals: 0,
      careerGames: 38,
      nationality: 'england',
      loansUsed: 0,
      contractYearsRemaining: FIRST_CONTRACT_YEARS,
      careerStart: 'favourite-first-team',
      squadStatus: 'rising-star',
      weeklyWage: 154_000,
    });
    const arsenalBlankRenewal = (arsenalBlank.pendingTransfer?.offers ?? []).find((o) => o.renewal && o.clubId === 'arsenal');
    const arsenalBlankLoans = (arsenalBlank.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
    console.log('Arsenal 0.0 window', arsenalBlank.headline, 'renewal', Boolean(arsenalBlankRenewal), 'loans', arsenalBlankLoans.length);
    if (arsenalBlankRenewal) {
      console.error('0.0 at an elite club must not table a current-club renewal');
      process.exitCode = 1;
    }
    if (arsenalBlankLoans.length !== LOAN_OFFER_COUNT || arsenalBlankLoans.some((o) => o.weeklyWage === 154_000)) {
      console.error('Arsenal 0.0 loan wages must not copy the current 154k salary');
      process.exitCode = 1;
    }
    if (arsenalTiers.some((tier) => tier <= 2)) {
      console.error('a season that has not earned the Strong/Elite ratio must not draw those transfer offers');
      process.exitCode = 1;
    }
    const reserveWages = new Set(
      arsenalPerms.filter((o) => o.squadStatus === 'reserve').map((o) => o.weeklyWage),
    );
    if (arsenalPerms.some((o) => o.squadStatus === 'reserve' && o.weeklyWage === 1000) && reserveWages.size < 2 && arsenalPerms.filter((o) => o.squadStatus === 'reserve').length > 1) {
      console.error('reserve transfer wages must be 20% of each club’s average wage');
      process.exitCode = 1;
    }
    const madridBlank = resolveSeasonTransition({
      season: {
        ...dummySeason,
        seasonNumber: 1,
        clubId: 'real-madrid',
        goals: 0,
        gamesPlayed: 38,
        leagueGoals: 0,
        age: 17,
        squadStatus: 'rising-star',
      },
      role: 'first-team',
      clubId: 'real-madrid',
      parentClubId: 'real-madrid',
      seasonsAtCurrentClub: 0,
      age: 17,
      careerGoals: 0,
      careerGames: 38,
      nationality: 'spain',
      loansUsed: 0,
      contractYearsRemaining: FIRST_CONTRACT_YEARS,
      careerStart: 'favourite-first-team',
      squadStatus: 'rising-star',
    });
    const madridRenewal = (madridBlank.pendingTransfer?.offers ?? []).find((o) => o.renewal && o.clubId === 'real-madrid');
    const madridReserve = (madridBlank.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent' && o.squadStatus === 'reserve');
    console.log('Madrid 0.0', madridBlank.headline, 'renewal', Boolean(madridRenewal), 'reserve deals', madridReserve.map((o) => `${o.clubId}:${o.contractYears}:${o.weeklyWage}`));
    if (madridRenewal) {
      console.error('0.0 at Real Madrid must not table a current-club renewal');
      process.exitCode = 1;
    }
    if (madridReserve.length === 0 || madridReserve.some((o) => o.contractYears !== RESERVE_CONTRACT_YEARS)) {
      console.error('reserve-role offers must be 3-year deals');
      process.exitCode = 1;
    }
    if (madridReserve.some((o) => {
      const dest = getClub(o.clubId);
      return !dest || o.weeklyWage !== weeklyWageForSquadStatus(dest, 0, 'reserve');
    })) {
      console.error('reserve-role offers must pay 20% of the destination club’s average wage');
      process.exitCode = 1;
    }

    const freeWindow = resolveSeasonTransition({
      season: {
        ...dummySeason,
        seasonNumber: 3,
        clubId: 'leeds',
        role: 'loan',
        goals: 12,
        gamesPlayed: 38,
        leagueGoals: 10,
        age: 19,
      },
      role: 'loan',
      clubId: 'leeds',
      parentClubId: 'arsenal',
      seasonsAtCurrentClub: 0,
      age: 19,
      careerGoals: 48,
      careerGames: 114,
      nationality: 'england',
      loansUsed: 1,
      contractYearsRemaining: 1,
      careerStart: 'favourite-first-team',
      squadStatus: 'starter',
    });
    const freeLoans = (freeWindow.pendingTransfer?.offers ?? []).filter((o) => o.move === 'loan');
    const freePerms = (freeWindow.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent');
    console.log('free transfer window', freeWindow.headline, 'loans', freeLoans.length, 'fees', freePerms.map((o) => o.fee));
    if (freeLoans.length !== 0) {
      console.error('an expired contract must not table loan offers');
      process.exitCode = 1;
    }
    if (freePerms.length === 0 || freePerms.some((o) => o.fee !== 0)) {
      console.error('an expired contract must table free transfers only');
      process.exitCode = 1;
    }

    const barcaTooCheap = sellingClubAcceptsOffer({
      offer: {
        clubId: 'barcelona',
        move: 'permanent',
        fee: 90_000_000,
        weeklyWage: 200_000,
        contractYears: 5,
      },
      kind: 'end-of-season',
      allowDecline: true,
      currentClubId: 'real-madrid',
      role: 'first-team',
      squadStatus: 'starter',
      contractYearsLeft: 4,
      playerValue: 300_000_000,
      remainingPermanentOffers: 3,
    });
    const megaEnough = sellingClubAcceptsOffer({
      offer: {
        clubId: 'man-city',
        move: 'permanent',
        fee: 250_000_000,
        weeklyWage: 300_000,
        contractYears: 5,
      },
      kind: 'end-of-season',
      allowDecline: true,
      currentClubId: 'real-madrid',
      role: 'first-team',
      squadStatus: 'starter',
      contractYearsLeft: 4,
      playerValue: 300_000_000,
      remainingPermanentOffers: 2,
    });
    const asking300 = transferFeeFromValue(300_000_000, 4);
    console.log('€300m asking', asking300, 'barca', barcaTooCheap.accepted, 'city', megaEnough.accepted);
    if (barcaTooCheap.accepted || !/too expensive/i.test(barcaTooCheap.detail)) {
      console.error('a €90m Barcelona bid must be rejected against a €300m player');
      process.exitCode = 1;
    }
    if (!megaEnough.accepted || 250_000_000 < asking300 * MIN_ACCEPTED_FEE_RATIO) {
      console.error('a mega club bidding at least 80% of the asking fee must be accepted');
      process.exitCode = 1;
    }
    if (RESERVE_WAGE_FACTOR !== 0.2 || RESERVE_WEEKLY_WAGE !== 500) {
      console.error('reserve wages are 20% of the destination starter band with a €500 floor');
      process.exitCode = 1;
    }
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
  const favEarly = playerMarketValueFromSeasons({
    age: 17,
    careerGoals: 18,
    careerGames: 20,
    seasons: [{
      ...dummySeason,
      seasonNumber: 1,
      clubId: 'wolves',
      role: 'first-team',
      goals: 18,
      gamesPlayed: 20,
    }],
    fallbackClub: getClub('wolves')!,
    contractYearsRemaining: 2,
    seasonNumber: 1,
    calendarWeek: 15,
    careerStart: 'favourite-first-team',
    role: 'first-team',
  });
  const favLate = playerMarketValueFromSeasons({
    age: 17,
    careerGoals: 22,
    careerGames: 26,
    seasons: [{
      ...dummySeason,
      seasonNumber: 1,
      clubId: 'wolves',
      role: 'first-team',
      goals: 22,
      gamesPlayed: 26,
    }],
    fallbackClub: getClub('wolves')!,
    contractYearsRemaining: 2,
    seasonNumber: 1,
    calendarWeek: 25,
    careerStart: 'favourite-first-team',
    role: 'first-team',
  });
  const favS2Week1 = playerMarketValueFromSeasons({
    age: 18,
    careerGoals: 30,
    careerGames: 40,
    seasons: [{
      ...dummySeason,
      seasonNumber: 1,
      clubId: 'wolves',
      role: 'first-team',
      goals: 30,
      gamesPlayed: 40,
    }],
    fallbackClub: getClub('wolves')!,
    contractYearsRemaining: 1,
    seasonNumber: 2,
    calendarWeek: 1,
    careerStart: 'favourite-first-team',
    role: 'first-team',
  });
  console.log('favourite S1 week 15', favEarly, 'week 25', favLate, 'S2 week 1', favS2Week1);
  if (favEarly !== YOUTH_MARKET_VALUE) {
    console.error('favourite first-team Season 1 must stay at €100k until week 20');
    process.exitCode = 1;
  }
  if (favLate <= YOUTH_MARKET_VALUE) {
    console.error('favourite first-team Season 1 must update market value after week 20');
    process.exitCode = 1;
  }
  if (favS2Week1 <= YOUTH_MARKET_VALUE) {
    console.error('favourite first-team Season 2 must not wait until week 20 to show market value');
    process.exitCode = 1;
  }
  if (isSeason1ValueLocked(1, 25, { careerStart: 'favourite-first-team', role: 'first-team' })) {
    console.error('favourite Season 1 week 25 must not be value-locked');
    process.exitCode = 1;
  }
  if (!isSeason1ValueLocked(1, 15, { careerStart: 'youth', role: 'first-team' })) {
    console.error('youth-path Season 1 must stay locked until week 20');
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
    awardTally.find((a) => a.name === 'League top goalscorer')?.count !== 2 ||
    awardTally.find((a) => a.name === 'League player of the year')?.count !== 1 ||
    awardTally.find((a) => a.name === 'World Player of the Year')?.count !== 1
  ) {
    console.error('career awards must count league top scorer, league player of the year and WPY');
    process.exitCode = 1;
  }
  const namedClubPot = awardLabels({
    ...dummySeason,
    clubPlayerOfTheTournament: true,
    continentalChampion: 'ucl',
    trophies: ['Champions League'],
  });
  if (!namedClubPot.includes('Champions League Player of the Tournament')) {
    console.error('club tournament player of the tournament must name the cup');
    process.exitCode = 1;
  }
  if (formatGamesGoals(2, 0) !== '2 games · 0 goals') {
    console.error('international lines must show games and goals, not “0 in 2”');
    process.exitCode = 1;
  }

  const splitSeason: SeasonRecord = {
    ...dummySeason,
    leagueGoals: 24,
    leagueGames: 38,
    cupGames: 4,
    cupGoals: 2,
    domesticGames: 42,
    domesticGoals: 26,
    continentalStats: [{ cup: 'ucl', games: 13, goals: 4 }],
  };
  const split = seasonDomesticSplit(splitSeason);
  const careerSplit = aggregateDomesticSplit([splitSeason, { ...splitSeason, leagueGoals: 20, leagueGames: 36, cupGames: 4, cupGoals: 2, domesticGames: 40, domesticGoals: 22 }]);
  const continentalOnly = aggregateContinental([splitSeason]);
  console.log('domestic split', split, 'career', careerSplit, 'continental', continentalOnly);
  if (split.league.goals !== 24 || split.cup.goals !== 2 || split.total.games !== 42) {
    console.error('domestic tables must list league and cup games and goals separately');
    process.exitCode = 1;
  }
  if (careerSplit.league.goals !== 44 || careerSplit.cup.games !== 8 || continentalOnly.some((row) => row.cup === 'ucl') === false) {
    console.error('career domestic totals must not include Champions League games');
    process.exitCode = 1;
  }
  const afterCup = recordClubAppearanceStats(splitSeason, {
    week: 12,
    kind: 'domestic-cup',
    isDecisive: false,
    domesticCup: 'copa-del-rey',
    domesticCupStage: 'quarter-final',
  }, 1, true);
  if ((afterCup.cupGames ?? 0) !== 5 || (afterCup.cupGoals ?? 0) !== 3 || (afterCup.leagueGames ?? 0) !== 38) {
    console.error('a cup tie must add to cup games and goals, not the league row');
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
  if (
    cupFromLeaguePosition('Primeira Liga', 2) !== 'ucl'
    || cupFromLeaguePosition('Primeira Liga', 3) !== 'uel'
    || cupFromLeaguePosition('Primeira Liga', 4) !== 'uecl'
    || cupFromLeaguePosition('Eredivisie', 2) !== 'ucl'
    || cupFromLeaguePosition('Super Lig', 4) !== 'uecl'
    || cupFromLeaguePosition('Super Lig', 5) != null
  ) {
    console.error('Portugal, Netherlands and Turkey must get 2 CL, 1 EL and 1 ECL');
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
  let copaDup = 0;
  for (let i = 0; i < 60; i++) {
    const drawn = tournamentOpponents('brazil', 'copa-america', () => (i * 17 % 97) / 97);
    const koIds = drawn.slice(3).map((n) => n.id);
    if (new Set(koIds).size !== koIds.length) copaDup += 1;
    const sf = koIds[koIds.length - 2];
    const final = koIds[koIds.length - 1];
    if (sf && final && sf === final) copaDup += 1;
  }
  console.log('Copa América duplicate knockout opponents across 60 draws', copaDup);
  if (copaDup > 0) {
    console.error('Copa América must not reuse Argentina (or any nation) in both the semi-final and the final');
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
  console.log('win rate 0 goals: sit-out/baseline', baseline.toFixed(3), '1 miss', oneMiss.toFixed(3), '4 misses', fourMiss.toFixed(3));
  if (fourMiss >= baseline - 0.08) {
    console.error('missing all four chances must cut the club’s win rate; sit-outs must not apply that penalty');
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
  if (s3Group.length !== 3) {
    console.error('Nations League group must list three opponents');
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
    knockoutRankCap('round-of-32', 'world-cup') !== 32
    || knockoutRankCap('round-of-16', 'world-cup') !== 32
    || knockoutRankCap('quarter-final', 'world-cup') !== 32
    || knockoutRankCap('semi-final', 'world-cup') !== 8
    || knockoutRankCap('final', 'world-cup') !== 8
    || worldCupKnockoutRankCap('final') !== 8
    || knockoutRankCap('round-of-16') !== 16
    || knockoutRankCap('quarter-final') !== 8
    || knockoutRankCap('final') !== 8
  ) {
    console.error('World Cup knockouts are top 32 until the last four; other tournaments stay top 16 / top 8');
    process.exitCode = 1;
  }
  let r32Over = 0;
  let r16Over = 0;
  let qfOver = 0;
  let sfOver = 0;
  let finalOver = 0;
  let euroR16Over = 0;
  let euroQfOver = 0;
  for (let i = 0; i < 30; i++) {
    const drawn = tournamentOpponents('spain', 'world-cup');
    const r32 = drawn[3];
    const r16 = drawn[4];
    const qf = drawn[5];
    const sf = drawn[6];
    const fin = drawn[7];
    if (!r32 || fifaRank(r32.id) > 32) r32Over += 1;
    if (!r16 || fifaRank(r16.id) > 32) r16Over += 1;
    if (!qf || fifaRank(qf.id) > 32) qfOver += 1;
    if (!sf || fifaRank(sf.id) > 8) sfOver += 1;
    if (!fin || fifaRank(fin.id) > 8) finalOver += 1;
    const euro = tournamentOpponents('spain', 'euro');
    const euroR16 = euro[3];
    const euroQf = euro[4];
    if (!euroR16 || fifaRank(euroR16.id) > 16) euroR16Over += 1;
    if (!euroQf || fifaRank(euroQf.id) > 8) euroQfOver += 1;
  }
  console.log(
    'rank-cap misses WC R32/R16/QF/SF/final',
    r32Over,
    r16Over,
    qfOver,
    sfOver,
    finalOver,
    'Euro R16/QF',
    euroR16Over,
    euroQfOver,
  );
  if (r32Over > 0 || r16Over > 0 || qfOver > 0 || sfOver > 0 || finalOver > 0 || euroR16Over > 0 || euroQfOver > 0) {
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

console.log('\n--- Live board is home–away and updates after each chance ---');
{
  if (formatHomeAwayScore(4, 1, true) !== '4\u20131' || formatHomeAwayScore(4, 1, false) !== '1\u20134') {
    console.error('the score line must put the home team on the left');
    process.exitCode = 1;
  }
  const madridClub = getClub('real-madrid')!;
  const burnley = getClub('burnley') ?? getClub('leicester')!;
  const city = getClub('man-city')!;
  if (!blowoutScorePossible(madridClub.strength + 3.5, burnley.strength)) {
    console.error('Madrid at home vs a much weaker side must be able to reach 6–0');
    process.exitCode = 1;
  }
  if (blowoutScorePossible(madridClub.strength + 3.5, city.strength)) {
    console.error('an elite home clash must not treat 6–0 as a live score');
    process.exitCode = 1;
  }
  const evenCaps = plausibleGoalCaps(madridClub.strength + 3.5, city.strength);
  if (evenCaps.maxFor - 4 >= 2) {
    console.error('four player chances in an even game must leave no room for a 2–0 teammate lead');
    process.exitCode = 1;
  }
  let evenLead = 0;
  let blowoutLead = 0;
  let highScore = 0;
  for (let i = 0; i < 400; i++) {
    const even = simulateClubMatch(
      { clubStrength: madridClub.strength, opponentStrength: city.strength, isHome: true },
      Math.random,
      0,
      4,
    );
    if (even.scoreFor >= 2 && even.scoreAgainst === 0) evenLead += 1;
    const blow = simulateClubMatch(
      { clubStrength: madridClub.strength, opponentStrength: burnley.strength, isHome: true },
      Math.random,
      0,
      4,
    );
    if (blow.scoreFor === 2 && blow.scoreAgainst === 0) blowoutLead += 1;
    const basketball = simulateClubMatch(
      { clubStrength: 78, opponentStrength: 76, isHome: true },
      Math.random,
      4,
      4,
    );
    if (basketball.scoreFor >= 5 && basketball.scoreAgainst >= 5) highScore += 1;
  }
  console.log('2-0 before 4 chances even/blowout', evenLead, blowoutLead, '6-5 class', highScore);
  if (evenLead > 0) {
    console.error('the team must not be 2–0 up before the first of four chances unless a 6–0 is possible');
    process.exitCode = 1;
  }
  if (highScore > 8) {
    console.error('6–5 scorelines must stay extremely rare');
    process.exitCode = 1;
  }

  const { calendar, sim } = hydrateSeason({
    seasonNumber: 2,
    club: madridClub,
    careerGoalRatio: 0.8,
    nationId: 'spain',
  });
  const awayFx = calendar.fixtures.find((f) => f.kind === 'league' && f.isHome === false && f.opponentId)
    ?? calendar.fixtures.find((f) => f.kind === 'league' && f.opponentId);
  if (!awayFx) {
    console.error('season 2 must have a league fixture to check the live board');
    process.exitCode = 1;
  } else {
    const fixture = { ...awayFx, isHome: false, playerChances: 4 };
    const live0 = { fixtureIndex: calendar.fixtures.indexOf(awayFx), chancesTotal: 4, chancesTaken: 0, goals: 0 };
    const live3 = { ...live0, chancesTaken: 3, goals: 3 };
    const line0 = liveMatchBoardLine({ sim, fixture, club: madridClub, live: live0, seasonNumber: 2 });
    const line3 = liveMatchBoardLine({ sim, fixture, club: madridClub, live: live3, seasonNumber: 2 });
    const rng = mulberry32(liveMatchScoreSeed(2, live0.fixtureIndex, madridClub.id));
    const finished = resolveFixture(sim, fixture, madridClub, 3, rng, { settlePenalties: false });
    const finishedLine = formatHomeAwayScore(finished.result.scoreFor, finished.result.scoreAgainst, false);
    const peek0 = simulateClubMatch(
      { clubStrength: madridClub.strength, opponentStrength: getClub(fixture.opponentId!)?.strength, isHome: false },
      mulberry32(liveMatchScoreSeed(2, live0.fixtureIndex, madridClub.id)),
      0,
      4,
    );
    const peek3 = simulateClubMatch(
      { clubStrength: madridClub.strength, opponentStrength: getClub(fixture.opponentId!)?.strength, isHome: false },
      mulberry32(liveMatchScoreSeed(2, live0.fixtureIndex, madridClub.id)),
      3,
      4,
    );
    console.log('live board away 0 then 3 then full time', line0, line3, finishedLine, peek0, peek3);
    if (peek3.scoreFor !== peek0.scoreFor + 3 || peek3.scoreAgainst !== peek0.scoreAgainst) {
      console.error('adding player goals must not re-roll teammate or opponent scores');
      process.exitCode = 1;
    }
    const away0 = line0.split('\u2013').map(Number);
    const away3 = line3.split('\u2013').map(Number);
    const finishedParts = finishedLine.split('\u2013').map(Number);
    if (away3[1] < away0[1] + 3) {
      console.error('scoring three away goals must raise the right-hand score by at least three');
      process.exitCode = 1;
    }
    if (finishedParts[0] < away3[0]) {
      console.error('full time must not drop opponent goals already shown on the live board');
      process.exitCode = 1;
    }
    if (line0.split('\u2013')[0] === String(peek0.scoreFor) && peek0.scoreFor !== peek0.scoreAgainst) {
      console.error('an away board must not put the player\'s team on the left');
      process.exitCode = 1;
    }
    let beforeFirst = 0;
    let betweenChances = 0;
    let afterLast = 0;
    const firstMinute = chanceMinute(0, 4, 'league');
    const lastMinute = chanceMinute(3, 4, 'league');
    for (let seed = 1; seed <= 400; seed++) {
      const timeline = simulateMatchTimeline(
        { clubStrength: madridClub.strength, opponentStrength: burnley.strength, isHome: true },
        mulberry32(seed * 7919),
        4,
      );
      if (timeline.goals.some((goal) => goal.side === 'against' && goal.minute < firstMinute)) beforeFirst += 1;
      if (timeline.goals.some((goal) => goal.side === 'against' && goal.minute >= firstMinute && goal.minute < lastMinute)) {
        betweenChances += 1;
      }
      if (timeline.goals.some((goal) => goal.side === 'against' && goal.minute >= lastMinute)) afterLast += 1;
    }
    console.log('opponent goals before/between/after chances', beforeFirst, betweenChances, afterLast);
    if (beforeFirst === 0 || betweenChances === 0 || afterLast === 0) {
      console.error('opponent goals must be able to land before, between, and after the player\'s chances');
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
    console.error('World Cup golden-boot chances must be 6/50, 7/75, 8+/90');
    process.exitCode = 1;
  }
  const r16 = evaluateInternationalTournamentAwards({
    tournament: 'world-cup',
    finalsGoals: 11,
    tournamentOutcome: 'round-of-16',
    rng: () => 0,
  });
  const champion = evaluateInternationalTournamentAwards({
    tournament: 'world-cup',
    finalsGoals: 4,
    tournamentOutcome: 'champion',
    rng: () => 0,
  });
  const losingFinal = evaluateInternationalTournamentAwards({
    tournament: 'world-cup',
    finalsGoals: 8,
    tournamentOutcome: 'final',
    rng: () => 0,
  });
  let roll = 0;
  const losingFinalMiss = evaluateInternationalTournamentAwards({
    tournament: 'world-cup',
    finalsGoals: 8,
    tournamentOutcome: 'final',
    rng: () => {
      roll += 1;
      return roll === 1 ? 0 : 0.99;
    },
  });
  console.log('POTT r16/champion/losing final', r16.playerOfTheTournament, champion.playerOfTheTournament, losingFinal.playerOfTheTournament);
  if (r16.playerOfTheTournament) {
    console.error('Player of the Tournament must not be awarded after a last-16 exit');
    process.exitCode = 1;
  }
  if (!champion.playerOfTheTournament) {
    console.error('a World Cup winner must be eligible for Player of the Tournament');
    process.exitCode = 1;
  }
  if (!losingFinal.topGoalscorer || !losingFinal.playerOfTheTournament || losingFinalMiss.playerOfTheTournament) {
    console.error('a losing finalist who won the golden boot with 8 goals must roll a 50% Player of the Tournament chance');
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
  if (luminance(arsenal.socks) < 0.8) {
    console.error('Arsenal must wear white home socks');
    process.exitCode = 1;
  }
  if (luminance(sevilla.socks) > 0.25) {
    console.error('Sevilla must wear black home socks');
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
  const homeFxDay = { ...homeFx };
  for (let week = 1; week <= 40; week++) {
    homeFxDay.week = week;
    if (!fixtureIsNight(homeFxDay)) break;
  }
  const homeLookDay = resolveMatchStadium({ fixture: homeFxDay, club: madridClub, nation: spain });
  if (homeLookDay.night) {
    console.error('daylight league fixtures must still exist');
    process.exitCode = 1;
  }
  if (homeLook.isHome !== true || awayLook.isHome !== false) {
    console.error('isHome must pass through to the stadium');
    process.exitCode = 1;
  }

  const trialLook = trialStadium(spain);
  const youthLook = resolveCareerStadium({
    fixture: {
      week: 1,
      kind: 'international',
      isDecisive: false,
      internationalRound: 'group',
      opponentId: 'italy',
      opponentLabel: 'Italy',
    },
    nation: spain,
    seasonNumber: 1,
    role: 'reserve',
    openingKind: 'youth-tournament',
  });
  const clubTrialLook = resolveCareerStadium({
    fixture: homeFx,
    club: madridClub,
    nation: spain,
    seasonNumber: 1,
    role: 'reserve',
    openingKind: 'club-trial',
  });
  const reserveLook = resolveCareerStadium({
    fixture: homeFx,
    club: madridClub,
    nation: spain,
    seasonNumber: 1,
    role: 'reserve',
  });
  const firstTeamLook = resolveCareerStadium({
    fixture: homeFx,
    club: madridClub,
    nation: spain,
    seasonNumber: 2,
    role: 'first-team',
  });
  console.log(
    'youth/club-trial/reserve/first-team venues',
    youthLook.groundName,
    youthLook.capacity,
    clubTrialLook.groundName,
    reserveLook.groundName,
    firstTeamLook.groundName,
  );
  if (
    youthLook.groundName !== YOUTH_TOURNAMENT_GROUND.name
    || youthLook.capacity !== YOUTH_TOURNAMENT_CAPACITY
    || youthLook.standTiers !== 1
  ) {
    console.error('the U16 tournament must use the one-tier youth stadium');
    process.exitCode = 1;
  }
  if (
    clubTrialLook.groundName !== CLUB_TRIAL_GROUND.name
    || clubTrialLook.capacity !== CLUB_TRIAL_CAPACITY
    || clubTrialLook.standTiers !== 1
  ) {
    console.error('club trial games must use the one-tier academy ground');
    process.exitCode = 1;
  }
  if (clubTrialLook.homeColor !== madridClub.color) {
    console.error('club trial still uses the trial club kit on the academy ground');
    process.exitCode = 1;
  }
  if (trialLook.bowl !== false) {
    console.error('the unused open-pitch helper must stay an open pitch');
    process.exitCode = 1;
  }
  if (youthLook.crowdFill !== 'sparse' || clubTrialLook.crowdFill !== 'empty' || reserveLook.crowdFill !== 'sparse') {
    console.error('U16 crowds must be sparse, trial stands empty, and reserve crowds sparse');
    process.exitCode = 1;
  }
  if (
    reserveLook.groundName !== groundForClub('real-madrid').name
    || reserveLook.crowdFill !== 'sparse'
  ) {
    console.error('the reserve season must use first-team grounds with a sparse crowd');
    process.exitCode = 1;
  }
  const favouriteReserveLook = resolveCareerStadium({
    fixture: homeFx,
    club: madridClub,
    nation: spain,
    seasonNumber: 1,
    role: 'reserve',
    careerStart: 'favourite-reserve',
  });
  if (
    favouriteReserveLook.groundName !== CLUB_TRIAL_GROUND.name
    || favouriteReserveLook.crowdFill !== 'sparse'
    || favouriteReserveLook.standTiers !== 1
  ) {
    console.error('favourite-club reserve games must use the academy ground with a sparse crowd');
    process.exitCode = 1;
  }
  if (reserveStadium(madridClub).crowdFill !== 'sparse') {
    console.error('the unused municipal reserve helper must stay sparse');
    process.exitCode = 1;
  }
  if (firstTeamLook.groundName !== groundForClub('real-madrid').name || firstTeamLook.capacity !== 83_186) {
    console.error('first-team matches must still use the club ground');
    process.exitCode = 1;
  }
  const favouriteFirstS1Look = resolveCareerStadium({
    fixture: homeFx,
    club: madridClub,
    nation: spain,
    seasonNumber: 1,
    role: 'first-team',
    careerStart: 'favourite-first-team',
  });
  if (favouriteFirstS1Look.crowdFill !== 'full' || favouriteFirstS1Look.groundName !== groundForClub('real-madrid').name) {
    console.error('favourite first-team Season 1 must use a packed first-team crowd');
    process.exitCode = 1;
  }
  const injuredFinals = markInjuryMissedFinals(undefined, 'world-cup');
  if (!injuredFinals.injuryMissedFinals || injuredFinals.tournament !== 'world-cup') {
    console.error('missing an end-of-season tournament game through injury must be recorded');
    process.exitCode = 1;
  }
  const ligue2Club = getClub('le-havre');
  const serieBClub = getClub('salernitana');
  if (ligue2Club && serieBClub) {
    const ligue2Look = resolveMatchStadium({
      fixture: { week: 1, kind: 'league', isDecisive: false, opponentId: 'pau', opponentLabel: 'Pau' },
      club: ligue2Club,
    });
    const serieBLook = resolveMatchStadium({
      fixture: { week: 1, kind: 'league', isDecisive: false, opponentId: 'bari', opponentLabel: 'Bari' },
      club: serieBClub,
    });
    console.log('Ligue 2 / Serie B grounds', ligue2Look.groundName, ligue2Look.capacity, serieBLook.groundName);
    if (
      ligue2Look.groundName !== UNLISTED_GROUND.name
      || ligue2Look.capacity !== UNLISTED_GROUND.capacity
      || serieBLook.groundName !== UNLISTED_GROUND.name
      || serieBLook.capacity !== UNLISTED_GROUND.capacity
    ) {
      console.error('Ligue 2 and Serie B matches must use the smallest municipal stadium');
      process.exitCode = 1;
    }
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
  if (!fixtureIsNight(uclFx) || fixtureIsNight(groupFx) || !fixtureIsNight(koFx)) {
    console.error('fixtureIsNight must match europe-night / group-day / knockout-night');
    process.exitCode = 1;
  }
  if (groupLook.awayShare !== 0.5 || koLook.awayShare !== 0.5 || !fixtureIsNeutral(groupFx) || !fixtureIsNeutral(koFx)) {
    console.error('international tournament games must be neutral with a 50/50 country crowd');
    process.exitCode = 1;
  }
  if (
    groupLook.groundName !== INTERNATIONAL_TOURNAMENT_GROUND.name
    || groupLook.capacity !== INTERNATIONAL_TOURNAMENT_CAPACITY
    || koLook.groundName !== INTERNATIONAL_TOURNAMENT_GROUND.name
  ) {
    console.error('international tournament games must use the tournament stadium, not the club-final bowl');
    process.exitCode = 1;
  }
  const qualifierFx = { ...groupFx, internationalRound: 'qualifier' as const, isHome: true };
  const qualifierLook = resolveMatchStadium({ fixture: qualifierFx, club: madridClub, nation: spain });
  if (fixtureIsNeutral(qualifierFx) || fixtureVenueLabel(qualifierFx) !== 'Home' || qualifierLook.awayShare === 0.5) {
    console.error('World Cup qualifiers must stay home or away, not neutral');
    process.exitCode = 1;
  }
  if (fixtureVenueLabel(groupFx) !== 'Neutral' || fixtureVenueLabel(koFx) !== 'Neutral') {
    console.error('tournament group and knockout games must be labelled Neutral');
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
  const leagueNight = calendar.fixtures.filter((f) => f.kind === 'league' && fixtureIsNight(f)).length;
  const leagueTotal = calendar.fixtures.filter((f) => f.kind === 'league').length;
  const leagueNightRate = leagueNight / Math.max(1, leagueTotal);
  console.log('league night kickoffs', leagueNight, '/', leagueTotal, `(${(leagueNightRate * 100).toFixed(1)}%)`);
  if (leagueNightRate < 0.08 || leagueNightRate > 0.32) {
    console.error('about 20% of domestic league games should be night kick-offs');
    process.exitCode = 1;
  }
  const nightA = { week: 7, kind: 'league' as const, isDecisive: false, opponentId: 'sevilla', isHome: true };
  const nightB = { ...nightA };
  if (fixtureIsNight(nightA) !== fixtureIsNight(nightB)) {
    console.error('league night kick-offs must be deterministic');
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
  const psgG = groundForClub('psg');
  const psgL = stadiumLayout(close, psgG);
  console.log('PSG', psgG.name, psgG.capacity, psgG.tiers, 'decks', psgL.decks.length);
  if (psgG.tiers !== 2 || psgL.decks.length !== 2 || psgG.capacity < 45_000 || psgG.capacity > 52_000) {
    console.error('Parc des Princes must be two tiers at about 45–48k capacity');
    process.exitCode = 1;
  }
  evenDecks(psgL, 2, 'Parc des Princes');
  if (Object.keys(CLUB_GROUNDS).length < 46) {
    console.error('the listed stadium table is missing clubs');
    process.exitCode = 1;
  }
  const luz = groundForClub('benfica');
  const dragao = groundForClub('porto');
  const cruyff = groundForClub('ajax');
  const rams = groundForClub('galatasaray');
  console.log('PT/NL/TR grounds', luz.name, luz.tiers, dragao.tiers, cruyff.tiers, rams.tiers);
  if (luz.tiers !== 3 || luz.capacity < 60_000 || luz.name !== 'Estádio da Luz') {
    console.error('Benfica must play in a three-deck Estádio da Luz');
    process.exitCode = 1;
  }
  const threeDeck = CLUBS
    .filter((c) => c.country === 'Portugal' || c.country === 'Netherlands' || c.country === 'Turkey')
    .filter((c) => groundForClub(c.id).tiers === 3)
    .map((c) => c.id);
  if (threeDeck.length !== 1 || threeDeck[0] !== 'benfica') {
    console.error('only Benfica among Portugal, Netherlands and Turkey clubs may have a three-tier stadium', threeDeck);
    process.exitCode = 1;
  }
  if (dragao.tiers > 2 || cruyff.tiers > 2 || rams.tiers > 2) {
    console.error('Porto, Ajax and Galatasaray must be one or two decks');
    process.exitCode = 1;
  }
  if (groundForClub('estoril').tiers !== 2 || isListedGround('estoril') || (groundForClub('estoril').capacity ?? 99_000) >= LISTED_MIN_CAPACITY) {
    console.error('smaller Primeira Liga grounds must stay two-deck municipal stands');
    process.exitCode = 1;
  }
}

console.log('\n--- Kits, cup nights, FA Cup semis, sun, World Cup copy, African skin ---');
{
  const portugal = nationKit('portugal');
  const argentina = nationKit('argentina');
  const brazil = nationKit('brazil');
  console.log('portugal kit', portugal.primary, portugal.shorts, portugal.socks);
  console.log('argentina kit', argentina.pattern, argentina.shorts, argentina.socks);
  console.log('brazil kit', brazil.primary, brazil.shorts, brazil.socks);
  if (portugal.primary !== '#FF0000' || portugal.shorts !== '#006600' || portugal.socks !== '#FF0000') {
    console.error('Portugal must wear a red jersey, green shorts and red socks');
    process.exitCode = 1;
  }
  if (argentina.pattern !== 'vertical' || argentina.shorts !== '#000000' || argentina.socks !== '#FFFFFF') {
    console.error('Argentina must wear light-blue stripes, black shorts and white socks');
    process.exitCode = 1;
  }
  if (brazil.primary !== '#FFDF00' || brazil.shorts !== '#002776' || brazil.socks !== '#FFFFFF') {
    console.error('Brazil must wear a yellow jersey, blue shorts and white socks');
    process.exitCode = 1;
  }
  const brentford = clubKit(getClub('brentford'));
  const bournemouth = clubKit(getClub('bournemouth'));
  const valencia = clubKit(getClub('valencia'));
  const lyon = clubKit(getClub('lyon'));
  if (brentford.pattern !== 'vertical' || bournemouth.pattern !== 'vertical') {
    console.error('Brentford and Bournemouth must wear red and white striped shirts');
    process.exitCode = 1;
  }
  if (valencia.primary !== '#FFFFFF' || valencia.shorts !== '#000000' || valencia.socks !== '#FFFFFF') {
    console.error('Valencia must wear a white jersey, black shorts and white socks');
    process.exitCode = 1;
  }
  if (lyon.primary !== '#FFFFFF' || lyon.shorts !== '#FFFFFF' || lyon.socks !== '#FFFFFF') {
    console.error('Lyon must wear all white');
    process.exitCode = 1;
  }
  const sportingKit = clubKit(getClub('sporting'));
  const ajaxKit = clubKit(getClub('ajax'));
  const portoKit = clubKit(getClub('porto'));
  const galaKit = clubKit(getClub('galatasaray'));
  const fenerKit = clubKit(getClub('fenerbahce'));
  const besiktasKit = clubKit(getClub('besiktas'));
  if (sportingKit.pattern !== 'hoops' || sportingKit.primary !== '#008057') {
    console.error('Sporting CP must wear green and white hoops');
    process.exitCode = 1;
  }
  if (ajaxKit.pattern !== 'vertical' || portoKit.pattern !== 'vertical' || galaKit.pattern !== 'vertical') {
    console.error('Ajax, Porto and Galatasaray must wear striped shirts');
    process.exitCode = 1;
  }
  if (fenerKit.secondary !== '#FFD100' || besiktasKit.pattern !== 'vertical') {
    console.error('Fenerbahçe must be navy/yellow and Beşiktaş black/white stripes');
    process.exitCode = 1;
  }

  const nightCups = [
    { week: 12, kind: 'domestic-cup' as const, isDecisive: false, domesticCup: 'copa-del-rey' as const, domesticCupStage: 'quarter-final' as const },
    { week: 12, kind: 'domestic-cup' as const, isDecisive: false, domesticCup: 'coppa-italia' as const, domesticCupStage: 'quarter-final' as const },
    { week: 12, kind: 'domestic-cup' as const, isDecisive: false, domesticCup: 'dfb-pokal' as const, domesticCupStage: 'quarter-final' as const },
    { week: 12, kind: 'domestic-cup' as const, isDecisive: false, domesticCup: 'coupe-de-france' as const, domesticCupStage: 'quarter-final' as const },
    { week: 12, kind: 'domestic-cup' as const, isDecisive: false, domesticCup: 'taca-de-portugal' as const, domesticCupStage: 'quarter-final' as const },
    { week: 12, kind: 'domestic-cup' as const, isDecisive: false, domesticCup: 'knvb-beker' as const, domesticCupStage: 'quarter-final' as const },
    { week: 12, kind: 'domestic-cup' as const, isDecisive: false, domesticCup: 'turkish-cup' as const, domesticCupStage: 'quarter-final' as const },
  ];
  if (nightCups.some((f) => !fixtureIsNight(f))) {
    console.error('Spanish, German, Italian, French, Portuguese, Dutch and Turkish cup ties must be night games');
    process.exitCode = 1;
  }

  const faSemi = {
    week: 28,
    kind: 'domestic-cup' as const,
    isDecisive: false,
    domesticCup: 'fa-cup' as const,
    domesticCupStage: 'semi-final' as const,
    isHome: true,
  };
  if (!isClubFinalNeutral(faSemi) || fixtureVenueLabel(faSemi) !== 'Neutral') {
    console.error('FA Cup semi-finals must be played at a neutral venue');
    process.exitCode = 1;
  }

  const earlyDay = { week: 3, kind: 'international' as const, isDecisive: false, internationalRound: 'group' as const, opponentId: 'italy' };
  const midDay = { week: 18, kind: 'international' as const, isDecisive: false, internationalRound: 'group' as const, opponentId: 'italy' };
  const lateDay = { week: 34, kind: 'international' as const, isDecisive: false, internationalRound: 'group' as const, opponentId: 'italy' };
  const earlyLook = resolveMatchStadium({ fixture: earlyDay, club: getClub('real-madrid') });
  const midLook = resolveMatchStadium({ fixture: midDay, club: getClub('real-madrid') });
  const lateLook = resolveMatchStadium({ fixture: lateDay, club: getClub('real-madrid') });
  console.log('sun weeks', earlyLook.showSun, midLook.showSun, lateLook.showSun, 'nights', nightCups.map(fixtureIsNight));
  if (!fixtureShowsSun(earlyDay) || fixtureShowsSun(midDay) || !fixtureShowsSun(lateDay)) {
    console.error('day games need sun in weeks 1–6 and from week 33, and no sun in weeks 7–32');
    process.exitCode = 1;
  }
  if (earlyLook.showSun !== true || midLook.showSun !== false || lateLook.showSun !== true) {
    console.error('stadium appearance must follow the seasonal sun calendar');
    process.exitCode = 1;
  }
  if (nightCups.some((f) => fixtureShowsSun(f))) {
    console.error('night games must not show the sun');
    process.exitCode = 1;
  }

  const wcTitle = fixtureTitle(
    { week: 30, kind: 'international', isDecisive: false, internationalRound: 'group', opponentLabel: 'Italy' },
    { tournament: 'world-cup', playerNationName: 'Spain' },
  );
  const wcKoTitle = fixtureTitle(
    { week: 34, kind: 'international', isDecisive: false, internationalRound: 'round-of-16', opponentLabel: 'Brazil' },
    { tournamentName: 'World Cup' },
  );
  console.log('WC titles', wcTitle, wcKoTitle);
  if (!wcTitle.includes('World Cup') || !wcKoTitle.includes('World Cup')) {
    console.error('Play Next Match must mention World Cup during the tournament');
    process.exitCode = 1;
  }

  for (let i = 0; i < 80; i++) {
    const tone = pickPlayerSkin(i * 17 + 3, 'africa');
    if (!AFRICA_SKIN_TONES.includes(tone as typeof AFRICA_SKIN_TONES[number])) {
      console.error('African national-team keepers and defenders must use brown skin only');
      process.exitCode = 1;
      break;
    }
  }
  const africaKeeper = idleKeeperPose(() => 0.11, 'africa');
  if (!AFRICA_SKIN_TONES.includes(africaKeeper.skinTone as typeof AFRICA_SKIN_TONES[number])) {
    console.error('African keepers must spawn with a brown skin tone');
    process.exitCode = 1;
  }

  const swedenN = getNation('sweden')!;
  const polandN = getNation('poland')!;
  const brazilN = getNation('brazil')!;
  const malaysiaN = getNation('malaysia')!;
  if (appearanceRegionForNation(swedenN) !== 'nordic' || appearanceRegionForNation(polandN) !== 'eastern-europe' || appearanceRegionForNation(brazilN) !== 'latino') {
    console.error('Sweden/Poland/Brazil must map to nordic, eastern-europe, latino looks');
    process.exitCode = 1;
  }
  if (appearanceRegionForNation(malaysiaN) !== 'southeast-asia') {
    console.error('Malaysia must use southeast-Asian skin tones, not the generic fair mix');
    process.exitCode = 1;
  }
  for (let i = 0; i < 40; i++) {
    const my = pickPlayerLook(i * 23 + 8, 'southeast-asia');
    if (luminance(my.skin) > 0.72) {
      console.error('southeast-Asian sides must not spawn fair northern-European skin');
      process.exitCode = 1;
      break;
    }
  }
  let swedenBlonde = 0;
  let polandFair = 0;
  let brazilBlack = 0;
  for (let i = 0; i < 40; i++) {
    const sw = pickPlayerLook(i * 19 + 4, 'nordic');
    const pl = pickPlayerLook(i * 19 + 4, 'eastern-europe');
    const br = pickPlayerLook(i * 19 + 4, 'latino');
    if (!isFairSkin(sw.skin) || !isFairSkin(pl.skin)) {
      console.error('Nordic and eastern-European players must be white-skinned');
      process.exitCode = 1;
      break;
    }
    if (isBlondeHair(sw.hair)) swedenBlonde += 1;
    if (isFairSkin(pl.skin)) polandFair += 1;
    if (isBlackHair(br.hair)) brazilBlack += 1;
    if (luminance(br.skin) > 0.78) {
      console.error('Latino sides should not spawn very-fair Nordic skin');
      process.exitCode = 1;
      break;
    }
  }
  console.log('looks sweden-blonde', swedenBlonde, 'poland-fair', polandFair, 'brazil-black-brown', brazilBlack);
  if (swedenBlonde < 24) {
    console.error('Sweden must be predominantly blonde');
    process.exitCode = 1;
  }
  if (polandFair < 40) {
    console.error('Eastern Europe must only use fair skin');
    process.exitCode = 1;
  }
  if (brazilBlack < 28) {
    console.error('Latino sides must typically be light-brown with black hair');
    process.exitCode = 1;
  }

  console.log('pitch quality', pitchQualityFromStrength(94), pitchQualityFromStrength(66), pitchQualityFromStrength(52));
  if (pitchQualityFromStrength(94) !== 'elite' || pitchQualityFromStrength(66) !== 'tired' || pitchQualityFromStrength(52) !== 'worn') {
    console.error('pitch quality must follow club strength');
    process.exitCode = 1;
  }
  const madridPitchClub = getClub('real-madrid')!;
  const elitePitchLook = resolveMatchStadium({ club: madridPitchClub });
  const reservePitchLook = resolveCareerStadium({ club: madridPitchClub, role: 'reserve' });
  const youthPitchLook = resolveCareerStadium({
    nation: getNation('spain'),
    openingKind: 'youth-tournament',
    role: 'reserve',
  });
  if (elitePitchLook.pitchQuality !== 'elite' || reservePitchLook.pitchQuality !== 'worn' || youthPitchLook.pitchQuality !== 'worn') {
    console.error('elite first-team grass must be lush; reserve and youth pitches must be worn');
    process.exitCode = 1;
  }
  const lutonLook = resolveMatchStadium({ club: getClub('luton') });
  if (lutonLook.pitchQuality !== 'worn') {
    console.error('a Championship side must play on a worn pitch');
    process.exitCode = 1;
  }
  if (elitePitchLook.pitchStripes !== true || lutonLook.pitchStripes !== false || youthPitchLook.pitchStripes !== false || reservePitchLook.pitchStripes !== false) {
    console.error('only top-flight pitches get full-width mowing stripes');
    process.exitCode = 1;
  }
  const swedenPitch = resolveMatchStadium({
    nation: getNation('sweden'),
    fixture: { week: 40, kind: 'international', isDecisive: false, internationalRound: 'group', opponentId: 'norway' },
  });
  const andorraPitch = resolveMatchStadium({
    nation: getNation('luxembourg'),
    fixture: { week: 40, kind: 'international', isDecisive: false, internationalRound: 'qualifier', opponentId: 'latvia' },
  });
  if (swedenPitch.pitchStripes !== true || andorraPitch.pitchStripes !== false) {
    console.error('nations outside the FIFA top 50 must not have striped grass');
    process.exitCode = 1;
  }

  const arsenalKit = clubKit(getClub('arsenal'));
  const psgKit = clubKit(getClub('psg'));
  const villaKit = clubKit(getClub('aston-villa'));
  const sevillaKit = clubKit(getClub('sevilla'));
  const niKit = nationKit('northern-ireland');
  const irlKit = nationKit('republic-of-ireland');
  if (arsenalKit.sleeves !== '#FFFFFF' || psgKit.primary !== '#DA001C' || psgKit.sleeves !== '#004170') {
    console.error('Arsenal need white sleeves and PSG a red shirt with blue sleeves');
    process.exitCode = 1;
  }
  if (villaKit.shorts !== '#FFFFFF' || villaKit.socks !== '#95BFE5' || sevillaKit.socks !== '#000000') {
    console.error('Villa shorts/socks and Sevilla black socks are wrong');
    process.exitCode = 1;
  }
  if (niKit.shorts !== '#FFFFFF' || irlKit.shorts !== '#FFFFFF') {
    console.error('Northern Ireland and Ireland must wear white shorts');
    process.exitCode = 1;
  }

  const uclTitle = fixtureTitle(
    { week: 12, kind: 'continental-group', isDecisive: false, continentalCup: 'ucl', opponentLabel: 'Bayern Munich' },
  );
  if (!uclTitle.includes('Champions League')) {
    console.error('continental fixtures must include the tournament name');
    process.exitCode = 1;
  }

  const fourYear = resolveSeasonTransition({
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
    contractYearsRemaining: 4,
  });
  const fourYearPerm = (fourYear.pendingTransfer?.offers ?? []).filter((o) => o.move === 'permanent');
  if (fourYearPerm.length > 0 && fourYearPerm.some((o) => o.fee <= 0)) {
    console.error('permanent offers with years remaining on the deal must not be free');
    process.exitCode = 1;
  }

  if (nationCanWinMajor('france', 0) !== true || nationCanWinMajor('belgium', 2) !== false || nationCanWinMajor('belgium', 3) !== true) {
    console.error('major-tournament win rules must allow top 5 freely and top 20 only with 3 knockout scores');
    process.exitCode = 1;
  }
  if (nationCanProgressKnockout('france', false, 'round-of-16') !== true || nationCanProgressKnockout('belgium', false, 'quarter-final') !== false) {
    console.error('only top-5 sides may progress early knockouts without a player goal');
    process.exitCode = 1;
  }

  const nlSpain = hydrateSeason({ seasonNumber: 3, club: getClub('real-madrid')!, careerGoalRatio: 0.8, nationId: 'spain' });
  const nlGroupIds = nlSpain.calendar.fixtures.filter((f) => f.internationalRound === 'group').map((f) => f.opponentId).sort();
  if (nlGroupIds.join() !== ['croatia', 'czechia', 'england'].sort().join() || !nlSpain.sim.internationalGroup) {
    console.error('Spain must play the fixed Nations League group C and have a live table');
    process.exitCode = 1;
  }
  const euroOut = hydrateSeason({ seasonNumber: 4, club: getClub('real-madrid')!, careerGoalRatio: 0.8, nationId: 'san-marino' });
  if (euroOut.sim.internationalSelected || euroOut.calendar.fixtures.some((f) => f.kind === 'international')) {
    console.error('nations outside Euro groups A–H must not play the Euros');
    process.exitCode = 1;
  }

  let nlMiss = 0;
  for (let i = 0; i < 20; i++) {
    const drawn = tournamentOpponents('spain', 'nations-league');
    const group = drawn.slice(0, 3);
    if (
      group.some((n) => getNation(n.id)?.confederation !== 'UEFA')
      || group.some((n) => Math.abs(fifaRank(n.id) - fifaRank('spain')) > 35)
    ) {
      nlMiss += 1;
    }
  }
  console.log('NL close-rank misses', nlMiss, 'UEFA pool', nationsInConfederation('UEFA').length);
  if (nlMiss > 0) {
    console.error('Nations League groups must stay with closely ranked European countries');
    process.exitCode = 1;
  }
}

console.log('\n--- Club cups, paced tables, transfers, injuries, and elite scores ---');
{
  const city = getClub('man-city')!;
  const madrid = getClub('real-madrid')!;
  const calendar = buildSeasonCalendar({
    seasonNumber: 2,
    leagueMatchWeeks: leagueMatchWeeks('Premier League'),
    clubTier: 1,
    confederation: 'UEFA',
    country: 'England',
    nationConfederation: 'UEFA',
  });
  const r16 = calendar.fixtures.filter((f) => f.kind === 'continental-knockout' && f.europeanRound === 'round-of-16');
  const qf = calendar.fixtures.filter((f) => f.kind === 'continental-knockout' && f.europeanRound === 'quarter-final');
  if (r16.length !== 2 || qf.length !== 2 || !qf.some((f) => f.leg === 2)) {
    console.error('Champions League quarter-finals must be two-legged and tagged separately from the last 16');
    process.exitCode = 1;
  }
  const qfTitle = fixtureTitle({
    week: 36,
    kind: 'continental-knockout',
    continentalCup: 'ucl',
    isDecisive: false,
    leg: 2,
    europeanRound: 'quarter-final',
    opponentLabel: 'Real Madrid',
  });
  if (!qfTitle.includes('quarter-final') || !qfTitle.includes('2nd leg')) {
    console.error('quarter-final second legs must be titled as quarter-final 2nd leg');
    process.exitCode = 1;
  }

  const qf2Brief = nextMatchBriefing(
    {
      week: 36,
      kind: 'continental-knockout',
      continentalCup: 'ucl',
      isDecisive: false,
      leg: 2,
      europeanRound: 'quarter-final',
      opponentId: 'bayern',
      opponentLabel: 'Bayern Munich',
      isHome: false,
    },
    { knockoutAggFor: 1, knockoutAggAgainst: 0 } as ReturnType<typeof hydrateSeason>['sim'],
  );
  if (
    qf2Brief.opponent !== 'Bayern Munich'
    || qf2Brief.venue !== 'Away'
    || !qf2Brief.competition.toLowerCase().includes('quarter-final')
    || qf2Brief.stake !== firstLegStakeLine(1, 0)
    || firstLegStakeLine(1, 0) !== '1–0 up from the first leg'
    || firstLegStakeLine(0, 1) !== '1–0 down from the first leg'
  ) {
    console.error('hub briefing must lead with opponent, venue, QF 2nd leg, and first-leg aggregate');
    process.exitCode = 1;
  }

  const madridKo = hydrateSeason({ seasonNumber: 2, club: madrid, careerGoalRatio: 0.8, nationId: 'spain' });
  const qf1 = madridKo.calendar.fixtures.find((f) => f.kind === 'continental-knockout' && f.europeanRound === 'quarter-final' && f.leg === 1);
  const qf2 = madridKo.calendar.fixtures.find((f) => f.kind === 'continental-knockout' && f.europeanRound === 'quarter-final' && f.leg === 2);
  if (!qf1 || !qf2 || !madridKo.sim.europeanStanding) {
    console.error('season 2 calendar must include a two-legged Champions League quarter-final');
    process.exitCode = 1;
  } else {
    const simBefore = {
      ...madridKo.sim,
      europeanStanding: { ...madridKo.sim.europeanStanding, stage: 'quarter-final' as const },
      knockoutAggFor: 0,
      knockoutAggAgainst: 0,
    };
    const leg1Fx = { ...qf1, opponentId: 'bayern', opponentLabel: 'Bayern Munich', isHome: true };
    const resolved = resolveFixture(simBefore, leg1Fx, madrid, 1, () => 0.2);
    const aggLine = resolved.aggregateLine ?? continentalAggregateLine(leg1Fx, simBefore, resolved.result);
    if (!aggLine || !aggLine.includes('Aggregate') || !aggLine.includes('second leg to come')) {
      console.error('after a continental first leg the recap must show aggregate and that the second leg is to come');
      process.exitCode = 1;
    }
    const nextLine = formatNextLine(
      { ...qf2, opponentId: 'bayern', opponentLabel: 'Bayern Munich', isHome: false },
      resolved.sim,
    );
    if (!nextLine.includes('Bayern Munich') || !nextLine.includes('2nd leg') || !(nextLine.includes('from the first leg') || nextLine.includes('after the first leg'))) {
      console.error('after a continental first leg, next must name the 2nd-leg opponent and the running score');
      process.exitCode = 1;
    }
    console.log('UCL briefing/recap', qf2Brief.stake, aggLine, nextLine);
  }

  let eliteBlowout = 0;
  for (let i = 0; i < 250; i++) {
    const result = simulateClubMatch(
      { clubStrength: city.strength, opponentStrength: madrid.strength, isHome: true },
      Math.random,
      3,
    );
    if (result.scoreFor < 3 || result.scoreFor > 4 || result.scoreAgainst > 3 || result.scoreFor + result.scoreAgainst > 6) {
      eliteBlowout += 1;
    }
  }
  console.log('elite City-Madrid blowouts', eliteBlowout);
  if (eliteBlowout > 0) {
    console.error('elite Champions League ties must stay low-scoring even after a hat-trick');
    process.exitCode = 1;
  }

  {
    const england = nationStrength('england');
    const australia = nationStrength('australia');
    let blowouts = 0;
    let maxMargin = 0;
    for (let i = 0; i < 400; i++) {
      const result = simulateClubMatch(
        { clubStrength: england, opponentStrength: australia, isHome: true, knockout: true },
        Math.random,
        0,
      );
      const margin = Math.abs(result.scoreFor - result.scoreAgainst);
      if (margin > maxMargin) maxMargin = margin;
      if (margin > 2 || result.scoreFor > 3 || result.scoreAgainst > 3) blowouts += 1;
    }
    let call = 0;
    const forcedLoss = simulateClubMatch(
      { clubStrength: england, opponentStrength: australia, isHome: false, knockout: true },
      () => {
        call += 1;
        return call === 1 ? 0.99 : 0.45;
      },
      0,
    );
    console.log('WC last-16 England vs Australia', { england, australia, blowouts, maxMargin, forcedLoss });
    if (blowouts > 0 || maxMargin > 2) {
      console.error('World Cup knockout scorelines cannot be 5–0 style blowouts');
      process.exitCode = 1;
    }
    if (forcedLoss.outcome !== 'loss' || Math.abs(forcedLoss.scoreFor - forcedLoss.scoreAgainst) > 2) {
      console.error('Australia can win a World Cup last 16, but only by a realistic score');
      process.exitCode = 1;
    }
  }

  const aggDraw = settleDrawOnPenalties({ scoreFor: 1, scoreAgainst: 1, outcome: 'draw' }, true, () => 0.1);
  if (!aggDraw.penalties || aggDraw.outcome !== 'win') {
    console.error('level continental ties must be settled on penalties');
    process.exitCode = 1;
  }

  const paced = simulateNpcRoundAfterPlayerMatch(
    applyPlayerGroupResult(
      createGroupState('Q', ['spain', 'scotland', 'norway', 'georgia', 'cyprus', 'israel'], 'qualifying'),
      'spain',
      'scotland',
      2,
      0,
      true,
    ),
    'spain',
    'scotland',
    'pace-test',
  );
  const playedCounts = paced.rows.map((row) => row.played);
  console.log('paced qualifying played', playedCounts);
  if (playedCounts.some((played) => played !== 1)) {
    console.error('other nations must stay on the same number of games as the player');
    process.exitCode = 1;
  }

  const s1 = hydrateSeason({
    seasonNumber: 1,
    club: madrid,
    careerGoalRatio: 0.8,
    nationId: 'spain',
    rng: () => 0.31,
  });
  const s1Ids = s1.calendar.fixtures
    .filter((f) => f.kind === 'international' && f.internationalRound === 'qualifier' && f.opponentId)
    .map((f) => f.opponentId as string);
  const s1Homes = s1.calendar.fixtures
    .filter((f) => f.kind === 'international' && f.internationalRound === 'qualifier')
    .map((f) => Boolean(f.isHome));
  const s2 = hydrateSeason({
    seasonNumber: 2,
    club: madrid,
    careerGoalRatio: 0.8,
    nationId: 'spain',
    qualifierCarry: {
      tournament: 'world-cup',
      points: 10,
      played: 5,
      opponentIds: s1Ids,
      group: s1.sim.internationalGroup ?? undefined,
    },
    rng: () => 0.77,
  });
  const s2Quals = s2.calendar.fixtures.filter((f) => f.kind === 'international' && f.internationalRound === 'qualifier');
  const s2Ids = s2Quals.map((f) => f.opponentId as string);
  const s2Homes = s2Quals.map((f) => Boolean(f.isHome));
  console.log('WC S1/S2 opponents', s1Ids, s2Ids, 'homes', s1Homes, s2Homes);
  if (s1Ids.length !== 5 || s2Ids.join() !== s1Ids.join()) {
    console.error('World Cup qualifying must reuse the same six-team group across both seasons');
    process.exitCode = 1;
  }
  if (s2Homes.some((home, i) => home === s1Homes[i])) {
    console.error('the second qualifying season must flip home and away against the same group');
    process.exitCode = 1;
  }
  if ((s2.sim.internationalGroup?.teamIds ?? []).sort().join() !== ['spain', ...s1Ids].sort().join()) {
    console.error('season 2 qualifying table must keep the same six nations');
    process.exitCode = 1;
  }

  const carriedGroup = applyPlayerGroupResult(
    createGroupState('Q', ['spain', ...s1Ids], 'qualifying'),
    'spain',
    s1Ids[0]!,
    1,
    2,
    true,
  );
  const s2Rising = hydrateSeason({
    seasonNumber: 2,
    club: getClub('arsenal') ?? madrid,
    careerGoalRatio: 0.48,
    nationId: 'spain',
    squadStatus: 'rising-star',
    careerStart: 'favourite-first-team',
    qualifierCarry: {
      tournament: 'world-cup',
      points: 4,
      played: 5,
      opponentIds: s1Ids,
      group: carriedGroup,
    },
    rng: () => 0.41,
  });
  const risingPlayed = s2Rising.sim.internationalGroup?.rows.reduce((sum, row) => sum + row.played, 0) ?? 0;
  console.log('S2 rising carry', s2Rising.sim.internationalSelected, risingPlayed, s2Rising.sim.qualifierCarryPlayed);
  if (risingPlayed < 2 || s2Rising.sim.qualifierCarryPlayed !== 5 || !s2Rising.sim.internationalGroup) {
    console.error('Season 2 must keep the previous qualifying table even as a Rising star');
    process.exitCode = 1;
  }

  const euroSeason = hydrateSeason({
    seasonNumber: 4,
    club: madrid,
    careerGoalRatio: 0.8,
    nationId: 'spain',
    careerStart: 'favourite-first-team',
    rng: () => 0.22,
  });
  const euroFriendlies = euroSeason.calendar.fixtures.filter(
    (f) => f.kind === 'international' && f.internationalRound === 'friendly' && f.opponentId,
  );
  const euroFriendlyConfeds = euroFriendlies.map((f) => getNation(f.opponentId!)?.confederation);
  console.log('Euro friendlies', euroFriendlies.map((f) => f.opponentLabel), euroFriendlyConfeds);
  if (euroFriendlies.length < 2 || euroFriendlyConfeds.some((confed) => confed !== 'UEFA')) {
    console.error('European Championship friendlies must only be against UEFA nations');
    process.exitCode = 1;
  }

  const africaSeason = hydrateSeason({
    seasonNumber: 4,
    club: madrid,
    careerGoalRatio: 0.8,
    nationId: 'nigeria',
    careerStart: 'favourite-first-team',
    rng: () => 0.22,
  });
  const africaFriendlies = africaSeason.calendar.fixtures.filter(
    (f) => f.kind === 'international' && f.internationalRound === 'friendly' && f.opponentId,
  );
  if (africaFriendlies.length < 2 || africaFriendlies.some((f) => getNation(f.opponentId!)?.confederation !== 'CAF')) {
    console.error('AFCON friendlies must only be against African nations');
    process.exitCode = 1;
  }

  const s1Npc = hydrateSeason({
    seasonNumber: 1,
    club: madrid,
    careerGoalRatio: 0.8,
    nationId: 'spain',
    careerStart: 'favourite-first-team',
    rng: () => 0.18,
  });
  let npcSim = s1Npc.sim;
  let npcPlayed = 0;
  for (const fixture of s1Npc.calendar.fixtures) {
    if (!shouldSimulateNationQualifier(fixture, npcSim)) continue;
    npcSim = resolveFixture(npcSim, fixture, madrid, 0, () => 0.3, { playerParticipated: false }).sim;
    npcPlayed += 1;
  }
  const spainRow = npcSim.internationalGroup?.rows.find((row) => row.nationId === 'spain');
  console.log('S1 NPC quals', npcPlayed, 'spain played', spainRow?.played, 'selected', s1Npc.sim.internationalSelected);
  if (s1Npc.sim.internationalSelected || npcPlayed !== 5 || (spainRow?.played ?? 0) < 5) {
    console.error('World Cup qualifying must run from Season 1 even when the player is not called up');
    process.exitCode = 1;
  }

  const wonPot = evaluateClubPlayerOfTheTournament({
    continentalChampion: 'ucl',
    continentalStats: [{ cup: 'ucl', games: 13, goals: 10 }],
  });
  const lostPot = evaluateClubPlayerOfTheTournament({
    continentalChampion: 'ucl',
    continentalStats: [{ cup: 'ucl', games: 13, goals: 4 }],
  });
  const noTitle = evaluateClubPlayerOfTheTournament({
    continentalChampion: null,
    continentalStats: [{ cup: 'ucl', games: 13, goals: 12 }],
  });
  if (!wonPot.won || lostPot.won || noTitle.won) {
    console.error('club Player of the Tournament requires winning the cup and a 0.7 goal ratio');
    process.exitCode = 1;
  }
  if (noTitle.reason) {
    console.error('club Player of the Tournament must not tell the player to win the tournament to be eligible');
    process.exitCode = 1;
  }

  const wpyMiss = evaluateWpy({
    seasonGoalRatio: 0.3,
    eliteRatioBar: 0.5,
    wonChampionsLeague: false,
    isInternationalTournamentYear: false,
    wonInternationalTournament: false,
    recentFormGoals: 10,
    recentFormGames: 20,
  });
  if (wpyMiss.won || wpyMiss.reason) {
    console.error('a WPY miss must only say the player did not win, with no ratio/trophy copy');
    process.exitCode = 1;
  }

  const saudiOnly = pickPermanentClubs(1, 260_000_000, ['man-city'], 'spain', false, 'Premier League', TRANSFER_MARKET_CAP + 1, 24);
  const saudiTooYoung = pickPermanentClubs(1, 260_000_000, ['man-city'], 'spain', false, 'Premier League', TRANSFER_MARKET_CAP + 1, 19);
  const saudiGiants = saudiOnly.filter((club) => (TWILIGHT_SAUDI_CLUB_IDS as readonly string[]).includes(club.id));
  const saudiEurope = saudiOnly.filter((club) => club.league !== 'Saudi Pro League' && club.country !== 'Saudi Arabia');
  if (saudiGiants.length !== 1 || saudiEurope.length < 2 || saudiEurope.some((club) => clubTransferBudget(club) < 260_000_000 * MIN_ACCEPTED_FEE_RATIO)) {
    console.error('players valued over €250m must only see clubs that can fund 80% of the fee, plus exactly one top Saudi offer');
    process.exitCode = 1;
  }
  if (saudiTooYoung.some((club) => (TWILIGHT_SAUDI_CLUB_IDS as readonly string[]).includes(club.id))) {
    console.error(`a player under ${SAUDI_OFFER_MIN_AGE} must not receive a Saudi offer even over €250m`);
    process.exitCode = 1;
  }

  const used = new Set<string>();
  const lateFa = [
    pickDomesticCupOpponent(city, 'quarter-final', used),
    pickDomesticCupOpponent(city, 'semi-final', used),
    pickDomesticCupOpponent(city, 'final', used),
  ];
  if (lateFa.some((club) => !club)) {
    console.error('FA Cup quarter-finals onward must still draw an opponent');
    process.exitCode = 1;
  }
  const foxes = getClub('leicester')!;
  const champUsed = new Set<string>();
  const lateChamp = [
    pickDomesticCupOpponent(foxes, 'quarter-final', champUsed),
    pickDomesticCupOpponent(foxes, 'semi-final', champUsed),
    pickDomesticCupOpponent(foxes, 'final', champUsed),
  ];
  if (lateChamp.some((club) => !club || club.league !== 'Premier League')) {
    console.error('Championship FA Cup quarter-finals onward must be Premier League clubs');
    process.exitCode = 1;
  }

  const superSeen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const opp = pickSuperCupOpponent(madrid, 'ucl', () => (i + 0.5) / 40, i === 0 ? undefined : 'atletico-madrid');
    if (opp) superSeen.add(opp.id);
  }
  console.log('super cup pool', [...superSeen]);
  if (superSeen.size < 2 || (superSeen.has('atletico-madrid') && superSeen.size === 1)) {
    console.error('UEFA Super Cup opponent must vary among the other cup\'s top sides');
    process.exitCode = 1;
  }

  if (sitOutGamesAfterPlayedMatch(1) !== 0 || sitOutGamesAfterPlayedMatch(2) !== 1) {
    console.error('a one-week injury after a played match must not sit the next knockout');
    process.exitCode = 1;
  }

  const dropPens = applyMatchResult(applyMatchResult(applyMatchResult(createAvailability(), false), false), false);
  if (dropPens.bannedGamesRemaining <= 0) {
    console.error('three open-play blanks must still drop the player');
    process.exitCode = 1;
  }
  const keptByOpenPlay = applyMatchResult(applyMatchResult(applyMatchResult(createAvailability(), false), false), true);
  if (keptByOpenPlay.bannedGamesRemaining !== 0 || keptByOpenPlay.windowFails !== 0) {
    console.error('an open-play goal must reset the drop window');
    process.exitCode = 1;
  }

  let trialPens = 0;
  for (let i = 0; i < 80; i++) {
    if (rollChanceSetup({ clubStrength: 90, allowPenalties: false, rng: () => i / 80 }).kind === 'penalty') trialPens += 1;
  }
  if (trialPens > 0) {
    console.error('trial matches must not roll penalty chances');
    process.exitCode = 1;
  }

  const r16Stage = { ...s2.sim, europeanStanding: { cup: 'ucl' as const, stage: 'round-of-16' as const } };
  if (qf.some((f) => !shouldSkipFixture(f, r16Stage))) {
    console.error('quarter-final fixtures must wait until the last 16 is finished');
    process.exitCode = 1;
  }
}

console.log('\n--- Career beats, chance cards, Europe tables, neutral boards ---');
{
  if (firstCapBeat('Spain').kind !== 'first-cap' || !firstTitleBeat('La Liga').headline.includes('La Liga')) {
    console.error('career beats must keep a headline and a kind');
    process.exitCode = 1;
  }
  if (portraitForTrophyName('La Liga') !== 'club' || portraitForTrophyName('World Cup') !== 'nation') {
    console.error('title portraits must be club for leagues and nation for international tournaments');
    process.exitCode = 1;
  }
  if (firstTitleBeat('European Championship').portrait !== 'nation' || titleBeat('Premier League').kind !== 'title') {
    console.error('a national title must show the nation kit; later league wins must be repeatable');
    process.exitCode = 1;
  }
  const once = pushCareerBeat([], ['first-title'], firstTitleBeat('La Liga'));
  if (once.length !== 0) {
    console.error('first-title must not fire twice');
    process.exitCode = 1;
  }
  const laterLeague = enqueueLeagueTitleBeat(
    [],
    ['first-title'],
    { leagueChampion: true, domesticCup: null, domesticSuperCup: null, superCup: false, continentalChampion: null, internationalChampion: null },
    getClub('real-madrid')!,
    'La Liga',
    [{ trophies: ['La Liga'] }],
  );
  if (laterLeague.length !== 1 || laterLeague[0].kind !== 'title' || laterLeague[0].portrait !== 'club') {
    console.error('winning the league again must show a club-kit title beat');
    process.exitCode = 1;
  }
  const sold = pushCareerBeat([], [], soldBeat('Real Madrid'));
  const soldAgain = pushCareerBeat(sold, [], soldBeat('Bayern Munich'));
  if (soldAgain.length !== 2) {
    console.error('being sold can happen more than once');
    process.exitCode = 1;
  }
  if (retirementBeat('Alex', 'Inter Miami').eyebrow !== 'Season 20') {
    console.error('retirement must stamp Season 20');
    process.exitCode = 1;
  }
  if (chanceMinute(2, 4, 'final') !== 88 || formatChanceMinute(85) !== '85th minute') {
    console.error('chance minutes must land in the late game');
    process.exitCode = 1;
  }
  const threeLeague = chanceMinutesForMatch(3, 'league');
  if (threeLeague.length !== 3 || threeLeague[0]! >= threeLeague[1]! || threeLeague[1]! >= threeLeague[2]!) {
    console.error('match minutes must rise in order, never 90 then 90+30 then 78');
    process.exitCode = 1;
  }
  if (chanceMinute(0, 1, 'final') === 90 || formatChanceMinute(120) !== 'Penalties') {
    console.error('a lone open-play chance must not jump to the 90th, and 120 is a shootout');
    process.exitCode = 1;
  }
  if (chancesLeftLine(2) !== '2 chances left') {
    console.error('remaining chances must be spelled out');
    process.exitCode = 1;
  }
  if (chanceImportanceLine(1, 3, 2, true) !== 'Need a goal to stay in the tie') {
    console.error('in-game copy must not reveal how many chances are left');
    process.exitCode = 1;
  }
  const awards = seasonAwardBeats({
    seasonNumber: 2,
    clubId: 'real-madrid',
    role: 'first-team',
    matches: [],
    goals: 24,
    gamesPlayed: 38,
    ratioMet: true,
    age: 18,
    leagueGoals: 24,
    trophies: [],
    topGoalscorer: true,
    playerOfTheYear: false,
    wonWpy: true,
    topGoalscorerReason: 'Won the La Liga golden boot with 24 league goals.',
  }, 'Alex Rivera');
  if (awards.length !== 2 || awards.some((beat) => beat.kind !== 'award')) {
    console.error('each individual award must get its own end-of-season screen');
    process.exitCode = 1;
  }
  if (awardBeat('World Cup top goalscorer', 'Alex').portrait !== 'nation') {
    console.error('international awards must use the nation kit');
    process.exitCode = 1;
  }
  const mixedClub = clubSeasonTotals({
    seasonNumber: 2,
    clubId: 'psg',
    role: 'first-team',
    matches: [],
    goals: 31,
    gamesPlayed: 45,
    ratioMet: true,
    age: 18,
    leagueGoals: 18,
    leagueGames: 30,
    cupGoals: 2,
    cupGames: 4,
    continentalStats: [],
    trophies: [],
    topGoalscorer: false,
    playerOfTheYear: false,
    wonWpy: false,
    international: {
      tournament: 'world-cup',
      qualifyingGames: 0,
      qualifyingGoals: 0,
      qualifyingOutcome: 'qualified',
      finalsGames: 7,
      finalsGoals: 11,
      tournamentOutcome: 'champion',
      playerOfTheTournament: false,
      topGoalscorer: false,
    },
  });
  if (mixedClub.goals !== 20 || mixedClub.games !== 34) {
    console.error(`club totals must ignore national-team goals, got ${mixedClub.goals}/${mixedClub.games}`);
    process.exitCode = 1;
  }
  const madridClub = getClub('real-madrid')!;
  const { calendar, sim } = hydrateSeason({
    seasonNumber: 2,
    club: madridClub,
    careerGoalRatio: 0.8,
    nationId: 'spain',
  });
  const groupFx = calendar.fixtures.find((f) => f.kind === 'continental-group' && f.opponentId);
  if (!groupFx || !sim.europeanTable.length) {
    console.error('a European season must start with a continental table');
    process.exitCode = 1;
  } else {
    const resolved = resolveFixture(sim, groupFx, madridClub, 1, () => 0.4);
    const played = resolved.sim.europeanTable.filter((row) => row.played > 0).length;
    const us = resolved.sim.europeanTable.find((row) => row.clubId === madridClub.id);
    console.log('european table after group night', played, us?.points, us?.played);
    if (played < 4 || !us || us.played < 1) {
      console.error('a Champions League group night must move the European table');
      process.exitCode = 1;
    }
  }
  const wcQf = calendar.fixtures.find((f) => f.kind === 'international' && f.internationalRound === 'quarter-final')
    ?? {
      ...calendar.fixtures[0]!,
      kind: 'international' as const,
      internationalRound: 'quarter-final' as const,
      neutral: true,
      isHome: false,
    };
  if (!scoreboardPlayerOnLeft(wcQf) || formatHomeAwayScore(2, 2, scoreboardPlayerOnLeft(wcQf)) !== '2\u20132') {
    console.error('neutral venues must put the player on the left of the board');
    process.exitCode = 1;
  }
  const awayLeague = calendar.fixtures.find((f) => f.kind === 'league' && f.isHome === false);
  if (awayLeague && scoreboardPlayerOnLeft(awayLeague)) {
    console.error('real away games must keep the home side on the left');
    process.exitCode = 1;
  }
}
