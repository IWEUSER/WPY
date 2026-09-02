import { getClub, TIER_LABEL } from '../data/clubs';
import { formatEuros, formatWeeklyWage } from '../playerValue';
import { useCareerStore } from '../store';
import type { ClubOfferTerms } from '../transfers';

const KIND_LABEL: Record<string, string> = {
  loan: 'Loan offers',
  sold: 'Interested clubs',
  'promotion-offer': 'Transfer offers',
  'loan-or-transfer': 'Loan and transfer offers',
  'end-of-season': 'Transfer window',
};

function OfferCard({
  offer,
  clubId,
  onPick,
  compact,
}: {
  offer: ClubOfferTerms;
  clubId: string | null;
  onPick: (id: string) => void;
  compact?: boolean;
}) {
  const club = getClub(offer.clubId);
  if (!club) return null;
  const isCurrentClubRenewal = Boolean(offer.renewal) || (offer.move === 'permanent' && offer.clubId === clubId);
  return (
    <button
      type="button"
      onClick={() => onPick(club.id)}
      className={`flex items-center gap-3 rounded-2xl border border-white/30 bg-[#050807] text-left shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur transition active:scale-[0.98] ${compact ? 'p-3' : 'p-4'}`}
      style={{ borderLeft: `4px solid ${club.color}` }}
    >
      <div className="min-w-0 flex-1">
        <p className={`font-bold ${compact ? 'text-sm leading-tight' : ''}`}>{club.name}</p>
        <p className="text-[11px] text-white/50">
          {club.country} · {club.league}
        </p>
        <p className={`mt-1 text-white/70 ${compact ? 'text-[11px] leading-snug' : 'text-xs'}`}>
          {offer.move === 'loan' ? 'Loan' : offer.fee <= 0 ? 'Free' : `Fee ${formatEuros(offer.fee)}`}
          {' · '}
          {formatWeeklyWage(offer.weeklyWage)}
          {offer.contractYears > 0
            ? ` · ${offer.contractYears}-year ${offer.move === 'loan' ? 'loan' : 'contract'}`
            : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
          {offer.move === 'loan' ? 'Loan' : isCurrentClubRenewal ? 'New contract' : 'Transfer'}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-white/40">{TIER_LABEL[club.tier]}</span>
      </div>
    </button>
  );
}

export default function TransferChoiceScreen() {
  const pending = useCareerStore((s) => s.pendingTransfer);
  const clubId = useCareerStore((s) => s.clubId);
  const resolveTransferChoice = useCareerStore((s) => s.resolveTransferChoice);

  const currentClub = clubId ? getClub(clubId) : undefined;
  if (!pending) return null;

  const stayClub = pending.stay?.clubId ? getClub(pending.stay.clubId) : currentClub;
  const offers = (pending.offers?.length
    ? pending.offers
    : pending.clubIds.map((id) => ({ clubId: id, move: 'permanent' as const, fee: 0, weeklyWage: 0, contractYears: 0, renewal: false }))
  );
  const renewalOffer = offers.find((o) => o.renewal && o.clubId === clubId) ?? null;
  const otherOffers = offers.filter((o) => o !== renewalOffer);
  const stayYears = pending.stay?.contractYearsRemaining;
  const showStay = Boolean(pending.allowDecline && stayClub);
  const featuredPair = Boolean(renewalOffer && showStay);

  return (
    <div className="flex h-full w-full flex-col items-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div>
        <p className="text-sm text-white/50">{KIND_LABEL[pending.kind] ?? 'Clubs'}</p>
        <h1 className="font-display text-2xl font-bold">Choose your club</h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">{pending.detail}</p>
      </div>

      {(renewalOffer || showStay) && (
        <div className={`grid w-full max-w-md gap-3 ${featuredPair ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {renewalOffer && (
            <OfferCard
              offer={renewalOffer}
              clubId={clubId}
              onPick={(id) => resolveTransferChoice(id)}
              compact={featuredPair}
            />
          )}
          {showStay && stayClub && (
            <button
              type="button"
              onClick={() => resolveTransferChoice(null)}
              className={`flex items-center gap-3 rounded-2xl border border-white/20 bg-[#050807] text-left shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur transition active:scale-[0.98] ${featuredPair ? 'p-3' : 'p-4'}`}
              style={{ borderLeft: `4px solid ${stayClub.color}` }}
            >
              <div className="min-w-0 flex-1">
                <p className={`font-bold ${featuredPair ? 'text-sm leading-tight' : ''}`}>{stayClub.name}</p>
                <p className="text-[11px] text-white/50">
                  {stayClub.country} · {stayClub.league}
                </p>
                <p className={`mt-1 text-white/70 ${featuredPair ? 'text-[11px] leading-snug' : 'text-xs'}`}>
                  {renewalOffer && stayYears != null
                    ? `Keep the current deal · ${stayYears} year${stayYears === 1 ? '' : 's'} left`
                    : 'Stay at this club'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                  {renewalOffer ? 'No renew' : 'Stay'}
                </span>
              </div>
            </button>
          )}
        </div>
      )}

      {otherOffers.length > 0 && (
        <div className="flex w-full max-w-sm flex-col gap-3">
          {otherOffers.map((offer) => (
            <OfferCard
              key={`${offer.move}-${offer.clubId}`}
              offer={offer}
              clubId={clubId}
              onPick={(id) => resolveTransferChoice(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
