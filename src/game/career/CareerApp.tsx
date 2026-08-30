import { useState } from 'react';
import ShootingGame from '../shooting/ShootingGame';
import HomeScreen from './screens/HomeScreen';
import TrialScreen from './screens/TrialScreen';
import ClubOfferScreen from './screens/ClubOfferScreen';
import NationalityScreen from './screens/NationalityScreen';
import CareerHub from './screens/CareerHub';
import CareerRecordScreen from './screens/CareerRecordScreen';
import CareerEndScreen from './screens/CareerEndScreen';
import MatchScreen from './screens/MatchScreen';
import SeasonSummaryScreen from './screens/SeasonSummaryScreen';
import TransferChoiceScreen from './screens/TransferChoiceScreen';
import MatchResultScreen from './screens/MatchResultScreen';
import { useCareerStore } from './store';
import { applyCareerLayoutPreview } from './previewCareerLayout';

if (import.meta.env.DEV) {
  (window as unknown as { __careerStore: typeof useCareerStore }).__careerStore = useCareerStore;
  const applyPreview = () => {
    if (new URLSearchParams(window.location.search).has('preview-career')) {
      applyCareerLayoutPreview();
    }
  };
  applyPreview();
  useCareerStore.persist.onFinishHydration(applyPreview);
}

export default function CareerApp() {
  const [practicing, setPracticing] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).has('practice'),
  );
  const phase = useCareerStore((s) => s.phase);
  const nationality = useCareerStore((s) => s.nationality);
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

  // Existing saves created before nationality-first still have a club
  // but no country - ask before they can keep playing.
  if (!nationality && phase !== 'menu' && phase !== 'trial' && phase !== 'club-offer' && phase !== 'nationality-choice') {
    return <NationalityScreen />;
  }

  switch (phase) {
    case 'trial':
      return <TrialScreen />;
    case 'club-offer':
      return <ClubOfferScreen />;
    case 'nationality-choice':
      return <NationalityScreen />;
    case 'match':
      return <MatchScreen />;
    case 'match-result':
      return <MatchResultScreen />;
    case 'season-summary':
      return <SeasonSummaryScreen />;
    case 'transfer-choice':
      return <TransferChoiceScreen />;
    case 'hub':
      return <CareerHub onOpenMenu={returnToMenu} />;
    case 'career':
      return <CareerRecordScreen />;
    case 'career-end':
      return <CareerEndScreen />;
    default:
      return <HomeScreen onPractice={() => setPracticing(true)} />;
  }
}
