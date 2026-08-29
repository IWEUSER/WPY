import { useRef } from 'react';
import ShootingGame from '../../shooting/ShootingGame';
import type { ShotResult } from '../../shooting/types';
import { getClub } from '../data/clubs';
import { CONTINENTAL_CUPS, DOMESTIC_CUPS, INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { fixtureTitle } from '../seasonSim';
import { useCareerStore, SEASON_LENGTH } from '../store';

export default function MatchScreen() {
  const clubId = useCareerStore((s) => s.clubId);
  const season = useCareerStore((s) => s.currentSeason);
  const calendar = useCareerStore((s) => s.seasonCalendar);
  const liveMatch = useCareerStore((s) => s.liveMatch);
  const seasonSim = useCareerStore((s) => s.seasonSim);
  const recordMatchShot = useCareerStore((s) => s.recordMatchShot);
  const recordMatchChance = useCareerStore((s) => s.recordMatchChance);
  const finishLiveMatch = useCareerStore((s) => s.finishLiveMatch);
  const lastResultRef = useRef<ShotResult | null>(null);

  const club = clubId ? getClub(clubId) : undefined;
  const matchNumber = (season?.matches.length ?? 0) + 1;
  const fixture = calendar && liveMatch ? calendar.fixtures[liveMatch.fixtureIndex] : undefined;
  const simulated = Boolean(calendar && liveMatch && fixture);

  const title = simulated && fixture
    ? `${club?.name ?? 'Match'} — ${fixtureTitle(fixture)}`
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
    ? fixture?.isDecisive
      ? 'This match is on you — score this chance or your team is out'
      : chances === 1
        ? 'One chance this game — make it count'
        : `${chances} chances this game`
    : 'Your one big chance this game - make it count';

  const progressLabel = simulated && liveMatch
    ? `${competitionName ? `${competitionName} · ` : ''}${chances} chance${chances === 1 ? '' : 's'}`
    : `Matchday ${matchNumber}/${SEASON_LENGTH}`;

  return (
    <ShootingGame
      key={simulated ? `sim-${liveMatch?.fixtureIndex}-${chances}` : `match-${matchNumber}`}
      title={title}
      subtitle={subtitle}
      progressLabel={progressLabel}
      hideStatsBar
      maxShots={chances}
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
