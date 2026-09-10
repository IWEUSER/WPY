import { fixtureVenueLabel, type CalendarFixture, type SeasonCalendar } from './calendar';
import type { InternationalTournamentId } from './data/competitions';
import { fixtureTitle, nextPlayableFixture, type SeasonSimState } from './seasonSim';

export interface NextMatchBriefing {
  opponent: string;
  venue: 'Home' | 'Away' | 'Neutral' | null;
  competition: string;
  /** First-leg score, two-legged tag, or league-rival note. */
  stake: string | null;
}

export interface BriefingOpts {
  playerNationName?: string;
  tournament?: InternationalTournamentId | null;
  tournamentName?: string;
}

export function isTwoLeggedClubKnockout(fixture: CalendarFixture): boolean {
  return fixture.kind === 'continental-knockout' || fixture.kind === 'continental-semi-final';
}

/** Hub copy for a 2nd leg: "1–0 up from the first leg". */
export function firstLegStakeLine(aggFor: number, aggAgainst: number): string {
  if (aggFor > aggAgainst) return `${aggFor}\u2013${aggAgainst} up from the first leg`;
  if (aggFor < aggAgainst) return `${aggAgainst}\u2013${aggFor} down from the first leg`;
  return `${aggFor}\u2013${aggAgainst} after the first leg`;
}

export function playerGoalsLine(goals: number, chances: number): string {
  return `${goals} goal${goals === 1 ? '' : 's'} from ${chances} chance${chances === 1 ? '' : 's'}`;
}

export function composeMatchSummary(parts: {
  headline: string;
  playerLine?: string | null;
  aggregateLine?: string | null;
  nextLine?: string | null;
  extra?: string | null;
}): string {
  return [parts.headline, parts.playerLine, parts.aggregateLine, parts.nextLine, parts.extra]
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(' \u00b7 ');
}

export function nextMatchBriefing(
  fixture: CalendarFixture,
  sim: SeasonSimState | null,
  opts?: BriefingOpts,
): NextMatchBriefing {
  const title = fixtureTitle(fixture, opts);
  const vs = fixture.opponentLabel ? ` vs ${fixture.opponentLabel}` : '';
  let competition = vs && title.endsWith(vs) ? title.slice(0, -vs.length).replace(/:\s*$/, '').trim() : title;
  if (opts?.playerNationName && competition.endsWith(`: ${opts.playerNationName}`)) {
    competition = competition.slice(0, -(opts.playerNationName.length + 2)).trim();
  }
  const venue = fixture.kind === 'rest' ? null : fixtureVenueLabel(fixture);
  const opponent = fixture.opponentLabel
    ?? (fixture.kind === 'rest' ? 'International break' : 'Next match');

  let stake: string | null = null;
  if (isTwoLeggedClubKnockout(fixture) && fixture.leg === 2 && sim) {
    stake = firstLegStakeLine(sim.knockoutAggFor, sim.knockoutAggAgainst);
  } else if (isTwoLeggedClubKnockout(fixture) && fixture.leg === 1) {
    stake = 'First of two legs';
  }
  if (fixture.kind === 'league' && sim?.titleRivalId && fixture.opponentId === sim.titleRivalId) {
    stake = stake ? `${stake} \u00b7 league rival` : 'League rival';
  }

  return { opponent, venue, competition: competition || title, stake };
}

export function formatNextLine(
  fixture: CalendarFixture,
  sim: SeasonSimState | null,
  opts?: BriefingOpts,
): string {
  const briefing = nextMatchBriefing(fixture, sim, opts);
  const parts = [briefing.opponent];
  if (briefing.venue) parts.push(briefing.venue);
  if (briefing.competition && briefing.competition !== briefing.opponent) parts.push(briefing.competition);
  if (briefing.stake) parts.push(briefing.stake);
  return `Next: ${parts.join(' \u00b7 ')}`;
}

export function nextFixtureLine(
  calendar: SeasonCalendar,
  sim: SeasonSimState,
  opts?: BriefingOpts,
  seasonComplete = false,
): string | null {
  const next = nextPlayableFixture(calendar, sim);
  if (!next) return seasonComplete ? 'Next: season review' : null;
  return formatNextLine(next, sim, opts);
}
