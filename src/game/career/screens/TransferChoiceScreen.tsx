import { getClub } from '../data/clubs';
import { useCareerStore } from '../store';

const KIND_LABEL: Record<string, string> = {
  loan: 'Loan offers',
  sold: "Interested clubs",
  'promotion-offer': 'Transfer offers',
};

export default function TransferChoiceScreen() {
  const pending = useCareerStore((s) => s.pendingTransfer);
  const clubId = useCareerStore((s) => s.clubId);
  const resolveTransferChoice = useCareerStore((s) => s.resolveTransferChoice);

  const currentClub = clubId ? getClub(clubId) : undefined;
  if (!pending) return null;

  const offers = pending.clubIds.map(getClub).filter((c) => c !== undefined);

  return (
    <div className="flex h-full w-full flex-col items-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div>
        <p className="text-sm text-white/50">{KIND_LABEL[pending.kind] ?? 'Clubs'}</p>
        <h1 className="text-2xl font-extrabold tracking-wide">Choose your club</h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">{pending.detail}</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {offers.map((club) => (
          <button
            key={club.id}
            type="button"
            onClick={() => resolveTransferChoice(club.id)}
            className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 text-left backdrop-blur transition active:scale-[0.98]"
            style={{ borderLeft: `4px solid ${club.color}` }}
          >
            <div className="flex-1">
              <p className="font-bold">{club.name}</p>
              <p className="text-xs text-white/50">
                {club.country} · {club.league}
              </p>
            </div>
          </button>
        ))}
      </div>

      {pending.allowDecline && currentClub && (
        <button
          type="button"
          onClick={() => resolveTransferChoice(null)}
          className="rounded-2xl bg-white/10 px-6 py-3 text-sm font-semibold text-white/80 backdrop-blur transition active:scale-[0.98]"
        >
          Stay at {currentClub.name}
        </button>
      )}
    </div>
  );
}
