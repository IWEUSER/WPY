import ShootingGame from '../../shooting/ShootingGame';
import { getNation } from '../international';
import { trialStadium } from '../matchVenue';
import { TRIAL_SHOTS } from '../trial';
import { useCareerStore } from '../store';

export default function TrialScreen() {
  const trial = useCareerStore((s) => s.trial);
  const nationality = useCareerStore((s) => s.nationality);
  const recordTrialShot = useCareerStore((s) => s.recordTrialShot);
  const finishTrial = useCareerStore((s) => s.finishTrial);

  const shotsTaken = trial?.shots.length ?? 0;
  const goals = trial?.goals ?? 0;
  const nation = nationality ? getNation(nationality) : undefined;

  return (
    <ShootingGame
      key="trial"
      title="The Trial"
      subtitle="10 shots to convince the scouts watching"
      progressLabel={`Shot ${Math.min(shotsTaken + 1, TRIAL_SHOTS)}/${TRIAL_SHOTS} \u00b7 ${goals} scored`}
      hideStatsBar
      maxShots={TRIAL_SHOTS}
      stadium={trialStadium(nation)}
      onShotResolved={recordTrialShot}
      onComplete={finishTrial}
    />
  );
}
