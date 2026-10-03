import { useEffect, useRef } from 'react';
import { clubQualityLabel, getClub } from '../data/clubs';
import { leagueDisplayName } from '../data/leagueFormat';
import { formatEuros, formatWeeklyWage, playerMarketValueFromSeasons, transferFeeFromValue } from '../playerValue';
import { defaultSquadStatus, squadStatusOnArrival, SQUAD_STATUS_LABEL } from '../squadStatus';
import { useCareerStore } from '../store';
import type { ClubOfferTerms } from '../transfers';
import type { SquadStatus } from '../types';

const KIND_LABEL: Record<string, string> = {
  loan: 'Loan offers',
  sold: 'Interested clubs',
  'promotion-offer': 'Transfer offers',
  'loan-or-transfer': 'Loan and transfer offers',
  'end-of-season': 'Transfer window',
  'trial-offers': 'Transfer offers',
};

function wageVsHome(offerWage: number, homeWage: number): string {
  const delta = offerWage - homeWage;
  if (delta === 0) return 'Same weekly wage as your club';
  if (delta > 0) return `${formatWeeklyWage(delta)} more than your club`;
  return `${formatWeeklyWage(Math.abs(delta))} less than your club`;
}

function OfferCard({
  offer,
  clubId,
  onPick,
  compact,
  likelyStatus,
  homeWage,
}: {
  offer: ClubOfferTerms;
  clubId: string | null;
  onPick: (id: string) => void;
  compact?: boolean;
  likelyStatus?: SquadStatus;
  homeWage?: number;
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
          {club.country} · {leagueDisplayName(club.league)}
        </p>
        <p className={`mt-1 text-white/70 ${compact ? 'text-[11px] leading-snug' : 'text-xs'}`}>
          {offer.move === 'loan' ? 'Loan · current wage' : offer.fee <= 0 ? 'Free' : `Fee ${formatEuros(offer.fee)}`}
          {' · '}
          {formatWeeklyWage(offer.weeklyWage)}
          {offer.contractYears > 0
            ? ` · ${offer.contractYears}-year ${offer.move === 'loan' ? 'loan' : 'contract'}`
            : ''}
          {likelyStatus ? ` · ${SQUAD_STATUS_LABEL[likelyStatus]}` : ''}
        </p>
        <p className={`mt-1 text-white/40 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {isCurrentClubRenewal
            ? 'New contract offer'
            : homeWage != null && homeWage > 0
              ? wageVsHome(offer.weeklyWage, homeWage)
              : 'Agree personal terms'}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">
          {offer.move === 'loan' ? 'Loan' : isCurrentClubRenewal ? 'New contract' : 'Transfer'}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-white/40">{clubQualityLabel(club)}</span>
      </div>
    </button>
  );
}

export default function TransferChoiceScreen() {
  const pending = useCareerStore((s) => s.pendingTransfer);
  const clubId = useCareerStore((s) => s.clubId);
  const lastTransferRejection = useCareerStore((s) => s.lastTransferRejection);
  const resolveTransferChoice = useCareerStore((s) => s.resolveTransferChoice);
  const currentSeason = useCareerStore((s) => s.currentSeason);
  const currentWeeklyWage = useCareerStore((s) => s.weeklyWage);
  const age = useCareerStore((s) => s.age);
  const careerGoals = useCareerStore((s) => s.careerGoals);
  const careerGames = useCareerStore((s) => s.careerGames);
  const seasonHistory = useCareerStore((s) => s.seasonHistory);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const careerStart = useCareerStore((s) => s.careerStart);
  const role = useCareerStore((s) => s.role);
  const contractYearsRemaining = useCareerStore((s) => s.contractYearsRemaining);
  const homeContractYearsRemaining = useCareerStore((s) => s.homeContractYearsRemaining);
  const parentClubId = useCareerStore((s) => s.parentClubId);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rejectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lastTransferRejection && !pending?.rejectionDetail) return;
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollTop = 0;
      scroller.scrollTo({ top: 0, behavior: 'auto' });
    }
    rejectionRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [lastTransferRejection, pending?.rejectionDetail]);

  const currentClub = clubId ? getClub(clubId) : undefined;
  if (!pending) return null;

  const stayClub = pending.stay?.clubId ? getClub(pending.stay.clubId) : currentClub;
  const offers = (pending.offers?.length
    ? pending.offers
    : pending.clubIds.map((id) => ({ clubId: id, move: 'permanent' as const, fee: 0, weeklyWage: 0, contractYears: 0, renewal: false }))
  );
  const renewalOffer = offers.find((o) => o.renewal && o.clubId === clubId) ?? null;
  const otherOffers = offers.filter((o) => o !== renewalOffer);
  const keepDealWage = currentWeeklyWage > 0
    ? currentWeeklyWage
    : (pending.stay?.weeklyWage != null && pending.stay.weeklyWage > 0 ? pending.stay.weeklyWage : 0);
  const homeWage = renewalOffer?.weeklyWage
    || (keepDealWage > 0 ? keepDealWage : undefined);
  const stayYears = pending.stay?.contractYearsRemaining;
  const outOfContract = stayYears != null && stayYears <= 0;
  const showStay = Boolean(pending.allowDecline && pending.stay && stayClub && !outOfContract);
  const nextIfStay = pending.stay?.squadStatus ?? defaultSquadStatus('first-team');
  const fromClub = clubId ? getClub(clubId) : undefined;
  const valueClub = (role === 'loan' ? getClub(parentClubId ?? '') : fromClub) ?? fromClub;
  const askingLine = (() => {
    if (!valueClub || !currentSeason) return null;
    const value = playerMarketValueFromSeasons({
      age,
      careerGoals,
      careerGames,
      seasons: [...seasonHistory, currentSeason],
      fallbackClub: valueClub,
      contractYearsRemaining,
      seasonNumber,
      calendarWeek: 99,
      careerStart,
      role,
    });
    const feeYears = role === 'loan' && homeContractYearsRemaining != null && homeContractYearsRemaining > 0
      ? homeContractYearsRemaining
      : contractYearsRemaining;
    const asking = transferFeeFromValue(value, feeYears ?? 0);
    return (
      <p className="mt-1 text-xs text-white/45">
        Market value {formatEuros(value)}
        {` · Transfer value ${asking <= 0 ? 'Free' : formatEuros(asking)}`}
      </p>
    );
  })();
  const playerRatio = currentSeason && currentSeason.gamesPlayed > 0
    ? currentSeason.goals / currentSeason.gamesPlayed
    : undefined;
  const likelyFor = (offer: ClubOfferTerms): SquadStatus => {
    if (offer.renewal || offer.clubId === clubId) return nextIfStay;
    if (offer.squadStatus) return offer.squadStatus;
    return squadStatusOnArrival({
      fromClub,
      toClub: getClub(offer.clubId),
      move: offer.move,
      nextIfStay,
      playerRatio,
    });
  };

  return (
    <div ref={scrollerRef} className="flex h-full w-full flex-col items-center gap-6 overflow-y-auto px-6 py-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
      <div>
        <h1 className="font-display text-2xl font-bold">Choose your next move</h1>
        <p className="mt-2 max-w-sm text-sm text-white/60">{KIND_LABEL[pending.kind] ?? 'Clubs'}</p>
        <p className="mt-2 max-w-sm text-xs text-white/45">
          Compare each weekly wage with your current contract before you decide.
        </p>
        {keepDealWage > 0 && (
          <p className="mt-2 text-sm font-semibold text-emerald-200/90">
            Your current contract · {formatWeeklyWage(keepDealWage)}
          </p>
        )}
        {askingLine}
        {renewalOffer && renewalOffer.weeklyWage > 0 && renewalOffer.weeklyWage !== keepDealWage && (
          <p className="text-xs text-white/50">
            New contract offer · {formatWeeklyWage(renewalOffer.weeklyWage)}
          </p>
        )}
      </div>

      {(lastTransferRejection || pending.rejectionDetail) && (
        <div
          ref={rejectionRef}
          className="w-full max-w-md rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
        >
          {lastTransferRejection ?? pending.rejectionDetail}
        </div>
      )}

      {(renewalOffer || showStay) && (
        <div className="flex w-full max-w-sm flex-col gap-3">
          {renewalOffer && (
            <OfferCard
              offer={renewalOffer}
              clubId={clubId}
              onPick={(id) => resolveTransferChoice(id)}
              likelyStatus={likelyFor(renewalOffer)}
              homeWage={keepDealWage > 0 ? keepDealWage : homeWage}
            />
          )}
          {showStay && stayClub && (
            <button
              type="button"
              onClick={() => resolveTransferChoice(null)}
              className="flex items-center gap-3 rounded-2xl border border-white/20 bg-[#050807] p-4 text-left shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur transition active:scale-[0.98]"
              style={{ borderLeft: `4px solid ${stayClub.color}` }}
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold">{stayClub.name}</p>
                <p className="text-[11px] text-white/50">
                  {stayClub.country} · {leagueDisplayName(stayClub.league)}
                </p>
                <p className="mt-1 text-xs text-white/70">
                  {renewalOffer && stayYears != null
                    ? `Keep the current deal · ${stayYears} year${stayYears === 1 ? '' : 's'} left`
                    : pending.stay?.clubId && pending.stay.clubId !== clubId
                      ? 'Return to parent club'
                      : 'Stay at this club'}
                  {keepDealWage > 0 ? ` · ${formatWeeklyWage(keepDealWage)}` : ''}
                  {` · ${SQUAD_STATUS_LABEL[nextIfStay]}`}
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
              likelyStatus={likelyFor(offer)}
              homeWage={keepDealWage > 0 ? keepDealWage : homeWage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
