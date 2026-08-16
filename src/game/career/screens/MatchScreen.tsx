import { useRef } from 'react';
import ShootingGame from '../../shooting/ShootingGame';
import type { ShotResult } from '../../shooting/types';
import { getClub } from '../data/clubs';
import { useCareerStore, SEASON_LENGTH } from '../store';

export default function MatchScreen() {
  const clubId = useCareerStore((s) => s.clubId);
  const season = useCareerStore((s) => s.currentSeason);
  const recordMatchShot = useCareerStore((s) => s.recordMatchShot);
  const lastResultRef = useRef<ShotResult | null>(null);

  const club = clubId ? getClub(clubId) : undefined;
  const matchNumber = (season?.matches.length ?? 0) + 1;

  return (
    <ShootingGame
      key={`match-${matchNumber}`}
      title={club ? `${club.name} \u2014 Matchday ${matchNumber}` : `Matchday ${matchNumber}`}
      subtitle="Your one big chance this game - make it count"
      progressLabel={`Matchday ${matchNumber}/${SEASON_LENGTH}`}
      hideStatsBar
      maxShots={1}
      onShotResolved={(result) => {
        lastResultRef.current = result;
      }}
      onComplete={() => {
        if (lastResultRef.current) recordMatchShot(lastResultRef.current);
      }}
    />
  );
}
