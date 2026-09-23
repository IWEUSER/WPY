import { useEffect, useState } from 'react';
import ShootingGame from '../shooting/ShootingGame';
import HomeScreen from './screens/HomeScreen';
import ClubChoiceScreen from './screens/ClubChoiceScreen';
import TrialScreen from './screens/TrialScreen';
import ClubOfferScreen from './screens/ClubOfferScreen';
import NationalityScreen from './screens/NationalityScreen';
import PlayerNameScreen from './screens/PlayerNameScreen';
import CareerHub from './screens/CareerHub';
import CareerRecordScreen from './screens/CareerRecordScreen';
import ProfileScreen from './screens/ProfileScreen';
import LegacyScreen from './screens/LegacyScreen';
import CareerEndScreen from './screens/CareerEndScreen';
import MatchScreen from './screens/MatchScreen';
import SeasonSummaryScreen from './screens/SeasonSummaryScreen';
import TransferChoiceScreen from './screens/TransferChoiceScreen';
import MatchResultScreen from './screens/MatchResultScreen';
import OpeningBriefScreen from './screens/OpeningBriefScreen';
import OpeningStatusScreen from './screens/OpeningStatusScreen';
import CareerBeatScreen from './screens/CareerBeatScreen';
import GuidedFirstChanceScreen from './screens/GuidedFirstChanceScreen';
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
  const [hydrated, setHydrated] = useState(() => useCareerStore.persist.hasHydrated());
  const [practicing, setPracticing] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).has('practice'),
  );
  useEffect(() => {
    const unsub = useCareerStore.persist.onFinishHydration(() => setHydrated(true));
    if (useCareerStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  const phase = useCareerStore((s) => s.phase);
  const nationality = useCareerStore((s) => s.nationality);
  const playerName = useCareerStore((s) => s.playerName);
  const openingCampaign = useCareerStore((s) => s.openingCampaign);
  const seasonSim = useCareerStore((s) => s.seasonSim);
  const lastMatchResult = useCareerStore((s) => s.lastMatchResult);
  const liveMatch = useCareerStore((s) => s.liveMatch);
  const pendingTransfer = useCareerStore((s) => s.pendingTransfer);
  const clubId = useCareerStore((s) => s.clubId);
  const returnToMenu = useCareerStore((s) => s.returnToMenu);
  const pendingBeats = useCareerStore((s) => s.pendingBeats);
  const guidedChanceSeen = useCareerStore((s) => s.guidedChanceSeen);

  if (!hydrated) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-white/40">
        Loading career…
      </div>
    );
  }

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
  if (!nationality && phase !== 'menu' && phase !== 'trial' && phase !== 'club-offer' && phase !== 'nationality-choice' && phase !== 'club-choice' && phase !== 'player-name') {
    return <NationalityScreen />;
  }

  if (nationality && !playerName && phase !== 'menu' && phase !== 'nationality-choice' && phase !== 'player-name' && phase !== 'club-choice') {
    return <PlayerNameScreen />;
  }

  const nextBeat = pendingBeats?.[0];
  if (nextBeat && phase !== 'menu' && phase !== 'nationality-choice' && phase !== 'player-name' && phase !== 'club-choice') {
    return <CareerBeatScreen beat={nextBeat} />;
  }

  if (!guidedChanceSeen && phase === 'match' && (liveMatch || openingCampaign)) {
    return <GuidedFirstChanceScreen />;
  }

  switch (phase) {
    case 'trial':
      return <TrialScreen />;
    case 'opening-brief':
      return <OpeningBriefScreen />;
    case 'club-offer':
      return <ClubOfferScreen />;
    case 'club-choice':
      return <ClubChoiceScreen />;
    case 'nationality-choice':
      return <NationalityScreen />;
    case 'player-name':
      return <PlayerNameScreen />;
    case 'match':
      if (!liveMatch && !openingCampaign) {
        return <CareerHub onOpenMenu={returnToMenu} />;
      }
      return <MatchScreen />;
    case 'match-result':
      if (lastMatchResult == null) {
        return <CareerHub onOpenMenu={returnToMenu} />;
      }
      return <MatchResultScreen />;
    case 'season-summary':
      if (!clubId) {
        return <CareerHub onOpenMenu={returnToMenu} />;
      }
      return <SeasonSummaryScreen />;
    case 'transfer-choice':
      if (!pendingTransfer) {
        return <CareerHub onOpenMenu={returnToMenu} />;
      }
      return <TransferChoiceScreen />;
    case 'hub':
      return openingCampaign && !seasonSim ? (
        <OpeningStatusScreen />
      ) : (
        <CareerHub onOpenMenu={returnToMenu} />
      );
    case 'career':
      return <CareerRecordScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'legacy':
      return <LegacyScreen />;
    case 'career-end':
      return <CareerEndScreen />;
    default:
      return <HomeScreen onPractice={() => setPracticing(true)} />;
  }
}
