import { getClub, TIER_LABEL } from '../data/clubs';
import { formatEuros, formatWeeklyWage } from '../playerValue';
import { useCareerStore } from '../store';

const KIND_LABEL: Record<string, string> = {
  loan: 'Loan offers',
  sold: 'Interested clubs',
  'promotion-offer': 'Transfer offers',
  'loan-or-transfer': 'Loan and transfer offers',
  'end-of-season': 'Transfer window',
};

export default function TransferChoiceScreen() {
  const pending = useCareerStore((s) => s.pendingTransfer);
  const clubId = useCareerStore((s) => s.clubId);
  const resolveTransferChoice = useCareerStore((s) => s.resolveTransferChoice);

  const currentClub = clubId ? getClub(clubId) : undefined;
  if (!pending) return null;

  const offers = (pending.offers?.length
    ? pending.offers
    : pending.clubIds.map((id) => ({ clubId: id, move: 'permanent' as const, fee: 0, weeklyWage: 0, contractYears: 0 }))
  );

  return (
    <div className="flex h-full w-full flex-col items-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div>
        <p className="text-sm text-white/50">{KIND_LABEL[pending.kind] ?? 'Clubs'}</p>
        <h1 className="text-2xl font-extrabold tracking-wide">Choose your club</h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">{pending.detail}</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {offers.map((offer) => {
          const club = getClub(offer.clubId);
          if (!club) return null;
          return (
            <button
              key={`${offer.move}-${club.id}`}
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
                <p className="mt-1 text-xs text-white/70">
                  {offer.move === 'loan' ? 'Loan' : offer.fee <= 0 ? 'Free' : `Fee ${formatEuros(offer.fee)}`}
                  {' · '}
                  {formatWeeklyWage(offer.weeklyWage)}
                  {offer.contractYears > 0
                    ? ` · ${offer.contractYears}-year ${offer.move === 'loan' ? 'loan' : 'contract'}`
                    : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                  {offer.move === 'loan' ? 'Loan' : 'Transfer'}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-white/40">{TIER_LABEL[club.tier]}</span>
              </div>
            </button>
          );
        })}
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
