import { getClub } from '../data/clubs';
import { getNation } from '../international';
import { useCareerStore } from '../store';
import type { CareerBeat } from '../careerBeat';
import { PlayerKitPortrait } from './PlayerKitPortrait';

export default function CareerBeatScreen({ beat }: { beat: CareerBeat }) {
  const acknowledgeBeat = useCareerStore((s) => s.acknowledgeBeat);
  const playerName = useCareerStore((s) => s.playerName);
  const clubId = useCareerStore((s) => s.clubId);
  const nationality = useCareerStore((s) => s.nationality);
  const playerSkin = useCareerStore((s) => s.playerSkin);
  const playerHair = useCareerStore((s) => s.playerHair);
  const club = clubId ? getClub(clubId) : undefined;
  const nation = nationality ? getNation(nationality) : undefined;
  const look = playerSkin && playerHair ? { skin: playerSkin, hair: playerHair } : null;
  const showClub = beat.portrait === 'club' || beat.portrait === 'both';
  const showNation = beat.portrait === 'nation' || beat.portrait === 'both';

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-white/10 via-white/5 to-transparent px-5 py-8">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-200/80">{beat.eyebrow}</p>
        <h1 className="mt-3 font-display text-3xl font-black tracking-tight">{beat.headline}</h1>
        <PlayerKitPortrait
          name={playerName?.trim() || 'You'}
          club={showClub ? club : undefined}
          nation={showNation ? nation : undefined}
          look={look}
        />
        <p className="mt-5 text-sm leading-relaxed text-white/70">{beat.copy}</p>
      </div>
      <button
        type="button"
        onClick={acknowledgeBeat}
        className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        Continue
      </button>
    </div>
  );
}
