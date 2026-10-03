import { createAvailability } from './availabilityEngine';
import { fixtureIsNight } from './calendar';
import { getClub } from './data/clubs';
import { createNationalTeamState, recordInternationalAppearance } from './international';
import { mlsConferenceOf } from './data/leagueFormat';
import { applyMatchToTable, buildSeasonStandings, rankLeagueTable } from './matchEngine';
import { awardBeat, debutBeat, firstCapBeat, firstTitleBeat, recordBeat, retirementBeat, signedClubBeat, soldBeat, titleBeat, tournamentCallUpBeat, valueMilestoneBeat } from './careerBeat';
import { newContractYears, playerMarketValueFromSeasons, weeklyWageForClub } from './playerValue';
import { applyTrialMatch, applyYouthMatch, assignOpeningTrialClub, beginClubTrial, beginFavouriteClubTrial, chooseTrialClub, createYouthCampaign, failClubTrial } from './openingFlow';
import { hydrateSeason, nextActionableFixture } from './seasonSim';
import { CURRENT_RULES_STAMP } from './rulesStamp';
import { formatNextLine } from './matchBriefing';
import { useCareerStore } from './store';
import { resolveSeasonTransition, trialFailTransferPending, type PendingTransfer } from './transfers';
import type { OpeningCampaign, SeasonRecord } from './types';
import { applyPlayerGroupResult, createGroupState, simulateNpcRoundAfterPlayerMatch } from './internationalTable';

function season(partial: SeasonRecord): SeasonRecord {
  return partial;
}

/** DEV-only layout preview: three finished seasons plus a live hub season. */
export function applyCareerLayoutPreview(): void {
  const history: SeasonRecord[] = [
    season({
      seasonNumber: 1,
      clubId: 'real-madrid',
      role: 'reserve',
      matches: [],
      goals: 20,
      gamesPlayed: 24,
      ratioMet: true,
      age: 16,
      leagueGoals: 20,
      leagueGames: 24,
      cupGames: 0,
      cupGoals: 0,
      domesticGames: 24,
      domesticGoals: 20,
      continentalStats: [],
      trophies: [],
      topGoalscorer: true,
      playerOfTheYear: false,
      wonWpy: false,
      earnings: 0,
    }),
    season({
      seasonNumber: 2,
      clubId: 'real-madrid',
      role: 'first-team',
      matches: [],
      goals: 30,
      gamesPlayed: 55,
      ratioMet: true,
      age: 17,
      leagueGoals: 24,
      leagueGames: 38,
      cupGames: 4,
      cupGoals: 2,
      domesticGames: 42,
      domesticGoals: 26,
      continentalStats: [{ cup: 'ucl', games: 13, goals: 4 }],
      trophies: ['Spanish League', 'Spanish Cup', 'European Cup'],
      topGoalscorer: true,
      playerOfTheYear: true,
      clubPlayerOfTheTournament: false,
      clubPlayerOfTheTournamentReason: 'Won the European Cup but scored 0.31 goals per game in it.',
      wonWpy: true,
      wpyReason: 'Elite goal ratio plus winning the European Cup.',
      earnings: 7_280_000,
      sponsorship: 8_800_000,
      league: 'La Liga',
      international: {
        tournament: 'world-cup',
        qualifyingGames: 5,
        qualifyingGoals: 4,
        qualifyingOutcome: 'qualified',
        finalsGames: 7,
        finalsGoals: 6,
        tournamentOutcome: 'champion',
        playerOfTheTournament: true,
        topGoalscorer: true,
      },
    }),
    season({
      seasonNumber: 3,
      clubId: 'real-madrid',
      role: 'first-team',
      matches: [],
      goals: 26,
      gamesPlayed: 51,
      ratioMet: true,
      age: 18,
      leagueGoals: 20,
      leagueGames: 36,
      cupGames: 4,
      cupGoals: 2,
      domesticGames: 40,
      domesticGoals: 22,
      continentalStats: [{ cup: 'super-cup', games: 1, goals: 1 }, { cup: 'ucl', games: 10, goals: 3 }],
      trophies: ['Spanish League', 'European Super Cup'],
      topGoalscorer: true,
      playerOfTheYear: false,
      wonWpy: false,
      earnings: 7_280_000,
      sponsorship: 8_400_000,
      league: 'La Liga',
      international: {
        tournament: 'euro',
        qualifyingGames: 5,
        qualifyingGoals: 3,
        qualifyingOutcome: 'none',
        finalsGames: 0,
        finalsGoals: 0,
        tournamentOutcome: 'none',
        playerOfTheTournament: false,
        topGoalscorer: false,
      },
    }),
    season({
      seasonNumber: 6,
      clubId: 'leicester',
      role: 'first-team',
      matches: [],
      goals: 21,
      gamesPlayed: 48,
      ratioMet: true,
      age: 21,
      leagueGoals: 20,
      leagueGames: 46,
      cupGames: 2,
      cupGoals: 1,
      domesticGames: 48,
      domesticGoals: 21,
      continentalStats: [],
      trophies: ['English Championship'],
      topGoalscorer: true,
      playerOfTheYear: true,
      wonWpy: false,
      earnings: 1_200_000,
      sponsorship: 0,
      league: 'Championship',
      transferFeePaid: 18_000_000,
      transferFromClubId: 'real-madrid',
    }),
    season({
      seasonNumber: 7,
      clubId: 'leicester',
      role: 'first-team',
      matches: [],
      goals: 15,
      gamesPlayed: 40,
      ratioMet: true,
      age: 22,
      leagueGoals: 14,
      leagueGames: 38,
      cupGames: 2,
      cupGoals: 1,
      domesticGames: 40,
      domesticGoals: 15,
      continentalStats: [],
      trophies: [],
      topGoalscorer: false,
      playerOfTheYear: false,
      wonWpy: false,
      earnings: 2_400_000,
      sponsorship: 0,
      league: 'Premier League',
    }),
    season({
      seasonNumber: 12,
      clubId: 'inter-miami',
      role: 'first-team',
      matches: [],
      goals: 17,
      gamesPlayed: 36,
      ratioMet: true,
      age: 27,
      leagueGoals: 16,
      leagueGames: 34,
      cupGames: 2,
      cupGoals: 1,
      domesticGames: 36,
      domesticGoals: 17,
      continentalStats: [],
      trophies: ['American League Cup'],
      topGoalscorer: false,
      playerOfTheYear: false,
      wonWpy: false,
      earnings: 4_200_000,
      sponsorship: 1_600_000,
      league: 'MLS',
    }),
    season({
      seasonNumber: 21,
      clubId: 'inter-miami',
      role: 'first-team',
      matches: [],
      goals: 8,
      gamesPlayed: 30,
      ratioMet: true,
      age: 36,
      leagueGoals: 8,
      leagueGames: 28,
      cupGames: 2,
      cupGoals: 0,
      domesticGames: 30,
      domesticGoals: 8,
      continentalStats: [],
      trophies: [],
      topGoalscorer: false,
      playerOfTheYear: false,
      wonWpy: false,
      earnings: 2_100_000,
      sponsorship: 280_000,
      league: 'MLS',
    }),
  ];

  const preview = new URLSearchParams(window.location.search).get('preview-career');
  const previewClubId =
    preview === 'mls' ? 'lafc'
    : preview === 'flamengo' ? 'flamengo-rj'
    : preview === 'argentina' ? 'river-plate'
    : preview === 'liga-mx' ? 'club-america'
    : preview === 'saudi' ? 'al-hilal'
    : preview === 'match-psg' ? 'psg'
    : preview === 'match-dortmund' ? 'dortmund'
    : preview === 'match-roma' ? 'roma'
    : preview === 'match-psv' ? 'psv'
    : preview === 'match-liverpool' ? 'liverpool'
    : preview === 'benfica' || preview === 'rebuild' || preview === 'match-benfica' ? 'benfica'
    : preview === 'ajax' || preview === 'match-ajax' ? 'ajax'
    : preview === 'galatasaray' || preview === 'match-galatasaray' ? 'galatasaray'
    : preview === 's1-summary' || preview === 'opening-role' ? 'man-city'
    : preview === 'rising-loans' || preview === 'rising-loans-s2' ? 'arsenal'
    : 'real-madrid';
  const club = getClub(previewClubId);
  if (!club) return;
  const previewNationId =
    preview === 'mls' ? 'united-states'
    : preview === 'flamengo' ? 'brazil'
    : preview === 'argentina' ? 'argentina'
    : preview === 'liga-mx' ? 'mexico'
    : preview === 'saudi' ? 'saudi-arabia'
    : preview === 'match-psg' ? 'france'
    : preview === 'match-dortmund' ? 'germany'
    : preview === 'match-roma' ? 'italy'
    : preview === 'match-psv' ? 'netherlands'
    : preview === 'match-liverpool' ? 'england'
    : preview === 'benfica' || preview === 'rebuild' || preview === 'match-benfica' ? 'portugal'
    : preview === 'ajax' || preview === 'match-ajax' ? 'netherlands'
    : preview === 'galatasaray' || preview === 'match-galatasaray' ? 'turkey'
    : preview === 's1-summary' ? 'england'
    : preview === 'rising-loans' || preview === 'rising-loans-s2' ? 'england'
    : preview === 'copa-final' ? 'brazil'
    : 'spain';
  const { calendar, sim } = hydrateSeason({
    seasonNumber: preview === 'hub-qualifying' || preview === 'hub-rising-star' || preview === 'hub-rotation' || preview === 's1-summary' ? 1 : preview === 'flamengo' || preview === 'argentina' || preview === 'liga-mx' ? 2 : 4,
    club,
    careerGoalRatio: 0.78,
    nationId: previewNationId,
    careerStart: preview === 'hub-qualifying' || preview === 'hub-rising-star' || preview === 'hub-rotation' || preview === 's1-summary' ? 'favourite-first-team' : undefined,
  });
  if (sim.europeanStanding && sim.europeanTable.length > 1) {
    const playerId = club.id;
    const oppId = sim.europeanTable.find((row) => row.clubId !== playerId)?.clubId;
    if (oppId) {
      let table = applyMatchToTable(sim.europeanTable, playerId, oppId, { scoreFor: 2, scoreAgainst: 1, outcome: 'win' });
      for (let i = 2; i + 1 < Math.min(10, table.length); i += 2) {
        const a = table[i]?.clubId;
        const b = table[i + 1]?.clubId;
        if (!a || !b || a === playerId || b === playerId) continue;
        table = applyMatchToTable(table, a, b, { scoreFor: 1, scoreAgainst: 1, outcome: 'draw' });
      }
      sim.europeanTable = rankLeagueTable(table);
      sim.europeanGroupPlayed = 1;
      sim.europeanGroupPoints = 3;
    }
  }
  if (preview === 'mls') {
    sim.leagueTable = rankLeagueTable(
      sim.leagueTable.map((row, i) => {
        if (row.clubId === 'lafc') {
          return { ...row, played: 18, won: 10, drawn: 4, lost: 4, goalsFor: 32, goalsAgainst: 16, points: 34 };
        }
        const west = mlsConferenceOf(row.clubId) === 'west';
        const pts = west ? Math.max(8, 30 - i) : Math.max(22, 50 - i);
        return { ...row, played: 18, won: 6, drawn: 4, lost: 8, goalsFor: 22, goalsAgainst: 20, points: pts };
      }),
    );
    sim.leaguesCupStage = 'quarter-final';
    sim.domesticCup = 'us-open-cup';
    sim.domesticCupStage = 'semi-final';
  }
  if (preview === 'flamengo' || preview === 'argentina') {
    const playerId = preview === 'flamengo' ? 'flamengo-rj' : 'river-plate';
    sim.leagueTable = rankLeagueTable(
      sim.leagueTable.map((row, i) => {
        const played = preview === 'flamengo' ? 28 : 10;
        const won = Math.max(0, (preview === 'flamengo' ? 18 : 7) - Math.floor(i / 2));
        const drawn = preview === 'flamengo' ? 6 : 1;
        const lost = Math.max(0, played - won - drawn);
        const points = won * 3 + drawn;
        return {
          ...row,
          played,
          won,
          drawn,
          lost,
          goalsFor: Math.max(8, 40 - i),
          goalsAgainst: Math.max(6, 10 + i),
          points: row.clubId === playerId ? (preview === 'flamengo' ? 60 : 13) : Math.max(6, points),
        };
      }),
    );
  }
  const reserveSeason = preview === 'reserve'
    ? hydrateSeason({
        seasonNumber: 1,
        club,
        careerGoalRatio: 0,
        nationId: 'spain',
        leagueOnly: true,
      })
    : null;

  const isTrialPreview = preview === 'trial' || preview === 'trial-england' || preview === 'trial-ireland' || preview === 'trial-argentina';
  const isYouthPreview = preview === 'youth';
  const isYouthNextPreview = preview === 'youth-next';
  const isClubTrialPreview = preview === 'club-trial';
  const isTrialRetryPreview = preview === 'trial-retry';
  const isTrialOffersPreview = preview === 'trial-offers';
  const isReserveLoansPreview = preview === 'reserve-loans';
  const openingNationId = preview === 'trial-england'
    ? 'england'
    : preview === 'trial-ireland'
      ? 'republic-of-ireland'
      : preview === 'trial-argentina'
        ? 'argentina'
      : preview === 'mls'
        ? 'united-states'
        : preview === 'saudi'
          ? 'saudi-arabia'
          : 'spain';
  let openingCampaign: OpeningCampaign | null = null;
  if (isYouthPreview || isYouthNextPreview || isTrialPreview || isClubTrialPreview || preview === 'club-offer') {
    const youth = createYouthCampaign(openingNationId, () => 0.31);
    const scored = preview === 'trial-england'
      ? {
          ...youth,
          goals: 3,
          youthGoals: 3,
          gamesPlayed: 4,
          qualified: true,
          eliminated: true,
          trialTier: 5 as const,
          trialClubId: 'luton',
          trialClubIds: [] as string[],
        }
      : preview === 'trial-ireland'
        ? { ...youth, goals: 7, youthGoals: 7, gamesPlayed: 7, qualified: true, eliminated: true }
        : preview === 'trial-argentina'
          ? { ...youth, goals: 1, youthGoals: 1, gamesPlayed: 7, qualified: true, eliminated: true }
        : { ...youth, goals: 6, youthGoals: 6, gamesPlayed: 7, qualified: true };
    if (isYouthPreview) openingCampaign = youth;
    else if (isYouthNextPreview) {
      const first = youth.calendar.fixtures[0];
      openingCampaign = first
        ? applyYouthMatch(youth, first, { outcome: 'win', scoreFor: 2, scoreAgainst: 0 }, 1, openingNationId, () => 0.31)
        : youth;
    }
    else if (isTrialPreview) openingCampaign = assignOpeningTrialClub(scored, openingNationId);
    else openingCampaign = beginClubTrial(scored, openingNationId, 2);
  } else if (isTrialRetryPreview || isTrialOffersPreview || preview === 'trial-drop') {
    const madrid = getClub('real-madrid');
    if (madrid) {
      let look = beginFavouriteClubTrial(madrid);
      const failBlank = () => {
        if (!look.trialClubId) {
          const nextId = (look.trialClubIds ?? []).find((id) => !look.rejectedClubIds.includes(id));
          if (nextId) look = chooseTrialClub(look, nextId);
        }
        look = applyTrialMatch(look, 0);
        look = applyTrialMatch(look, 0);
        look = applyTrialMatch(look, 0);
        const result = failClubTrial(look, 'spain');
        look = result.opening;
        return result;
      };
      const first = failBlank();
      if (isTrialRetryPreview || first.exhausted) {
        openingCampaign = first.opening;
      } else if (preview === 'trial-drop') {
        failBlank();
        openingCampaign = failBlank().opening;
      } else {
        for (let i = 0; i < 5; i++) failBlank();
        openingCampaign = look;
      }
    }
  }
  const isReservePreview = preview === 'reserve';
  const isMatchPreview = preview === 'match' || preview === 'match-away' || preview === 'match-local'
    || preview === 'match-night'
    || preview === 'match-intl' || preview === 'match-ucl' || preview === 'match-intl-ko'
    || preview === 'match-africa' || preview === 'match-overcast'
    || preview === 'match-sweden' || preview === 'match-poland' || preview === 'match-brazil'
    || preview === 'match-colombia' || preview === 'match-peru' || preview === 'match-paraguay'
    || preview === 'match-psg' || preview === 'match-city'
    || preview === 'match-dortmund' || preview === 'match-roma' || preview === 'match-psv' || preview === 'match-liverpool'
    || preview === 'match-benfica' || preview === 'match-ajax' || preview === 'match-galatasaray'
    || preview === 'kit-ajax' || preview === 'kit-psg' || preview === 'kit-monaco'
    || preview === 'kit-galaxy' || preview === 'kit-river' || preview === 'kit-boca'
    || preview === 'kit-santos' || preview === 'kit-espanyol'
    || preview === 'kit-sao-paulo' || preview === 'kit-gremio' || preview === 'kit-vasco'
    || preview === 'match-norway' || preview === 'match-usa'
    || preview === 'cup-pens';
  let matchFixtureIndex = Math.max(0, calendar.fixtures.findIndex((f) => f.kind !== 'rest'));
  if (preview === 'match' || preview === 'match-away' || preview === 'match-local' || preview === 'match-night') {
    const wantHome = preview !== 'match-away';
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'league' && f.isHome === wantHome);
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'league';
      fx.opponentId = preview === 'match-local' ? 'getafe' : 'barcelona';
      fx.opponentLabel = preview === 'match-local' ? 'Getafe' : 'Barcelona';
      fx.isHome = wantHome;
      fx.playerChances = 2;
      if (preview === 'match-night') {
        for (let week = 1; week <= 40; week++) {
          fx.week = week;
          if (fixtureIsNight(fx)) break;
        }
      } else {
        for (let week = 1; week <= 40; week++) {
          fx.week = week;
          if (!fixtureIsNight(fx)) break;
        }
      }
    }
  } else if (preview === 'match-intl') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'international');
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'international';
      fx.internationalRound = 'group';
      fx.opponentId = 'italy';
      fx.opponentLabel = 'Italy';
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (preview === 'match-ucl') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'continental-group' || f.kind === 'continental-knockout');
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'continental-knockout';
      fx.leg = 1;
      fx.opponentId = 'bayern';
      fx.opponentLabel = 'Munich';
      fx.isHome = true;
      fx.playerChances = 2;
      fx.continentalCup = 'ucl';
    }
  } else if (preview === 'hub-intl') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'international' && f.internationalRound !== 'qualifier');
    if (idx >= 0) {
      const fx = calendar.fixtures[idx];
      fx.kind = 'international';
      fx.internationalRound = 'group';
      fx.opponentId = 'germany';
      fx.opponentLabel = 'Germany';
      sim.fixtureIndex = idx;
    }
    calendar.internationalTournament = 'world-cup';
    sim.internationalTournament = 'world-cup';
    sim.internationalStage = 'group';
    sim.internationalSelected = true;
    sim.internationalGroup = createGroupState('B', ['spain', 'germany', 'brazil', 'serbia']);
  } else if (preview === 'copa-final') {
    const finalIdx = calendar.fixtures.findIndex((f) => f.kind === 'international' && f.internationalRound === 'final');
    if (finalIdx >= 0) sim.fixtureIndex = finalIdx;
    calendar.internationalTournament = 'copa-america';
    sim.internationalTournament = 'copa-america';
    sim.internationalSelected = true;
    sim.internationalStage = 'final';
    sim.internationalReached = 'semi-final';
    sim.nationId = 'brazil';
  } else if (preview === 'hub-qualifying') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'international');
    if (idx >= 0) sim.fixtureIndex = idx;
    calendar.internationalTournament = 'world-cup';
    sim.internationalTournament = 'world-cup';
    sim.internationalPhase = 'qualifiers';
    sim.internationalStage = 'qualifying';
    sim.internationalSelected = true;
    sim.qualifierPlayed = 2;
    sim.qualifierTarget = 5;
    sim.qualifierPoints = 4;
    sim.internationalGroup = applyPlayerGroupResult(
      applyPlayerGroupResult(
        createGroupState('Q', ['spain', 'scotland', 'norway', 'georgia', 'cyprus', 'israel'], 'qualifying'),
        'spain',
        'scotland',
        2,
        1,
        true,
      ),
      'spain',
      'norway',
      1,
      1,
      false,
    );
    sim.internationalGroup = simulateNpcRoundAfterPlayerMatch(
      simulateNpcRoundAfterPlayerMatch(
        sim.internationalGroup,
        'spain',
        'scotland',
        'preview-qualifying-1',
      ),
      'spain',
      'norway',
      'preview-qualifying-2',
    );
  } else if (preview === 'hub-ucl-leg2') {
    const idx = calendar.fixtures.findIndex(
      (f) => f.kind === 'continental-knockout' && f.europeanRound === 'quarter-final' && f.leg === 2,
    );
    if (idx >= 0) {
      const fx = calendar.fixtures[idx];
      fx.opponentId = 'bayern';
      fx.opponentLabel = 'Munich';
      fx.isHome = false;
      fx.continentalCup = 'ucl';
      fx.playerChances = 2;
      sim.fixtureIndex = idx;
    }
    if (sim.europeanStanding) sim.europeanStanding.stage = 'quarter-final';
    sim.knockoutAggFor = 1;
    sim.knockoutAggAgainst = 0;
  } else if (preview === 'match-intl-ko') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'international');
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'international';
      fx.internationalRound = 'quarter-final';
      fx.opponentId = 'france';
      fx.opponentLabel = 'France';
      fx.isHome = true;
      fx.playerChances = 2;
      fx.neutral = true;
    }
  } else if (preview === 'match-africa') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'international');
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'international';
      fx.internationalRound = 'group';
      fx.week = 4;
      fx.opponentId = 'senegal';
      fx.opponentLabel = 'Senegal';
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (preview === 'match-sweden' || preview === 'match-poland' || preview === 'match-brazil' || preview === 'match-colombia' || preview === 'match-peru' || preview === 'match-paraguay' || preview === 'match-norway' || preview === 'match-usa') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'international');
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    const opp = preview === 'match-sweden'
      ? { id: 'sweden', label: 'Sweden' }
      : preview === 'match-poland'
        ? { id: 'poland', label: 'Poland' }
        : preview === 'match-colombia'
          ? { id: 'colombia', label: 'Colombia' }
          : preview === 'match-peru'
            ? { id: 'peru', label: 'Peru' }
            : preview === 'match-paraguay'
              ? { id: 'paraguay', label: 'Paraguay' }
            : preview === 'match-norway'
              ? { id: 'norway', label: 'Norway' }
            : preview === 'match-usa'
              ? { id: 'united-states', label: 'United States' }
            : { id: 'brazil', label: 'Brazil' };
    if (fx) {
      fx.kind = 'international';
      fx.internationalRound = 'group';
      fx.week = 4;
      fx.opponentId = opp.id;
      fx.opponentLabel = opp.label;
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (preview === 'match-city') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'league' && f.isHome);
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'league';
      fx.opponentId = 'man-city';
      fx.opponentLabel = 'Manchester Civic';
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (preview === 'hub-rotation') {
    let completed = 0;
    for (let i = 0; i < calendar.fixtures.length; i++) {
      if (calendar.fixtures[i].kind === 'rest') continue;
      if (completed % 3 !== 0) {
        sim.fixtureIndex = i;
        break;
      }
      completed += 1;
    }
  } else if (preview === 'hub-rising-star') {
    let completed = 0;
    for (let i = 0; i < calendar.fixtures.length; i++) {
      if (calendar.fixtures[i].kind === 'rest') continue;
      if (completed % 4 === 3) {
        sim.fixtureIndex = i;
        break;
      }
      completed += 1;
    }
    if (sim.europeanStanding) sim.europeanStanding.stage = 'group';
    sim.domesticCupStage = 'round-of-16';
    sim.internationalTournament = 'euro';
    sim.internationalSelected = true;
    sim.internationalStage = 'group';
  } else if (preview === 'hub') {
    if (sim.europeanStanding) sim.europeanStanding.stage = 'group';
    sim.domesticCupStage = 'round-of-16';
    sim.internationalTournament = 'euro';
    sim.internationalSelected = true;
    sim.internationalStage = 'group';
    sim.leagueTable = rankLeagueTable(
      sim.leagueTable.map((row, i) => {
        if (row.clubId === 'real-madrid') {
          return { ...row, played: 16, won: 12, drawn: 3, lost: 1, goalsFor: 38, goalsAgainst: 12, points: 39 };
        }
        if (row.clubId === 'barcelona') {
          return { ...row, played: 16, won: 11, drawn: 3, lost: 2, goalsFor: 34, goalsAgainst: 14, points: 36 };
        }
        if (row.clubId === 'atletico-madrid') {
          return { ...row, played: 16, won: 10, drawn: 4, lost: 2, goalsFor: 28, goalsAgainst: 13, points: 34 };
        }
        return { ...row, played: 16, won: 7, drawn: 4, lost: 5, goalsFor: 22, goalsAgainst: 18, points: Math.max(8, 32 - i) };
      }),
    );
  } else if (preview === 's1-summary') {
    sim.leagueTable = rankLeagueTable(
      sim.leagueTable.map((row, i) => {
        if (row.clubId === 'man-city') {
          return { ...row, played: 19, won: 12, drawn: 4, lost: 3, goalsFor: 42, goalsAgainst: 18, points: 40 };
        }
        return { ...row, played: 19, won: 8, drawn: 4, lost: 7, goalsFor: 24, goalsAgainst: 22, points: Math.max(6, 48 - i * 2) };
      }),
    );
    sim.domesticCup = 'fa-cup';
    sim.domesticCupStage = 'quarter-final';
    if (sim.europeanStanding) sim.europeanStanding.stage = 'group';
    sim.internationalTournament = 'world-cup';
    sim.internationalStage = 'group';
    sim.internationalSelected = true;
    sim.internationalReached = 'group';
  } else if (preview === 'hub-sitout') {
    const cupIdx = calendar.fixtures.findIndex((f) => f.kind === 'domestic-cup');
    if (cupIdx >= 0) {
      calendar.fixtures[cupIdx].playerChances = 0;
      sim.fixtureIndex = cupIdx;
    }
  } else if (preview === 'cup-pens') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'domestic-cup' && f.domesticCupStage === 'final');
    if (idx >= 0) {
      matchFixtureIndex = idx;
      const fx = calendar.fixtures[idx];
      fx.playerChances = 1;
    }
  } else if (preview === 'match-psg') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'league' && f.isHome);
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'league';
      fx.opponentId = 'marseille';
      fx.opponentLabel = 'Marseille';
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (preview === 'match-dortmund') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'league' && f.isHome);
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'league';
      fx.opponentId = 'bayern';
      fx.opponentLabel = 'Munich';
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (preview === 'match-roma') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'league' && f.isHome);
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'league';
      fx.opponentId = 'lazio';
      fx.opponentLabel = 'Lazio';
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (preview === 'match-psv') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'league' && f.isHome);
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'league';
      fx.opponentId = 'ajax';
      fx.opponentLabel = 'Amsterdam';
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (preview === 'match-liverpool') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'league' && f.isHome);
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'league';
      fx.opponentId = 'man-city';
      fx.opponentLabel = 'Manchester Civic';
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (preview === 'match-benfica') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'league' && f.isHome);
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'league';
      fx.opponentId = 'porto';
      fx.opponentLabel = 'FC Porto';
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (preview === 'match-ajax') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'league' && f.isHome);
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'league';
      fx.opponentId = 'feyenoord';
      fx.opponentLabel = 'Feyenoord';
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (preview === 'match-galatasaray') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'league' && f.isHome);
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'league';
      fx.opponentId = 'fenerbahce';
      fx.opponentLabel = 'Fenerbahçe';
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (
    preview === 'kit-ajax' || preview === 'kit-psg' || preview === 'kit-monaco'
    || preview === 'kit-galaxy' || preview === 'kit-river' || preview === 'kit-boca'
    || preview === 'kit-santos' || preview === 'kit-espanyol'
    || preview === 'kit-sao-paulo' || preview === 'kit-gremio' || preview === 'kit-vasco'
  ) {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'league' && f.isHome);
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    const opp =
      preview === 'kit-ajax' ? { id: 'ajax', label: 'Amsterdam' }
      : preview === 'kit-psg' ? { id: 'psg', label: 'Paris' }
      : preview === 'kit-monaco' ? { id: 'monaco', label: 'Monaco' }
      : preview === 'kit-galaxy' ? { id: 'la-galaxy', label: 'Los Angeles' }
      : preview === 'kit-river' ? { id: 'river-plate', label: 'Buenos Aires Red' }
      : preview === 'kit-boca' ? { id: 'boca-juniors', label: 'Buenos Aires Blue' }
      : preview === 'kit-santos' ? { id: 'santos', label: 'Santos' }
      : preview === 'kit-sao-paulo' ? { id: 'sao-paulo', label: 'Sao Paulo' }
      : preview === 'kit-gremio' ? { id: 'gremio', label: 'Gremio' }
      : preview === 'kit-vasco' ? { id: 'vasco', label: 'Vasco da Gama' }
      : { id: 'espanyol', label: 'Espanyol' };
    if (fx) {
      fx.kind = 'league';
      fx.opponentId = opp.id;
      fx.opponentLabel = opp.label;
      fx.isHome = true;
      fx.playerChances = 2;
    }
  } else if (preview === 'match-overcast') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'league' && f.isHome);
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    if (fx) {
      fx.kind = 'league';
      fx.opponentId = 'getafe';
      fx.opponentLabel = 'Getafe';
      fx.isHome = true;
      fx.playerChances = 2;
      for (let week = 7; week <= 32; week++) {
        fx.week = week;
        if (!fixtureIsNight(fx)) break;
      }
    }
  }

  const value = playerMarketValueFromSeasons({
    age: 19,
    careerGoals: 61,
    careerGames: 114,
    seasons: [
      ...history,
      season({
        seasonNumber: 4,
        clubId: 'real-madrid',
        role: 'first-team',
        matches: [],
        goals: 3,
        gamesPlayed: 38,
        ratioMet: false,
        age: 19,
        leagueGoals: 3,
        leagueGames: 28,
        cupGames: 2,
        cupGoals: 0,
        domesticGames: 30,
        domesticGoals: 3,
        continentalStats: [{ cup: 'ucl', games: 8, goals: 0 }],
        trophies: [],
        topGoalscorer: false,
        playerOfTheYear: false,
        wonWpy: false,
      }),
    ],
    fallbackClub: club,
  });
  const reservePromoSeason = season({
    seasonNumber: 1,
    clubId: 'real-madrid',
    role: 'reserve',
    matches: [],
    goals: 30,
    gamesPlayed: 38,
    ratioMet: true,
    age: 16,
    leagueGoals: 30,
    trophies: [],
    topGoalscorer: false,
    playerOfTheYear: false,
    wonWpy: false,
  });
  const reservePromo = preview === 'reserve-promo'
    ? resolveSeasonTransition({
        season: reservePromoSeason,
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
      })
    : null;
  const renewalPreview = preview === 'renew'
    ? resolveSeasonTransition({
        season: season({
          seasonNumber: 2,
          clubId: 'real-madrid',
          role: 'first-team',
          matches: [],
          goals: 30,
          gamesPlayed: 38,
          ratioMet: true,
          age: 17,
          leagueGoals: 24,
          trophies: [],
          topGoalscorer: false,
          playerOfTheYear: false,
          wonWpy: false,
        }),
        role: 'first-team',
        clubId: 'real-madrid',
        parentClubId: 'real-madrid',
        seasonsAtCurrentClub: 1,
        age: 17,
        careerGoals: 30,
        careerGames: 38,
        nationality: 'spain',
        loansUsed: 0,
        contractYearsRemaining: 2,
      })
    : null;
  const champSeasons = [2, 3, 4].map((n) =>
    season({
      seasonNumber: n,
      clubId: 'leicester',
      role: 'first-team',
      matches: [],
      goals: 24,
      gamesPlayed: 46,
      ratioMet: true,
      age: 17 + n,
      leagueGoals: 24,
      leagueGames: 46,
      cupGames: 0,
      cupGoals: 0,
      domesticGames: 46,
      domesticGoals: 24,
        trophies: n === 4 ? ['English Championship'] : [],
      topGoalscorer: n === 4,
      playerOfTheYear: false,
      wonWpy: false,
      league: 'Championship',
    }),
  );
  const champTransferPreview =
    preview === 'championship-transfer'
      ? resolveSeasonTransition({
          season: champSeasons[2],
          role: 'first-team',
          clubId: 'leicester',
          parentClubId: 'leicester',
          seasonsAtCurrentClub: 3,
          age: 20,
          careerGoals: 72,
          careerGames: 138,
          nationality: 'england',
          loansUsed: 0,
          seasonHistory: champSeasons.slice(0, 2),
          contractYearsRemaining: 3,
          clubLeague: 'Championship',
        })
      : null;
  const oxfordFreePreview =
    preview === 'oxford-free'
      ? resolveSeasonTransition({
          season: season({
            seasonNumber: 3,
            clubId: 'oxford',
            role: 'first-team',
            matches: [],
            goals: 18,
            gamesPlayed: 36,
            ratioMet: true,
            age: 20,
            leagueGoals: 18,
            trophies: [],
            topGoalscorer: false,
            playerOfTheYear: false,
            wonWpy: false,
            league: 'Championship',
          }),
          role: 'first-team',
          clubId: 'oxford',
          parentClubId: 'oxford',
          seasonsAtCurrentClub: 2,
          age: 20,
          careerGoals: 48,
          careerGames: 90,
          nationality: 'england',
          loansUsed: 0,
          contractYearsRemaining: 0,
          clubLeague: 'Championship',
          squadStatus: 'starter',
        })
      : null;
  const palaceHotPreview =
    preview === 'palace-hot'
      ? resolveSeasonTransition({
          season: season({
            seasonNumber: 12,
            clubId: 'crystal-palace',
            role: 'first-team',
            matches: [],
            goals: 26,
            gamesPlayed: 32,
            ratioMet: true,
            age: 28,
            leagueGoals: 26,
            trophies: [],
            topGoalscorer: false,
            playerOfTheYear: false,
            wonWpy: false,
            league: 'Premier League',
          }),
          role: 'first-team',
          clubId: 'crystal-palace',
          parentClubId: 'crystal-palace',
          seasonsAtCurrentClub: 1,
          age: 28,
          careerGoals: 237,
          careerGames: 447,
          nationality: 'england',
          loansUsed: 0,
          contractYearsRemaining: 0,
          clubLeague: 'Premier League',
          squadStatus: 'starter',
        })
      : null;
  const burnleyS1Preview =
    preview === 'burnley-s1'
      ? resolveSeasonTransition({
          season: season({
            seasonNumber: 1,
            clubId: 'burnley',
            role: 'first-team',
            matches: [],
            goals: 8,
            gamesPlayed: 13,
            ratioMet: true,
            age: 17,
            leagueGoals: 8,
            trophies: [],
            topGoalscorer: false,
            playerOfTheYear: false,
            wonWpy: false,
            league: 'Premier League',
            squadStatus: 'impact',
          }),
          role: 'first-team',
          clubId: 'burnley',
          parentClubId: 'burnley',
          seasonsAtCurrentClub: 0,
          age: 17,
          careerGoals: 8,
          careerGames: 13,
          nationality: 'england',
          loansUsed: 0,
          contractYearsRemaining: 3,
          careerStart: 'favourite-first-team',
          squadStatus: 'impact',
          clubLeague: 'Premier League',
        })
      : null;
  const reserveLoansPreview =
    preview === 'reserve-loans'
      ? resolveSeasonTransition({
          season: season({
            seasonNumber: 1,
            clubId: 'real-madrid',
            role: 'reserve',
            matches: [],
            goals: 2,
            gamesPlayed: 38,
            ratioMet: false,
            age: 16,
            leagueGoals: 2,
            trophies: [],
            topGoalscorer: false,
            playerOfTheYear: false,
            wonWpy: false,
          }),
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
        })
      : null;
  const firstTeamMissPreview =
    preview === 'first-team-miss' || preview === 'transfer-20'
      ? resolveSeasonTransition({
          season: season({
            seasonNumber: 1,
            clubId: 'real-madrid',
            role: 'first-team',
            matches: [],
            goals: 8,
            gamesPlayed: 38,
            ratioMet: false,
            age: preview === 'transfer-20' ? 20 : 17,
            leagueGoals: 8,
            trophies: [],
            topGoalscorer: false,
            playerOfTheYear: false,
            wonWpy: false,
          }),
          role: 'first-team',
          clubId: 'real-madrid',
          parentClubId: 'real-madrid',
          seasonsAtCurrentClub: preview === 'transfer-20' ? 1 : 0,
          age: preview === 'transfer-20' ? 20 : 17,
          careerGoals: 8,
          careerGames: 38,
          nationality: 'spain',
          loansUsed: 0,
          contractYearsRemaining: 2,
          careerStart: 'favourite-first-team',
        })
      : null;
  const risingLoanSeason = season({
    seasonNumber: preview === 'rising-loans-s2' ? 2 : 1,
    clubId: 'arsenal',
    role: 'first-team',
    matches: [],
    goals: 10,
    gamesPlayed: 28,
    ratioMet: false,
    age: preview === 'rising-loans-s2' ? 18 : 17,
    leagueGoals: 10,
    trophies: [],
    topGoalscorer: false,
    playerOfTheYear: false,
    wonWpy: false,
    league: 'Premier League',
  });
  const risingLoanHistory = preview === 'rising-loans-s2'
    ? [season({
        seasonNumber: 1,
        clubId: 'arsenal',
        role: 'first-team',
        matches: [],
        goals: 10,
        gamesPlayed: 28,
        ratioMet: false,
        age: 17,
        leagueGoals: 10,
        trophies: [],
        topGoalscorer: false,
        playerOfTheYear: false,
        wonWpy: false,
        league: 'Premier League',
      })]
    : [];
  const risingLoansPreview =
    preview === 'rising-loans' || preview === 'rising-loans-s2'
      ? resolveSeasonTransition({
          season: risingLoanSeason,
          role: 'first-team',
          clubId: 'arsenal',
          parentClubId: 'arsenal',
          seasonsAtCurrentClub: preview === 'rising-loans-s2' ? 1 : 0,
          age: preview === 'rising-loans-s2' ? 18 : 17,
          careerGoals: preview === 'rising-loans-s2' ? 20 : 10,
          careerGames: preview === 'rising-loans-s2' ? 56 : 28,
          nationality: 'england',
          loansUsed: 0,
          contractYearsRemaining: preview === 'rising-loans-s2' ? 4 : 5,
          careerStart: 'favourite-first-team',
          squadStatus: 'rising-star',
          weeklyWage: 140_000,
          clubLeague: 'Premier League',
          seasonHistory: risingLoanHistory,
        })
      : null;
  const trialOffersPreview =
    preview === 'trial-offers' && openingCampaign
      ? trialFailTransferPending({
          bestRatio: openingCampaign.bestTrialRatio ?? 0,
          nationality: 'spain',
          excludeIds: openingCampaign.rejectedClubIds,
          homeCountry: openingCampaign.originCountry ?? 'Spain',
          minFromCountry: 4,
        })
      : null;
  const pendingTransfer: PendingTransfer | null =
    preview === 'renew'
      ? renewalPreview?.pendingTransfer ?? null
      : preview === 'reserve-promo'
      ? reservePromo?.pendingTransfer ?? null
      : preview === 'championship-transfer'
      ? champTransferPreview?.pendingTransfer ?? null
      : preview === 'oxford-free'
      ? oxfordFreePreview?.pendingTransfer ?? null
      : preview === 'palace-hot'
      ? palaceHotPreview?.pendingTransfer ?? null
      : preview === 'burnley-s1'
      ? burnleyS1Preview?.pendingTransfer ?? null
      : preview === 'trial-offers'
      ? trialOffersPreview
      : isReserveLoansPreview
      ? reserveLoansPreview?.pendingTransfer ?? null
      : preview === 'first-team-miss' || preview === 'transfer-20'
      ? firstTeamMissPreview?.pendingTransfer ?? null
      : preview === 'rising-loans' || preview === 'rising-loans-s2'
      ? risingLoansPreview?.pendingTransfer ?? null
      : preview === 'expired'
      ? {
          kind: 'end-of-season',
          detail: 'Out of contract: more clubs can bid because there is no fee.',
          clubIds: ['real-madrid', 'man-city', 'psg', 'bayern', 'arsenal', 'chelsea'],
          offers: ['real-madrid', 'man-city', 'psg', 'bayern', 'arsenal', 'chelsea'].map((clubId) => ({
            clubId,
            move: 'permanent' as const,
            fee: 0,
            weeklyWage: weeklyWageForClub(getClub(clubId)!, value),
            contractYears: newContractYears(19),
          })),
          allowDecline: true,
        }
      : preview === 'transfer-reject'
      ? {
          kind: 'end-of-season',
          detail: 'These clubs can pay the transfer fee. You can stay where you are.',
          clubIds: ['bayern', 'arsenal', 'chelsea', 'getafe'],
          offers: [
            { clubId: 'bayern', move: 'permanent', fee: 80_000_000, weeklyWage: weeklyWageForClub(getClub('bayern')!, value), contractYears: newContractYears(19) },
            { clubId: 'arsenal', move: 'permanent', fee: 80_000_000, weeklyWage: weeklyWageForClub(getClub('arsenal')!, value), contractYears: newContractYears(19) },
            { clubId: 'chelsea', move: 'permanent', fee: 80_000_000, weeklyWage: weeklyWageForClub(getClub('chelsea')!, value), contractYears: newContractYears(19) },
            { clubId: 'getafe', move: 'permanent', fee: 45_000_000, weeklyWage: weeklyWageForClub(getClub('getafe')!, value), contractYears: newContractYears(19) },
          ],
          allowDecline: true,
          stay: {
            clubId: 'real-madrid',
            parentClubId: 'real-madrid',
            role: 'first-team',
            seasonsAtCurrentClub: 4,
            contractYearsRemaining: 4,
            clubLeague: 'La Liga',
            squadStatus: 'starter',
          },
          rejectionDetail: 'You agreed terms with Manchester Civic. Madrid rejected the €80m bid — they will not sell a starter to Manchester Civic on that fee.',
        }
      : preview === 'transfer'
      ? {
          kind: 'loan-or-transfer',
          detail: 'Loan wages follow your value. Permanent fees follow the contract, not your market value.',
          clubIds: ['dortmund', 'real-sociedad', 'sevilla', 'getafe', 'osasuna', 'mainz', 'psg', 'real-madrid', 'man-city', 'bayern', 'arsenal', 'chelsea'],
          offers: [
            { clubId: 'dortmund', move: 'loan', fee: 0, weeklyWage: weeklyWageForClub(getClub('dortmund')!, value), contractYears: 1 },
            { clubId: 'real-sociedad', move: 'loan', fee: 0, weeklyWage: weeklyWageForClub(getClub('real-sociedad')!, value), contractYears: 1 },
            { clubId: 'sevilla', move: 'loan', fee: 0, weeklyWage: weeklyWageForClub(getClub('sevilla')!, value), contractYears: 1 },
            { clubId: 'getafe', move: 'loan', fee: 0, weeklyWage: weeklyWageForClub(getClub('getafe')!, value), contractYears: 1 },
            { clubId: 'osasuna', move: 'loan', fee: 0, weeklyWage: weeklyWageForClub(getClub('osasuna')!, value), contractYears: 1 },
            { clubId: 'mainz', move: 'loan', fee: 0, weeklyWage: weeklyWageForClub(getClub('mainz')!, value), contractYears: 1 },
            { clubId: 'psg', move: 'permanent', fee: Math.max(value, 200_000_000), weeklyWage: weeklyWageForClub(getClub('psg')!, value), contractYears: newContractYears(19) },
            { clubId: 'real-madrid', move: 'permanent', fee: Math.max(value, 200_000_000), weeklyWage: weeklyWageForClub(getClub('real-madrid')!, value), contractYears: newContractYears(19) },
            { clubId: 'man-city', move: 'permanent', fee: Math.max(value, 200_000_000), weeklyWage: weeklyWageForClub(getClub('man-city')!, value), contractYears: newContractYears(19) },
            { clubId: 'bayern', move: 'permanent', fee: 80_000_000, weeklyWage: weeklyWageForClub(getClub('bayern')!, value), contractYears: newContractYears(19) },
            { clubId: 'arsenal', move: 'permanent', fee: 80_000_000, weeklyWage: weeklyWageForClub(getClub('arsenal')!, value), contractYears: newContractYears(19) },
            { clubId: 'chelsea', move: 'permanent', fee: 80_000_000, weeklyWage: weeklyWageForClub(getClub('chelsea')!, value), contractYears: newContractYears(19) },
          ],
          allowDecline: false,
        }
      : null;

  const promoteSummary = preview === 'summary';
  const leicester = getClub('leicester');
  const leicesterTable = leicester
    ? [{
        clubId: 'leicester',
        played: 46,
        won: 30,
        drawn: 8,
        lost: 8,
        goalsFor: 88,
        goalsAgainst: 36,
        points: 98,
        position: 1,
      }]
    : sim.leagueTable;

  let nationalTeam = createNationalTeamState('spain');
  nationalTeam = recordInternationalAppearance(nationalTeam, 'world-cup', true, 1);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'world-cup', true, 0);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'world-cup', false, 2);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'euro', true, 1);
  nationalTeam = recordInternationalAppearance(nationalTeam, 'euro', false, 0);

  if (preview === 'rebuild') {
    const idx = calendar.fixtures.findIndex((f) => f.week >= 12);
    if (idx >= 0) sim.fixtureIndex = idx;
  }

  const recapCalendar = isReservePreview ? reserveSeason?.calendar ?? calendar : calendar;
  const recapSim = isReservePreview ? reserveSeason?.sim ?? sim : sim;
  const recapNextFixture = recapCalendar ? nextActionableFixture(recapCalendar, recapSim) : undefined;
  const recapNationName =
    preview === 'mls' ? 'United States'
    : preview === 'saudi' ? 'Saudi Arabia'
    : preview === 'benfica' || preview === 'rebuild' || preview === 'match-benfica' ? 'Portugal'
    : preview === 'ajax' || preview === 'match-ajax' ? 'Netherlands'
    : preview === 'galatasaray' || preview === 'match-galatasaray' ? 'Turkey'
    : 'Spain';
  const computedNextLine = recapNextFixture
    ? formatNextLine(recapNextFixture, recapSim, {
        playerNationName: recapNationName,
        tournament: recapSim.internationalTournament ?? recapCalendar.internationalTournament,
      })
    : null;

  useCareerStore.setState({
    phase:
      isTrialPreview || isTrialRetryPreview || isTrialOffersPreview || preview === 'trial-drop'
        ? 'opening-brief'
        : isYouthPreview || isClubTrialPreview
          ? 'match'
        : isYouthNextPreview
          ? 'hub'
        : preview === 'record' || preview === 'record-club'
        ? 'career'
        : preview === 'profile'
        ? 'profile'
        : preview === 'tables'
        ? 'tables'
        : preview === 'player-name'
        ? 'player-name'
        : preview === 'opening-role'
        ? 'opening-role'
        : preview === 'season-paywall'
        ? 'season-paywall'
        : preview === 'legacy'
        ? 'legacy'
        : preview === 'club-choice'
        ? 'club-choice'
        : preview === 'transfer' || preview === 'expired' || preview === 'renew' || preview === 'championship-transfer' || preview === 'oxford-free' || preview === 'palace-hot' || preview === 'burnley-s1' || isReserveLoansPreview || preview === 'first-team-miss' || preview === 'transfer-20' || preview === 'transfer-reject' || preview === 'rising-loans' || preview === 'rising-loans-s2'
          ? 'transfer-choice'
          : preview === 'reserve-promo' || preview === 'loan-summary' || preview === 's1-summary'
          ? 'season-summary'
          : preview === 'club-offer'
            ? 'club-offer'
          : preview === 'result' || preview === 'result-pens'
            ? 'match-result'
            : preview === 'end'
              ? 'career-end'
              : preview === 'summary'
                ? 'season-summary'
                : preview === 'guide'
                  ? 'match'
                : isMatchPreview || isReservePreview
                  ? 'match'
                  : 'hub',
    age: isTrialPreview || isYouthPreview || isYouthNextPreview || isClubTrialPreview || isReservePreview || preview === 'reserve-promo' ? 16 : preview === 'end' ? 36 : preview === 'palace-hot' ? 28 : preview === 'championship-transfer' || preview === 'oxford-free' || preview === 'transfer-20' ? 20 : preview === 'rising-loans-s2' ? 18 : preview === 'rising-loans' || preview === 'first-team-miss' || preview === 's1-summary' || preview === 'hub-rising-star' || preview === 'hub-rotation' || preview === 'hub-qualifying' || preview === 'burnley-s1' ? 17 : promoteSummary ? 22 : 19,
    seasonNumber: isTrialPreview || isYouthPreview || isYouthNextPreview || isClubTrialPreview || isReservePreview || preview === 'hub-qualifying' || preview === 'hub-rising-star' || preview === 'hub-rotation' || preview === 'reserve-promo' || preview === 's1-summary' || preview === 'rising-loans' || preview === 'burnley-s1' ? 1 : preview === 'rising-loans-s2' || preview === 'flamengo' || preview === 'argentina' || preview === 'liga-mx' ? 2 : preview === 'oxford-free' ? 3 : preview === 'palace-hot' ? 12 : preview === 'end' ? 21 : promoteSummary ? 6 : 4,
    clubId: isYouthPreview || isYouthNextPreview || isTrialPreview ? null : isClubTrialPreview ? openingCampaign?.trialClubId ?? null : preview === 'end' ? 'inter-miami' : preview === 'mls' ? 'lafc' : preview === 'flamengo' ? 'flamengo-rj' : preview === 'argentina' ? 'river-plate' : preview === 'liga-mx' ? 'club-america' : preview === 'saudi' ? 'al-hilal' : preview === 'match-psg' ? 'psg' : preview === 'match-dortmund' ? 'dortmund' : preview === 'match-roma' ? 'roma' : preview === 'match-psv' ? 'psv' : preview === 'match-liverpool' ? 'liverpool' : preview === 'benfica' || preview === 'rebuild' || preview === 'match-benfica' ? 'benfica' : preview === 'ajax' || preview === 'match-ajax' ? 'ajax' : preview === 'galatasaray' || preview === 'match-galatasaray' ? 'galatasaray' : preview === 'championship-transfer' || promoteSummary ? 'leicester' : preview === 'oxford-free' ? 'oxford' : preview === 'palace-hot' ? 'crystal-palace' : preview === 'burnley-s1' ? 'burnley' : preview === 'loan-summary' ? 'levante' : preview === 's1-summary' || preview === 'opening-role' ? 'man-city' : preview === 'rising-loans' || preview === 'rising-loans-s2' ? 'arsenal' : preview === 'beat-sold-free' ? 'cremonese' : 'real-madrid',
    parentClubId: isYouthPreview || isYouthNextPreview || isTrialPreview ? null : isClubTrialPreview ? openingCampaign?.trialClubId ?? null : preview === 'end' ? 'inter-miami' : preview === 'mls' ? 'lafc' : preview === 'flamengo' ? 'flamengo-rj' : preview === 'argentina' ? 'river-plate' : preview === 'liga-mx' ? 'club-america' : preview === 'saudi' ? 'al-hilal' : preview === 'match-psg' ? 'psg' : preview === 'match-dortmund' ? 'dortmund' : preview === 'match-roma' ? 'roma' : preview === 'match-psv' ? 'psv' : preview === 'match-liverpool' ? 'liverpool' : preview === 'benfica' || preview === 'rebuild' || preview === 'match-benfica' ? 'benfica' : preview === 'ajax' || preview === 'match-ajax' ? 'ajax' : preview === 'galatasaray' || preview === 'match-galatasaray' ? 'galatasaray' : preview === 'championship-transfer' || promoteSummary ? 'leicester' : preview === 'oxford-free' ? 'oxford' : preview === 'palace-hot' ? 'crystal-palace' : preview === 'burnley-s1' ? 'burnley' : preview === 's1-summary' ? 'man-city' : preview === 'rising-loans' || preview === 'rising-loans-s2' ? 'arsenal' : preview === 'beat-sold-free' ? 'inter' : 'real-madrid',
    role: isReservePreview || isTrialPreview || isYouthPreview || isYouthNextPreview || isClubTrialPreview || preview === 'reserve-promo' ? 'reserve' : preview === 'loan-summary' || preview === 'beat-sold-free' ? 'loan' : 'first-team',
    trial: preview === 'club-offer'
      ? { shots: [], goals: 6, offeredClubIds: ['real-madrid', 'barcelona', 'atletico-madrid'] }
      : null,
    openingCampaign,
    careerStart: isTrialRetryPreview || isTrialOffersPreview || preview === 'trial-drop' || preview === 'club-choice' ? 'favourite-trial' : isYouthPreview || isYouthNextPreview || isTrialPreview || isClubTrialPreview ? 'youth' : preview === 'hub-rising-star' || preview === 'hub-qualifying' || preview === 's1-summary' ? 'favourite-first-team' : 'favourite-first-team',
    seasonsAtCurrentClub: preview === 'end' ? 10 : preview === 's1-summary' ? 0 : promoteSummary ? 1 : 3,
    nationality: preview === 'trial-ireland'
      ? 'republic-of-ireland'
      : preview === 'trial-england' || preview === 'mls'
        ? (preview === 'trial-england' ? 'england' : 'united-states')
        : preview === 'trial-argentina' || preview === 'argentina'
          ? 'argentina'
        : preview === 'flamengo'
          ? 'brazil'
        : preview === 'liga-mx'
          ? 'mexico'
        : preview === 'saudi'
          ? 'saudi-arabia'
          : preview === 'championship-transfer' || preview === 's1-summary' || preview === 'rising-loans' || preview === 'rising-loans-s2'
            ? 'england'
            : preview === 'benfica' || preview === 'rebuild' || preview === 'match-benfica'
              ? 'portugal'
              : preview === 'ajax' || preview === 'match-ajax'
                ? 'netherlands'
                : preview === 'galatasaray' || preview === 'match-galatasaray'
                  ? 'turkey'
                  : preview === 'match-dortmund'
                    ? 'germany'
                    : preview === 'match-roma'
                      ? 'italy'
                      : preview === 'match-psv'
                        ? 'netherlands'
                        : preview === 'match-liverpool'
                          ? 'england'
                  : preview === 'copa-final'
                    ? 'brazil'
                    : 'spain',
    playerName: preview === 'player-name' ? null : 'Alex Rivera',
    playerSkin: '#e8b88a',
    playerHair: '#2c1810',
    nationalTeam,
    availability: preview === 'hub-ucl-leg2' || preview === 'hub-rotation'
      ? { phase: 0, windowFails: 2, bannedGamesRemaining: 0 }
      : createAvailability(),
    seasonHistory: preview === 'championship-transfer' ? champSeasons.slice(0, 2) : preview === 'record-club' ? [season({
      seasonNumber: 12,
      clubId: 'crystal-palace',
      role: 'first-team',
      matches: [],
      goals: 237,
      gamesPlayed: 447,
      ratioMet: true,
      age: 28,
      leagueGoals: 233,
      leagueGames: 348,
      cupGames: 12,
      cupGoals: 4,
      domesticGames: 360,
      domesticGoals: 237,
      continentalStats: [],
      trophies: [],
      topGoalscorer: false,
      playerOfTheYear: false,
      wonWpy: false,
      league: 'Premier League',
      international: {
        tournament: 'euro',
        qualifyingGames: 12,
        qualifyingGoals: 0,
        qualifyingOutcome: 'qualified',
        finalsGames: 7,
        finalsGoals: 0,
        tournamentOutcome: 'quarter-final',
        playerOfTheTournament: false,
        topGoalscorer: false,
      },
    })] : preview === 'rising-loans' || preview === 'rising-loans-s2' ? risingLoanHistory : preview === 's1-summary' || preview === 'hub-rising-star' || preview === 'hub-rotation' || preview === 'hub-qualifying' ? [] : history,
    careerGoals: preview === 'end' ? 312 : preview === 'championship-transfer' ? 72 : preview === 's1-summary' || preview === 'rising-loans' ? 10 : preview === 'rising-loans-s2' ? 20 : preview === 'hub-rising-star' ? 2 : preview === 'hub-rotation' ? 1 : 58,
    careerGames: preview === 'end' ? 540 : preview === 'championship-transfer' ? 138 : preview === 's1-summary' ? 19 : preview === 'rising-loans' ? 28 : preview === 'rising-loans-s2' ? 56 : preview === 'hub-rising-star' ? 3 : preview === 'hub-rotation' ? 2 : 76,
    seasonCalendar: isReservePreview
      ? reserveSeason?.calendar ?? null
      : isTrialPreview || isYouthPreview || isYouthNextPreview || isClubTrialPreview
        ? openingCampaign?.calendar ?? null
        : calendar,
    liveMatch: isReservePreview
      ? {
          fixtureIndex: 0,
          chancesTotal: reserveSeason?.calendar.fixtures[0]?.playerChances ?? 2,
          chancesTaken: 0,
          goals: 0,
        }
      : isYouthPreview || isClubTrialPreview
      ? {
          fixtureIndex: 0,
          chancesTotal: openingCampaign?.calendar.fixtures[0]?.playerChances ?? (isClubTrialPreview ? 4 : 1),
          chancesTaken: 0,
          goals: 0,
        }
      : isMatchPreview || preview === 'guide'
      ? preview === 'cup-pens'
        ? {
            fixtureIndex: matchFixtureIndex,
            chancesTotal: 1,
            chancesTaken: 0,
            goals: 0,
            penaltyKick: true,
            goalsAtNinety: 0,
            ninetyScoreFor: 1,
            ninetyScoreAgainst: 1,
          }
        : {
            fixtureIndex: matchFixtureIndex,
            chancesTotal: 2,
            chancesTaken: preview === 'match-intl-ko' ? 1 : 0,
            goals: preview === 'match-intl-ko' ? 1 : 0,
          }
      : null,
    seasonSim: isYouthPreview || isYouthNextPreview || isClubTrialPreview || isTrialPreview
      ? null
      : isReservePreview
      ? reserveSeason?.sim ?? sim
      : promoteSummary
      ? { ...sim, leagueTable: leicesterTable, honours: { ...sim.honours, leagueChampion: true } }
      : sim,
    seasonStandings: buildSeasonStandings(promoteSummary ? leicesterTable : sim.leagueTable, promoteSummary ? null : sim.europeanStanding),
    currentSeason:
      isYouthPreview || isYouthNextPreview || isTrialPreview || isClubTrialPreview || preview === 'record-club'
        ? null
      : preview === 'end'
        ? history[history.length - 1]
        : preview === 'reserve-promo'
          ? reservePromoSeason
        : preview === 'hub-rising-star' || preview === 'hub-rotation'
          ? season({
              seasonNumber: 1,
              clubId: 'real-madrid',
              role: 'first-team',
              squadStatus: preview === 'hub-rising-star' ? 'rising-star' : 'reserve',
              matches: preview === 'hub-rising-star'
                ? [
                    { matchNumber: 1, played: true, scored: false, chances: 1 },
                    { matchNumber: 2, played: true, scored: true, chances: 1 },
                    { matchNumber: 3, played: true, scored: true, chances: 1 },
                  ]
                : [
                    { matchNumber: 1, played: true, scored: false, chances: 1 },
                    { matchNumber: 2, played: true, scored: false, chances: 1 },
                  ],
              goals: preview === 'hub-rising-star' ? 2 : 1,
              gamesPlayed: preview === 'hub-rising-star' ? 3 : 2,
              ratioMet: null,
              age: 17,
              leagueGoals: preview === 'hub-rising-star' ? 2 : 1,
              trophies: [],
              topGoalscorer: false,
              playerOfTheYear: false,
              wonWpy: false,
            })
        : preview === 'rising-loans' || preview === 'rising-loans-s2'
          ? risingLoanSeason
        : preview === 's1-summary'
          ? season({
              seasonNumber: 1,
              clubId: 'man-city',
              role: 'first-team',
              squadStatus: 'rising-star',
              matches: [],
              goals: 10,
              gamesPlayed: 19,
              ratioMet: false,
              age: 17,
              leagueGoals: 8,
              leagueGames: 16,
              cupGames: 3,
              cupGoals: 2,
              domesticGames: 19,
              domesticGoals: 10,
              trophies: [],
              topGoalscorer: false,
              playerOfTheYear: false,
              wonWpy: false,
              earnings: 1_800_000,
              league: 'Premier League',
              international: {
                tournament: 'world-cup',
                qualifyingGames: 0,
                qualifyingGoals: 0,
                qualifyingOutcome: 'none',
                finalsGames: 3,
                finalsGoals: 1,
                tournamentOutcome: 'group',
                playerOfTheTournament: false,
                topGoalscorer: false,
              },
            })
        : promoteSummary
          ? season({
              seasonNumber: 6,
              clubId: 'leicester',
              role: 'first-team',
              squadStatus: 'starter',
              matches: [],
              goals: 33,
              gamesPlayed: 48,
              ratioMet: true,
              age: 22,
              leagueGoals: 32,
              leagueGames: 46,
              cupGames: 2,
              cupGoals: 1,
              domesticGames: 48,
              domesticGoals: 21,
              continentalStats: [],
              trophies: ['English Championship'],
              topGoalscorer: false,
              playerOfTheYear: true,
              clubPlayerOfTheTournament: false,
              clubPlayerOfTheTournamentReason: '',
              topGoalscorerReason: '32 league goals in Championship, but another striker took the golden boot.',
              playerOfTheYearReason: 'Won Championship Player of the Year with 32 league goals.',
              wonWpy: false,
              earnings: 1_200_000,
              sponsorship: 0,
              league: 'Championship',
            })
        : season({
            seasonNumber: 4,
            clubId: preview === 'mls' ? 'lafc' : preview === 'saudi' ? 'al-hilal' : 'real-madrid',
            role: 'first-team',
            matches: [
              { matchNumber: 1, played: true, scored: true },
              { matchNumber: 2, played: true, scored: false },
            ],
            goals: 2,
            gamesPlayed: 2,
            ratioMet: null,
            age: 19,
            leagueGoals: 1,
            leagueGames: 1,
            cupGames: 1,
            cupGoals: 1,
            domesticGames: 2,
            domesticGoals: 2,
            continentalStats: [],
            trophies: [],
            topGoalscorer: false,
            playerOfTheYear: false,
            wonWpy: false,
            sponsorship: 9_300_000,
            earnings: 9_580_000,
            league: preview === 'mls' ? 'MLS' : preview === 'saudi' ? 'Saudi Pro League' : 'La Liga',
            international: {
              tournament: preview === 'mls' ? 'gold-cup' : preview === 'saudi' ? 'asian-cup' : 'euro',
              qualifyingGames: 5,
              qualifyingGoals: 2,
              qualifyingOutcome: 'qualified',
              finalsGames: 1,
              finalsGoals: 1,
              tournamentOutcome: 'group',
              playerOfTheTournament: false,
              topGoalscorer: false,
            },
          }),
    lastMatchSummary: preview === 'hub-rotation' || preview === 's1-summary'
      ? null
      : preview === 'copa-final'
      ? 'Brazil won 1–0 vs Paraguay · through to the final · 0 goals from 1 chance'
      : preview === 'hub-sitout'
      ? 'Andorra lost 0–2 vs Denmark · out of the tournament'
      : isYouthNextPreview
      ? 'Spain won 2–0 · 1 goal from 1 chance'
      : preview === 'hub-ucl-leg2'
      ? 'Won 1–0 vs Munich · 1 goal from 2 chances · Aggregate 1–0 · second leg to come · Next: Munich · Away · European Cup quarter-final 2nd leg · 1–0 up from the first leg'
      : preview === 'result-pens'
      ? 'Spain drew 1–1 vs France (won 5–4 on penalties) · through to the quarter-finals · 1 goal from 2 chances'
      : 'Spain won 2–0 vs Italy · 2 goals from 2 chances',
    lastMatchResult: isYouthNextPreview || preview === 'hub-rotation' || preview === 's1-summary'
      ? null
      : preview === 'hub-sitout'
      ? {
          summary: 'Andorra lost 0–2 vs Denmark · out of the tournament',
          headline: 'Andorra lost 0–2 vs Denmark · out of the tournament',
          isFinal: false,
          won: false,
          trophyName: null,
          afterPhase: 'hub',
          playerGoals: 0,
          chances: 0,
          sitOutReason: 'no chance this match',
          aggregateLine: null,
          nextLine: null,
        }
      : preview === 'hub-ucl-leg2'
      ? {
          summary: 'Won 1–0 vs Munich · 1 goal from 2 chances · Aggregate 1–0 · second leg to come · Next: Munich · Away · European Cup quarter-final 2nd leg · 1–0 up from the first leg',
          headline: 'Won 1–0 vs Munich',
          isFinal: false,
          won: true,
          trophyName: null,
          afterPhase: 'hub',
          playerGoals: 1,
          chances: 2,
          aggregateLine: 'Aggregate 1–0 · second leg to come',
          nextLine: 'Next: Munich · Away · European Cup quarter-final 2nd leg · 1–0 up from the first leg',
        }
      : preview === 'copa-final'
      ? {
          summary: 'Brazil won 1–0 vs Paraguay · through to the final · 0 goals from 1 chance',
          headline: 'Brazil won 1–0 vs Paraguay · through to the final',
          isFinal: false,
          won: true,
          trophyName: null,
          afterPhase: 'hub',
          playerGoals: 0,
          chances: 1,
          aggregateLine: null,
          nextLine: computedNextLine,
        }
      : preview === 'result-pens'
      ? {
          summary: 'Spain drew 1–1 vs France (won 5–4 on penalties) · 1 goal from 2 chances',
          headline: 'Spain drew 1–1 vs France (won 5–4 on penalties)',
          isFinal: true,
          won: true,
          trophyName: 'European Nations Cup',
          afterPhase: 'season-summary',
          playerGoals: 1,
          chances: 2,
          aggregateLine: null,
          nextLine: computedNextLine,
          scoreFor: 1,
          scoreAgainst: 1,
          penaltyKick: true,
          penaltyScored: true,
          penaltiesWon: true,
          winningGoal: false,
        }
      : {
          summary: 'Spain won 2–0 vs Italy · 2 goals from 2 chances',
          headline: 'Spain won 2–0 vs Italy',
          isFinal: preview === 'result',
          won: true,
          trophyName: preview === 'result' ? 'European Nations Cup' : null,
          afterPhase: preview === 'result' ? 'season-summary' : 'hub',
          playerGoals: 2,
          chances: 2,
          aggregateLine: null,
          nextLine: computedNextLine,
          scoreFor: 2,
          scoreAgainst: 0,
          winningGoal: preview === 'result',
        },
    weeklyWage: preview === 'end' ? 40_000 : promoteSummary && leicester ? weeklyWageForClub(leicester, value, 'Championship') : 140_000,
    careerEarnings: preview === 'end' ? 86_400_000 : 14_560_000,
    contractYears: preview === 'end' ? 1 : promoteSummary || preview === 'expired' ? 2 : preview === 'hub' ? 2 : 5,
    contractYearsRemaining: preview === 'end' || preview === 'expired' || preview === 'oxford-free' || preview === 'palace-hot' ? 0 : preview === 'rising-loans-s2' ? 4 : preview === 'championship-transfer' || preview === 'burnley-s1' ? 3 : promoteSummary || preview === 'hub' ? 2 : 5,
    clubLeague: preview === 'end' || preview === 'mls' ? 'MLS' : preview === 'flamengo' ? 'Brasileirao' : preview === 'argentina' ? 'Liga Profesional' : preview === 'liga-mx' ? 'Liga MX' : preview === 'saudi' ? 'Saudi Pro League' : preview === 'championship-transfer' || preview === 'oxford-free' || promoteSummary ? 'Championship' : preview === 'benfica' || preview === 'rebuild' || preview === 'match-benfica' ? 'Primeira Liga' : preview === 'ajax' || preview === 'match-ajax' || preview === 'match-psv' ? 'Eredivisie' : preview === 'galatasaray' || preview === 'match-galatasaray' ? 'Super Lig' : preview === 'match-psg' ? 'Ligue 1' : preview === 'match-dortmund' ? 'Bundesliga' : preview === 'match-roma' ? 'Serie A' : preview === 's1-summary' || preview === 'rising-loans' || preview === 'rising-loans-s2' || preview === 'palace-hot' || preview === 'burnley-s1' || preview === 'match-liverpool' ? 'Premier League' : 'La Liga',
    homeContractYearsRemaining: null,
    seasonSponsorship: preview === 'end' ? 280_000 : 9_300_000,
    injuryGamesRemaining: 0,
    intlQualifying: { tournament: 'euro', points: 7, played: 3 },
    pendingTransfer,
    pendingSeasonTwoChoice: preview === 'season-paywall' ? { clubId: null } : null,
    fullCareerUnlocked: preview === 'season-paywall' ? false : preview === 'opening-role' ? false : true,
    squadStatus: preview === 'hub-rising-star' || preview === 'reserve-promo' || preview === 's1-summary' || preview === 'rising-loans' || preview === 'rising-loans-s2'
      ? 'rising-star'
      : preview === 'hub-rotation'
        ? 'reserve'
        : preview === 'burnley-s1'
          ? 'impact'
          : 'starter',
    lastTransferRejection: preview === 'transfer-reject'
      ? 'You agreed terms with Manchester Civic. Madrid rejected the €80m bid — they will not sell a starter to Manchester Civic on that fee.'
      : null,
    rulesStamp: preview === 'rebuild' ? 'old-save' : CURRENT_RULES_STAMP,
    wpyResult: preview === 's1-summary' || preview === 'loan-summary'
      ? { won: false, reason: '' }
      : undefined,
    guidedChanceSeen: preview !== 'guide',
    seenBeatKinds: [],
    seenMilestones: preview === 'beat-league' ? ['league-medal'] : [],
    pendingBeats:
      preview === 'beat-cap'
        ? [firstCapBeat('Spain')]
        : preview === 'beat-signed'
          ? [signedClubBeat('Madrid')]
        : preview === 'beat-debut'
          ? [debutBeat()]
        : preview === 'beat-tournament'
          ? [tournamentCallUpBeat('Spain', 'World Championship')]
        : preview === 'beat-title'
          ? [firstTitleBeat('Spanish League')]
          : preview === 'beat-title-nation'
            ? [firstTitleBeat('European Nations Cup')]
            : preview === 'beat-league'
              ? [titleBeat('English League', { seenMilestones: ['league-medal'] })]
            : preview === 'beat-sold'
            ? [soldBeat('Madrid')]
            : preview === 'beat-sold-free'
            ? [soldBeat('Milan Blue', { freeAgent: true })]
            : preview === 'beat-record'
              ? [recordBeat({
                title: 'Spanish League season',
                subtitle: 'Goals in a single league season',
                rankLabel: '1st',
                rank: 1,
                playerGoals: 38,
                kind: 'season',
                domain: 'club',
                group: 'league',
                recordGoals: 38,
                goalsToRecord: 0,
              }, 'Alex Rivera')]
              : preview === 'beat-record-climb'
              ? [recordBeat({
                title: 'World Championship',
                subtitle: 'All-time World Championship goals',
                rankLabel: '2nd',
                rank: 2,
                playerGoals: 13,
                kind: 'all-time',
                domain: 'nation',
                group: 'nation',
                recordGoals: 16,
                goalsToRecord: 3,
                id: 'intl-tournament:career:world-cup',
              }, 'Alex Rivera')]
              : preview === 'beat-award'
                ? [awardBeat('League top goalscorer', 'Alex Rivera', 'Won the Spanish League golden boot with 24 league goals.')]
              : preview === 'beat-award-wc'
                ? [awardBeat('World Championship top goalscorer', 'Alex Rivera', 'The golden boot: most goals at the World Championship.')]
              : preview === 'beat-award-pott'
                ? [awardBeat('World Championship Player of the Tournament', 'Alex Rivera', 'The golden ball: player of the World Championship.')]
              : preview === 'beat-title-ucl'
                ? [titleBeat('European Cup')]
              : preview === 'beat-title-europa'
                ? [titleBeat('European Trophy')]
              : preview === 'beat-award-ucl'
                ? [awardBeat('European Cup Player of the Tournament', 'Alex Rivera')]
              : preview === 'beat-award-europa'
                ? [awardBeat('European Trophy Player of the Tournament', 'Alex Rivera')]
              : preview === 'beat-award-again'
                ? [awardBeat('League top goalscorer', 'Alex Rivera', null, ['award:League top goalscorer'])]
              : preview === 'beat-super-cup'
                ? [firstTitleBeat('German Super Cup')]
              : preview === 'beat-value'
                ? [valueMilestoneBeat(1_000_000)]
              : preview === 'beat-retire'
                ? [retirementBeat('Alex Rivera', 'Inter Miami')]
                : [],
  });

  if (preview === 'legacy' || preview === 'profile') applyLegacyRecordsOverlay(preview);
}

/** DEV overlay: mixed outside / top-10 sourced boards. */
function applyLegacyRecordsOverlay(preview: string): void {
  const state = useCareerStore.getState();
  const counted = state.seasonHistory.filter((season) => season.role !== 'reserve');
  const firstTeam = counted[0] ?? state.currentSeason;
  if (!firstTeam) return;
  const history = [
    ...state.seasonHistory.filter((season) => season.role === 'reserve'),
    {
      ...firstTeam,
      seasonNumber: Math.max(2, firstTeam.seasonNumber),
      role: 'first-team' as const,
      league: 'Premier League',
      clubId: 'man-city',
      leagueGames: 38,
      leagueGoals: 47,
      cupGames: 6,
      cupGoals: 4,
      domesticGames: 44,
      domesticGoals: 51,
      goals: 66,
      gamesPlayed: 57,
      continentalStats: [{ cup: 'ucl' as const, games: 13, goals: 15 }],
      transferFeePaid: 80_000_000,
      transferFromClubId: 'real-madrid',
      international: {
        tournament: 'world-cup' as const,
        qualifyingGames: 10,
        qualifyingGoals: 8,
        qualifyingOutcome: 'qualified' as const,
        finalsGames: 7,
        finalsGoals: 9,
        tournamentOutcome: 'champion' as const,
        playerOfTheTournament: true,
        topGoalscorer: true,
      },
    },
  ];
  useCareerStore.setState({
    phase: preview === 'profile' ? 'profile' : 'legacy',
    legacyReturnPhase: 'profile',
    profileReturnPhase: 'hub',
    playerName: 'Alex Rivera',
    clubId: 'man-city',
    clubLeague: 'Premier League',
    nationality: 'spain',
    seasonHistory: history,
    currentSeason: state.currentSeason
      ? {
          ...state.currentSeason,
          clubId: 'man-city',
          league: 'Premier League',
          role: 'first-team',
          leagueGoals: 0,
          cupGoals: 0,
          continentalStats: [],
        }
      : null,
    nationalTeam: {
      nationId: 'spain',
      availability: createAvailability(),
      caps: 40,
      goals: 42,
      byCompetition: [
        {
          tournament: 'world-cup',
          qualifyingGames: 10,
          qualifyingGoals: 8,
          finalsGames: 7,
          finalsGoals: 9,
        },
        {
          tournament: 'euro',
          qualifyingGames: 0,
          qualifyingGoals: 0,
          finalsGames: 6,
          finalsGoals: 5,
        },
      ],
    },
  });
}
