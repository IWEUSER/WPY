import { useRef } from 'react';
import ShootingGame from '../../shooting/ShootingGame';
import type { ShotResult } from '../../shooting/types';
import { currentCalendarWeek, fixtureVenueLabel } from '../calendar';
import { getClub, leagueMatchWeeks } from '../data/clubs';
import { CONTINENTAL_CUPS, DOMESTIC_CUPS, INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { getNation } from '../international';
import { resolveCareerStadium } from '../matchVenue';
import { fixtureTitle } from '../seasonSim';
import { useCareerStore } from '../store';

export default function MatchScreen() {
  const clubId = useCareerStore((s) => s.clubId);
  const nationality = useCareerStore((s) => s.nationality);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const role = useCareerStore((s) => s.role);
  const season = useCareerStore((s) => s.currentSeason);
  const calendar = useCareerStore((s) => s.seasonCalendar);
  const liveMatch = useCareerStore((s) => s.liveMatch);
  const seasonSim = useCareerStore((s) => s.seasonSim);
  const recordMatchShot = useCareerStore((s) => s.recordMatchShot);
  const recordMatchChance = useCareerStore((s) => s.recordMatchChance);
  const finishLiveMatch = useCareerStore((s) => s.finishLiveMatch);
  const lastResultRef = useRef<ShotResult | null>(null);

  const club = clubId ? getClub(clubId) : undefined;
  const nation = nationality ? getNation(nationality) : undefined;
  const matchNumber = (season?.matches.length ?? 0) + 1;
  const fixture = calendar && liveMatch ? calendar.fixtures[liveMatch.fixtureIndex] : undefined;
  const simulated = Boolean(calendar && liveMatch && fixture);

  const title = simulated && fixture
    ? fixture.kind === 'international'
      ? fixtureTitle(fixture, { playerNationName: nation?.name })
      : `${club?.name ?? 'Match'} — ${fixtureTitle(fixture)}`
    : club ? `${club.name} — Matchday ${matchNumber}` : `Matchday ${matchNumber}`;

  const competitionName = fixture?.continentalCup
    ? CONTINENTAL_CUPS[fixture.continentalCup].name
    : fixture?.kind === 'domestic-cup' && fixture.domesticCup
      ? DOMESTIC_CUPS[fixture.domesticCup].name
      : fixture?.kind === 'international' && seasonSim?.internationalTournament
        ? INTERNATIONAL_TOURNAMENTS[seasonSim.internationalTournament].name
        : null;

  const chances = liveMatch?.chancesTotal ?? 1;
  const subtitle = simulated
    ? chances === 1
      ? 'One chance this game — make it count'
      : `${chances} chances this game`
    : 'Your one big chance this game - make it count';

  const weekLabel = simulated && calendar && liveMatch
    ? `Week ${currentCalendarWeek(calendar, liveMatch.fixtureIndex)} of ${calendar.totalWeeks}`
    : `Matchday ${matchNumber}/${club ? leagueMatchWeeks(club.league) : matchNumber}`;
  const venueLabel = fixture ? fixtureVenueLabel(fixture) : null;
  const progressLabel = simulated && liveMatch
    ? `${weekLabel}${competitionName ? ` · ${competitionName}` : ''}${venueLabel ? ` · ${venueLabel}` : ''} · ${chances} chance${chances === 1 ? '' : 's'}`
    : weekLabel;

  const stadium = resolveCareerStadium({ fixture, club, nation, seasonNumber, role });

  return (
    <ShootingGame
      key={simulated ? `sim-${liveMatch?.fixtureIndex}-${chances}` : `match-${matchNumber}`}
      title={title}
      subtitle={subtitle}
      progressLabel={progressLabel}
      hideStatsBar
      maxShots={chances}
      clubStrength={club?.strength}
      stadium={stadium}
      onShotResolved={(result) => {
        lastResultRef.current = result;
        if (simulated) recordMatchChance(result);
      }}
      onComplete={() => {
        if (simulated) finishLiveMatch();
        else if (lastResultRef.current) recordMatchShot(lastResultRef.current);
      }}
    />
  );
}
