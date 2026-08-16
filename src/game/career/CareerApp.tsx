import { useState } from 'react';
import ShootingGame from '../shooting/ShootingGame';
import HomeScreen from './screens/HomeScreen';
import TrialScreen from './screens/TrialScreen';
import ClubOfferScreen from './screens/ClubOfferScreen';
import CareerHub from './screens/CareerHub';
import MatchScreen from './screens/MatchScreen';
import SeasonSummaryScreen from './screens/SeasonSummaryScreen';
import TransferChoiceScreen from './screens/TransferChoiceScreen';
import { useCareerStore } from './store';

export default function CareerApp() {
  const [practicing, setPracticing] = useState(false);
  const phase = useCareerStore((s) => s.phase);
  const returnToMenu = useCareerStore((s) => s.returnToMenu);

  if (practicing) {
    return (
      <div className="relative h-full w-full">
        <ShootingGame />
        <button
          type="button"
          onClick={() => setPracticing(false)}
          className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur"
        >
          Exit
        </button>
      </div>
    );
  }

  switch (phase) {
    case 'trial':
      return <TrialScreen />;
    case 'club-offer':
      return <ClubOfferScreen />;
    case 'match':
      return <MatchScreen />;
    case 'season-summary':
      return <SeasonSummaryScreen />;
    case 'transfer-choice':
      return <TransferChoiceScreen />;
    case 'hub':
      return <CareerHub onOpenMenu={returnToMenu} />;
    default:
      return <HomeScreen onPractice={() => setPracticing(true)} />;
  }
}
