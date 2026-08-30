import type { ClubMatchResult } from './matchEngine';
import { simulateClubMatch } from './matchEngine';
import { getClub, type ClubTier } from './data/clubs';
import { nationStrength } from './data/fifaRankings';
import { fixtureIsHome, type CalendarFixture } from './calendar';
import {
  buildClubTrialCalendar,
  nextTrialTier,
  pickTrialClub,
  tierForYouthGoals,
} from './trial';
import {
  buildYouthGroupCalendar,
  nextYouthKnockoutRound,
  pickYouthGroupOpponents,
  pickYouthKnockoutOpponent,
  simulateOtherGroupMatches,
  youthGroupQualifies,
  youthKnockoutFixture,
  youthTournamentForNation,
  type YouthKnockoutRound,
} from './youthTournament';
import type { OpeningCampaign } from './types';

export function createYouthCampaign(nationId: string, rng: () => number = Math.random): OpeningCampaign {
  const tournament = youthTournamentForNation(nationId);
  const groupOpponents = pickYouthGroupOpponents(nationId, rng);
  return {
    kind: 'youth-tournament',
    calendar: buildYouthGroupCalendar(nationId, groupOpponents),
    fixtureIndex: 0,
    goals: 0,
    gamesPlayed: 0,
    youthName: tournament.name,
    groupOpponents,
    groupOthers: simulateOtherGroupMatches(groupOpponents, rng),
    playerGroup: { id: nationId, points: 0, gd: 0 },
    qualified: null,
    eliminated: false,
    reachedSemi: false,
    usedOpponentIds: [...groupOpponents],
    trialClubId: null,
    trialTier: null,
    rejectedClubIds: [],
    youthGoals: 0,
  };
}

function pointsFrom(result: ClubMatchResult): { points: number; gd: number } {
  const gd = result.scoreFor - result.scoreAgainst;
  if (result.outcome === 'win') return { points: 3, gd };
  if (result.outcome === 'draw') return { points: 1, gd };
  return { points: 0, gd };
}

export function resolveOpeningMatch(
  fixture: CalendarFixture,
  playerGoals: number,
  trialClubId: string | null,
  nationId: string | null,
  rng: () => number = Math.random,
): ClubMatchResult {
  const isHome = fixtureIsHome(fixture);
  const chances = fixture.playerChances;
  if (fixture.kind === 'international') {
    const us = nationId ? nationStrength(nationId) : 70;
    const them = fixture.opponentId ? nationStrength(fixture.opponentId) : 70;
    return simulateClubMatch({ clubStrength: us, opponentStrength: them, isHome }, rng, playerGoals, chances);
  }
  const club = trialClubId ? getClub(trialClubId) : undefined;
  const opponent = fixture.opponentId ? getClub(fixture.opponentId) : undefined;
  return simulateClubMatch(
    {
      clubStrength: club?.strength ?? 70,
      opponentStrength: opponent?.strength ?? 70,
      clubTier: club?.tier,
      opponentTier: opponent?.tier,
      isHome,
    },
    rng,
    playerGoals,
    chances,
  );
}

export function applyYouthMatch(
  campaign: OpeningCampaign,
  fixture: CalendarFixture,
  result: ClubMatchResult,
  playerGoals: number,
  nationId: string,
  rng: () => number = Math.random,
): OpeningCampaign {
  const scored = pointsFrom(result);
  const next: OpeningCampaign = {
    ...campaign,
    goals: campaign.goals + playerGoals,
    gamesPlayed: campaign.gamesPlayed + 1,
    fixtureIndex: campaign.fixtureIndex + 1,
    playerGroup: {
      ...campaign.playerGroup,
      points: campaign.playerGroup.points + scored.points,
      gd: campaign.playerGroup.gd + scored.gd,
    },
    usedOpponentIds: fixture.opponentId
      ? [...new Set([...campaign.usedOpponentIds, fixture.opponentId])]
      : campaign.usedOpponentIds,
    youthGoals: campaign.goals + playerGoals,
  };

  const round = fixture.internationalRound ?? 'group';
  if (round === 'group') {
    const groupDone = next.fixtureIndex >= next.calendar.fixtures.length;
    if (!groupDone) return next;
    const qualified = youthGroupQualifies(next.playerGroup, next.groupOthers);
    if (!qualified) {
      return { ...next, qualified: false, eliminated: true };
    }
    const opponentId = pickYouthKnockoutOpponent(nationId, next.usedOpponentIds, rng);
    const ko = youthKnockoutFixture(nationId, opponentId, 'round-of-16', next.calendar.totalWeeks + 1);
    return {
      ...next,
      qualified: true,
      calendar: {
        ...next.calendar,
        totalWeeks: ko.week,
        fixtures: [...next.calendar.fixtures, ko],
      },
    };
  }

  const won = result.outcome === 'win';
  if (round === 'semi-final') next.reachedSemi = true;
  const following = nextYouthKnockoutRound(round as YouthKnockoutRound | 'group', won);
  if (following === 'done') {
    return { ...next, eliminated: true };
  }
  const opponentId = pickYouthKnockoutOpponent(nationId, next.usedOpponentIds, rng);
  const ko = youthKnockoutFixture(nationId, opponentId, following, next.calendar.totalWeeks + 1);
  return {
    ...next,
    calendar: {
      ...next.calendar,
      totalWeeks: ko.week,
      fixtures: [...next.calendar.fixtures, ko],
    },
  };
}

export function youthTournamentComplete(campaign: OpeningCampaign): boolean {
  if (campaign.kind !== 'youth-tournament') return false;
  if (campaign.eliminated) return true;
  const last = campaign.calendar.fixtures[campaign.fixtureIndex - 1];
  return last?.internationalRound === 'final' || last?.internationalRound === 'third-place';
}

/** Lock in the trial club after the U16 tournament without starting the three games. */
export function assignOpeningTrialClub(
  campaign: OpeningCampaign,
  nationality: string | null,
): OpeningCampaign {
  const trialTier = campaign.trialTier ?? tierForYouthGoals(campaign.youthGoals || campaign.goals);
  const existing = campaign.trialClubId ? getClub(campaign.trialClubId) : undefined;
  const reuse = existing && !campaign.rejectedClubIds.includes(existing.id);
  const club = reuse ? existing : pickTrialClub(trialTier, nationality, campaign.rejectedClubIds);
  return {
    ...campaign,
    youthGoals: campaign.youthGoals || campaign.goals,
    trialClubId: club.id,
    trialTier: club.tier,
  };
}

export function beginClubTrial(
  campaign: OpeningCampaign,
  nationality: string | null,
  tier?: ClubTier,
): OpeningCampaign {
  const assigned = assignOpeningTrialClub(
    tier != null && tier !== campaign.trialTier
      ? { ...campaign, trialClubId: null, trialTier: tier }
      : campaign,
    nationality,
  );
  const club =
    getClub(assigned.trialClubId ?? '') ??
    pickTrialClub(assigned.trialTier ?? 5, nationality, assigned.rejectedClubIds);
  return {
    ...assigned,
    kind: 'club-trial',
    calendar: buildClubTrialCalendar(club),
    fixtureIndex: 0,
    goals: 0,
    gamesPlayed: 0,
    trialClubId: club.id,
    trialTier: club.tier,
    eliminated: false,
  };
}

export function applyTrialMatch(campaign: OpeningCampaign, playerGoals: number): OpeningCampaign {
  return {
    ...campaign,
    goals: campaign.goals + playerGoals,
    gamesPlayed: campaign.gamesPlayed + 1,
    fixtureIndex: campaign.fixtureIndex + 1,
  };
}

export function clubTrialComplete(campaign: OpeningCampaign): boolean {
  return campaign.kind === 'club-trial' && campaign.fixtureIndex >= campaign.calendar.fixtures.length;
}

export function rejectAndDropTrial(campaign: OpeningCampaign, nationality: string | null): OpeningCampaign {
  const rejected = campaign.trialClubId
    ? [...campaign.rejectedClubIds, campaign.trialClubId]
    : campaign.rejectedClubIds;
  const nextTier = nextTrialTier(campaign.trialTier ?? 5);
  return beginClubTrial(
    { ...campaign, rejectedClubIds: rejected, trialClubId: null, trialTier: nextTier },
    nationality,
    nextTier,
  );
}

export function openingMatchSummary(
  fixture: CalendarFixture,
  result: ClubMatchResult,
  playerNationName?: string,
): string {
  const us = playerNationName && fixture.kind === 'international' ? playerNationName : 'You';
  const them = fixture.opponentLabel ?? 'Opposition';
  const verb = result.outcome === 'win' ? 'won' : result.outcome === 'draw' ? 'drew' : 'lost';
  return `${us} ${verb} ${result.scoreFor}–${result.scoreAgainst} vs ${them}`;
}

export function youthTrophyName(campaign: OpeningCampaign, fixture: CalendarFixture, won: boolean): string | null {
  if (fixture.internationalRound === 'final' && won) return campaign.youthName;
  return null;
}
