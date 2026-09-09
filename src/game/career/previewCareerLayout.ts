import { createAvailability } from './availabilityEngine';
import { fixtureIsNight } from './calendar';
import { getClub } from './data/clubs';
import { createNationalTeamState, recordInternationalAppearance } from './international';
import { mlsConferenceOf } from './data/leagueFormat';
import { buildSeasonStandings, rankLeagueTable } from './matchEngine';
import { newContractYears, playerMarketValueFromSeasons, weeklyWageForClub } from './playerValue';
import { applyTrialMatch, assignOpeningTrialClub, beginClubTrial, beginFavouriteClubTrial, createYouthCampaign, failClubTrial } from './openingFlow';
import { hydrateSeason } from './seasonSim';
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
      trophies: ['La Liga', 'Copa del Rey', 'Champions League'],
      topGoalscorer: true,
      playerOfTheYear: true,
      clubPlayerOfTheTournament: false,
      clubPlayerOfTheTournamentReason: 'Won the Champions League but scored 0.31 goals per game in it.',
      wonWpy: true,
      wpyReason: 'Elite goal ratio plus winning the Champions League.',
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
      trophies: ['La Liga', 'Super Cup'],
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
      trophies: ['Championship'],
      topGoalscorer: true,
      playerOfTheYear: true,
      wonWpy: false,
      earnings: 1_200_000,
      sponsorship: 0,
      league: 'Championship',
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
      trophies: ['MLS Cup'],
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
  const previewClubId = preview === 'mls' ? 'lafc' : preview === 'saudi' ? 'al-hilal' : preview === 'match-psg' ? 'psg' : 'real-madrid';
  const club = getClub(previewClubId);
  if (!club) return;
  const { calendar, sim } = hydrateSeason({
    seasonNumber: 4,
    club,
    careerGoalRatio: 0.78,
    nationId: preview === 'mls' ? 'united-states' : preview === 'saudi' ? 'saudi-arabia' : preview === 'match-psg' ? 'france' : 'spain',
  });
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
  const reserveSeason = preview === 'reserve'
    ? hydrateSeason({
        seasonNumber: 1,
        club,
        careerGoalRatio: 0,
        nationId: 'spain',
        leagueOnly: true,
      })
    : null;

  const isTrialPreview = preview === 'trial';
  const isYouthPreview = preview === 'youth';
  const isClubTrialPreview = preview === 'club-trial';
  const isTrialRetryPreview = preview === 'trial-retry';
  const isTrialOffersPreview = preview === 'trial-offers';
  const isReserveLoansPreview = preview === 'reserve-loans';
  const openingNationId = preview === 'mls' ? 'united-states' : preview === 'saudi' ? 'saudi-arabia' : 'spain';
  let openingCampaign: OpeningCampaign | null = null;
  if (isYouthPreview || isTrialPreview || isClubTrialPreview || preview === 'club-offer') {
    const youth = createYouthCampaign(openingNationId, () => 0.31);
    const scored = { ...youth, goals: 6, youthGoals: 6, gamesPlayed: 7, qualified: true };
    if (isYouthPreview) openingCampaign = youth;
    else if (isTrialPreview) openingCampaign = assignOpeningTrialClub(scored, openingNationId);
    else openingCampaign = beginClubTrial(scored, openingNationId, 2);
  } else if (isTrialRetryPreview || isTrialOffersPreview || preview === 'trial-drop') {
    const madrid = getClub('real-madrid');
    if (madrid) {
      let look = beginFavouriteClubTrial(madrid);
      const failBlank = () => {
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
    || preview === 'match-psg';
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
      fx.opponentLabel = 'Bayern Munich';
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
  } else if (preview === 'match-sweden' || preview === 'match-poland' || preview === 'match-brazil') {
    const idx = calendar.fixtures.findIndex((f) => f.kind === 'international');
    if (idx >= 0) matchFixtureIndex = idx;
    const fx = calendar.fixtures[matchFixtureIndex];
    const opp = preview === 'match-sweden'
      ? { id: 'sweden', label: 'Sweden' }
      : preview === 'match-poland'
        ? { id: 'poland', label: 'Poland' }
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
      trophies: n === 4 ? ['Championship'] : [],
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
    preview === 'first-team-miss'
      ? resolveSeasonTransition({
          season: season({
            seasonNumber: 1,
            clubId: 'real-madrid',
            role: 'first-team',
            matches: [],
            goals: 8,
            gamesPlayed: 38,
            ratioMet: false,
            age: 17,
            leagueGoals: 8,
            trophies: [],
            topGoalscorer: false,
            playerOfTheYear: false,
            wonWpy: false,
          }),
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
      : preview === 'trial-offers'
      ? trialOffersPreview
      : isReserveLoansPreview
      ? reserveLoansPreview?.pendingTransfer ?? null
      : preview === 'first-team-miss'
      ? firstTeamMissPreview?.pendingTransfer ?? null
      : preview === 'expired'
      ? {
          kind: 'end-of-season',
          detail: 'Out of contract: more clubs can bid because there is no fee. You can stay where you are.',
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

  useCareerStore.setState({
    phase:
      isTrialPreview || isTrialRetryPreview || isTrialOffersPreview || preview === 'trial-drop'
        ? 'opening-brief'
        : isYouthPreview || isClubTrialPreview
          ? 'match'
        : preview === 'record'
        ? 'career'
        : preview === 'club-choice'
        ? 'club-choice'
        : preview === 'transfer' || preview === 'expired' || preview === 'renew' || preview === 'championship-transfer' || isReserveLoansPreview || preview === 'first-team-miss'
          ? 'transfer-choice'
          : preview === 'reserve-promo'
            ? 'season-summary'
          : preview === 'club-offer'
            ? 'club-offer'
          : preview === 'result' || preview === 'result-pens'
            ? 'match-result'
            : preview === 'end'
              ? 'career-end'
              : preview === 'summary'
                ? 'season-summary'
                : isMatchPreview || isReservePreview
                  ? 'match'
                  : 'hub',
    age: isTrialPreview || isYouthPreview || isClubTrialPreview || isReservePreview ? 16 : preview === 'end' ? 36 : preview === 'championship-transfer' ? 20 : promoteSummary ? 22 : 19,
    seasonNumber: isTrialPreview || isYouthPreview || isClubTrialPreview || isReservePreview ? 1 : preview === 'end' ? 21 : promoteSummary ? 6 : 4,
    clubId: isYouthPreview || isTrialPreview ? null : isClubTrialPreview ? openingCampaign?.trialClubId ?? null : preview === 'end' ? 'inter-miami' : preview === 'mls' ? 'lafc' : preview === 'saudi' ? 'al-hilal' : preview === 'match-psg' ? 'psg' : preview === 'championship-transfer' || promoteSummary ? 'leicester' : 'real-madrid',
    parentClubId: isYouthPreview || isTrialPreview ? null : isClubTrialPreview ? openingCampaign?.trialClubId ?? null : preview === 'end' ? 'inter-miami' : preview === 'mls' ? 'lafc' : preview === 'saudi' ? 'al-hilal' : preview === 'match-psg' ? 'psg' : preview === 'championship-transfer' || promoteSummary ? 'leicester' : 'real-madrid',
    role: isReservePreview || isTrialPreview || isYouthPreview || isClubTrialPreview ? 'reserve' : 'first-team',
    trial: preview === 'club-offer'
      ? { shots: [], goals: 6, offeredClubIds: ['real-madrid', 'barcelona', 'atletico-madrid'] }
      : null,
    openingCampaign,
    careerStart: isTrialRetryPreview || isTrialOffersPreview || preview === 'trial-drop' || preview === 'club-choice' ? 'favourite-trial' : isYouthPreview || isTrialPreview || isClubTrialPreview ? 'youth' : 'favourite-first-team',
    seasonsAtCurrentClub: preview === 'end' ? 10 : promoteSummary ? 1 : 3,
    nationality: preview === 'mls' ? 'united-states' : preview === 'saudi' ? 'saudi-arabia' : preview === 'championship-transfer' ? 'england' : 'spain',
    nationalTeam,
    availability: createAvailability(),
    seasonHistory: preview === 'championship-transfer' ? champSeasons.slice(0, 2) : history,
    careerGoals: preview === 'end' ? 312 : preview === 'championship-transfer' ? 72 : 58,
    careerGames: preview === 'end' ? 540 : preview === 'championship-transfer' ? 138 : 76,
    seasonCalendar: isReservePreview
      ? reserveSeason?.calendar ?? null
      : isTrialPreview || isYouthPreview || isClubTrialPreview
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
      : isMatchPreview
      ? { fixtureIndex: matchFixtureIndex, chancesTotal: 2, chancesTaken: 0, goals: 0 }
      : null,
    seasonSim: isReservePreview
      ? reserveSeason?.sim ?? sim
      : promoteSummary
      ? { ...sim, leagueTable: leicesterTable, honours: { ...sim.honours, leagueChampion: true } }
      : sim,
    seasonStandings: buildSeasonStandings(promoteSummary ? leicesterTable : sim.leagueTable, promoteSummary ? null : sim.europeanStanding),
    currentSeason:
      preview === 'end'
        ? history[history.length - 1]
        : promoteSummary
          ? season({
              seasonNumber: 6,
              clubId: 'leicester',
              role: 'first-team',
              matches: [],
              goals: 21,
              gamesPlayed: 48,
              ratioMet: true,
              age: 22,
              leagueGoals: 20,
              leagueGames: 46,
              cupGames: 2,
              cupGoals: 1,
              domesticGames: 48,
              domesticGoals: 21,
              continentalStats: [],
              trophies: ['Championship'],
              topGoalscorer: false,
              playerOfTheYear: true,
              clubPlayerOfTheTournament: false,
              clubPlayerOfTheTournamentReason: 'Win the continental tournament at 0.7 goals per game to take Player of the Tournament.',
              topGoalscorerReason: '20 league goals in Championship, but another striker took the golden boot.',
              playerOfTheYearReason: 'Won Championship Player of the Year with 20 league goals.',
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
    lastMatchSummary: preview === 'result-pens'
      ? 'Spain drew 1–1 vs France (won 5–4 on penalties) · through to the quarter-finals · 1 goal from 2 chances'
      : 'Spain won 2–0 vs Italy · 2 goals from 2 chances',
    lastMatchResult: {
      summary: preview === 'result-pens'
        ? 'Spain drew 1–1 vs France (won 5–4 on penalties) · through to the quarter-finals · 1 goal from 2 chances'
        : 'Spain won 2–0 vs Italy · 2 goals from 2 chances',
      isFinal: preview !== 'result-pens',
      won: true,
      trophyName: preview === 'result-pens' ? null : 'European Championship',
      afterPhase: 'season-summary',
    },
    weeklyWage: preview === 'end' ? 40_000 : promoteSummary && leicester ? weeklyWageForClub(leicester, value, 'Championship') : 140_000,
    careerEarnings: preview === 'end' ? 86_400_000 : 14_560_000,
    contractYears: preview === 'end' ? 1 : promoteSummary || preview === 'expired' ? 2 : preview === 'hub' ? 2 : 5,
    contractYearsRemaining: preview === 'end' || preview === 'expired' ? 1 : preview === 'championship-transfer' ? 3 : promoteSummary || preview === 'hub' ? 2 : 5,
    clubLeague: preview === 'end' || preview === 'mls' ? 'MLS' : preview === 'saudi' ? 'Saudi Pro League' : preview === 'championship-transfer' || promoteSummary ? 'Championship' : 'La Liga',
    homeContractYearsRemaining: null,
    seasonSponsorship: preview === 'end' ? 280_000 : 9_300_000,
    injuryGamesRemaining: 0,
    intlQualifying: { tournament: 'euro', points: 7, played: 3 },
    pendingTransfer,
  });
}
