import { RETIREMENT_AGE } from '../constants';
import { getClub } from '../data/clubs';
import { leagueDisplayName } from '../data/leagueFormat';
import { formatEuros, formatWeeklyWage } from '../playerValue';
import { CONTINENTAL_CUPS, DOMESTIC_CUPS, INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { awardLabels, competitionStageLabel, tournamentOutcomeLabel } from '../honoursDisplay';
import { displaySeasonLabel, displaySeasonNumber } from '../seasonDisplay';
import { RISING_STAR_MIN_RATIO, seasonOverridesRatioBar, seasonRatioClearsBar } from '../squadStatus';
import { countLoanSpells, requiredGoalRatio, resolveSeasonTransition } from '../transfers';
import { goalsLabel, inputWithoutSeason, seasonLegacyHighlights } from '../legacyRecords';
import { useCareerStore } from '../store';
import { DATA_CARD, DATA_INSET, DATA_TILE } from './dataUi';

export default function SeasonSummaryScreen() {
  const clubId = useCareerStore((s) => s.clubId);
  const parentClubId = useCareerStore((s) => s.parentClubId);
  const season = useCareerStore((s) => s.currentSeason);
  const role = useCareerStore((s) => s.role);
  const squadStatus = useCareerStore((s) => s.squadStatus);
  const seasonsAtCurrentClub = useCareerStore((s) => s.seasonsAtCurrentClub);
  const age = useCareerStore((s) => s.age);
  const careerGoals = useCareerStore((s) => s.careerGoals);
  const careerGames = useCareerStore((s) => s.careerGames);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const seasonSim = useCareerStore((s) => s.seasonSim);
  const seasonStandings = useCareerStore((s) => s.seasonStandings);
  const wpyResult = useCareerStore((s) => s.wpyResult);
  const nationality = useCareerStore((s) => s.nationality);
  const nationalTeam = useCareerStore((s) => s.nationalTeam);
  const playerName = useCareerStore((s) => s.playerName);
  const seasonHistory = useCareerStore((s) => s.seasonHistory);
  const continueAfterSeason = useCareerStore((s) => s.continueAfterSeason);
  const contractYearsRemaining = useCareerStore((s) => s.contractYearsRemaining);
  const homeContractYearsRemaining = useCareerStore((s) => s.homeContractYearsRemaining);
  const clubLeague = useCareerStore((s) => s.clubLeague);
  const seasonSponsorship = useCareerStore((s) => s.seasonSponsorship);
  const careerStart = useCareerStore((s) => s.careerStart);

  const club = clubId ? getClub(clubId) : undefined;
  if (!club || !season || !clubId || !parentClubId) return null;

  const parentClub = getClub(parentClubId);
  const ratio = season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
  const threshold = requiredGoalRatio(role, club, parentClub);
  const us = seasonStandings?.league.find((r) => r.clubId === clubId);

  const preview = resolveSeasonTransition({
    season,
    role,
    clubId,
    parentClubId,
    seasonsAtCurrentClub,
    age,
    careerGoals,
    careerGames,
    nationality,
    loansUsed: countLoanSpells(seasonHistory, season),
    seasonHistory,
    contractYearsRemaining,
    leaguePosition: us?.position ?? null,
    clubLeague,
    homeContractYearsRemaining,
    careerStart,
    squadStatus,
  });

  const honours: string[] = [];
  if (seasonSim?.honours.leagueChampion) {
    honours.push(
      `Won ${clubLeague === 'MLS' || club.league === 'MLS' ? 'MLS Cup' : leagueDisplayName(clubLeague ?? club.league)}`,
    );
  }
  if (seasonSim?.honours.continentalChampion) {
    honours.push(`Won the ${CONTINENTAL_CUPS[seasonSim.honours.continentalChampion].name}`);
  }
  if (seasonSim?.honours.superCup) honours.push('Won the Super Cup');
  if (seasonSim?.honours.domesticSuperCup) honours.push(`Won the ${seasonSim.honours.domesticSuperCup}`);
  if (seasonSim?.honours.internationalChampion) {
    honours.push(`Won the ${INTERNATIONAL_TOURNAMENTS[seasonSim.honours.internationalChampion].name}`);
  } else if (seasonSim?.internationalSelected && seasonSim.internationalTournament && seasonSim.internationalStage === 'qualified') {
    honours.push(`Qualified for the ${INTERNATIONAL_TOURNAMENTS[seasonSim.internationalTournament].name}`);
  }
  if (seasonSim?.honours.domesticCup) {
    honours.push(`Won the ${DOMESTIC_CUPS[seasonSim.honours.domesticCup].name}`);
  }
  if (season.international?.playerOfTheTournament && season.international.tournament) {
    honours.push(
      `${INTERNATIONAL_TOURNAMENTS[season.international.tournament].name} Player of the Tournament`,
    );
  }
  if (season.international?.topGoalscorer && season.international.tournament) {
    honours.push(`${INTERNATIONAL_TOURNAMENTS[season.international.tournament].name} top goalscorer`);
  }
  const awards = [
    ...awardLabels(season),
    ...(season.wonWpy || wpyResult?.won ? ['World Player of the Year'] : []),
  ];
  const missedTournament =
    seasonSim?.internationalSelected &&
    seasonSim.internationalTournament &&
    seasonSim.internationalStage === 'failed-qualifying'
      ? `Did not qualify for the ${INTERNATIONAL_TOURNAMENTS[seasonSim.internationalTournament].name}`
      : null;

  const leaguePlace = us && us.played > 0 ? `${us.position}${ordinal(us.position)}` : '—';
  const domesticName = seasonSim?.domesticCup ? DOMESTIC_CUPS[seasonSim.domesticCup]?.name : null;
  const domesticOutcome = seasonSim?.honours.domesticCup
    ? 'Champions'
    : domesticName
      ? competitionStageLabel(seasonSim?.domesticCupStage)
      : '—';
  const intlName = season.international?.tournament
    ? INTERNATIONAL_TOURNAMENTS[season.international.tournament]?.name
    : seasonSim?.internationalTournament
      ? INTERNATIONAL_TOURNAMENTS[seasonSim.internationalTournament]?.name
      : null;
  const intlOutcome = (() => {
    if (season.international?.tournamentOutcome && season.international.tournamentOutcome !== 'none') {
      return tournamentOutcomeLabel(season.international.tournamentOutcome)
        ?? competitionStageLabel(season.international.tournamentOutcome);
    }
    if (missedTournament) return 'Did not qualify';
    if (seasonSim?.internationalSelected) {
      return competitionStageLabel(seasonSim.internationalReached ?? seasonSim.internationalStage);
    }
    return 'Not selected';
  })();
  const starterMet = seasonRatioClearsBar({
    ratio,
    gamesPlayed: season.gamesPlayed,
    bar: threshold,
    season,
  });
  const risingKept = seasonOverridesRatioBar(season) || ratio >= RISING_STAR_MIN_RATIO;
  const publicSeason = displaySeasonNumber(seasonNumber, { role, careerStart });
  const showRisingStarTrack = publicSeason === 1 || publicSeason === 2 || squadStatus === 'rising-star';

  const legacyInput = {
    seasons: [...seasonHistory, season],
    nationalTeam,
    nationality,
    playerName,
  };
  const legacyHighlights = seasonLegacyHighlights(inputWithoutSeason(legacyInput, season), legacyInput, season);
  const name = playerName?.trim() || 'You';

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-10 text-center text-white">
      <div>
        <p className="text-xs uppercase tracking-wide text-white/40">
          {displaySeasonLabel(seasonNumber, { role, careerStart })} complete
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">{preview.headline}</h1>
      </div>

      <div className={`w-full max-w-sm ${DATA_CARD}`}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className={DATA_TILE}>
            <p className="text-xl font-bold">{season.goals}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Goals</p>
          </div>
          <div className={DATA_TILE}>
            <p className="text-xl font-bold">{season.gamesPlayed}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Played</p>
          </div>
          <div className={DATA_TILE}>
            <p className="text-xl font-bold">{ratio.toFixed(2)}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Ratio</p>
          </div>
        </div>
        {(season.earnings ?? 0) > 0 && (
          <p className="mt-3 text-xs text-white/50">
            Earned {formatEuros(season.earnings ?? 0)} this season
            {(season.sponsorship ?? seasonSponsorship) > 0
              ? ` · ${formatEuros(season.sponsorship ?? seasonSponsorship)} sponsorship`
              : ''}
          </p>
        )}
      </div>

      <div className={`w-full max-w-sm ${DATA_CARD} text-left`}>
        <p className="text-xs uppercase tracking-wide text-white/40">Tournament outcomes</p>
        <div className="mt-2 space-y-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/55">League</span>
            <span className="font-semibold">{leaguePlace}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/55">{domesticName ?? 'Domestic cup'}</span>
            <span className="font-semibold">{domesticOutcome}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/55">{intlName ?? 'International'}</span>
            <span className="font-semibold">{intlOutcome}</span>
          </div>
        </div>
      </div>

      {honours.length > 0 && (
        <div className="w-full max-w-sm rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {honours.join(' · ')}
        </div>
      )}

      <div
        className={`w-full max-w-sm rounded-2xl border px-4 py-3 text-left text-sm ${
          awards.length > 0
            ? 'border-sky-300/25 bg-sky-500/10 text-sky-100'
            : 'border-white/16 bg-[#0c1410] text-white/60'
        }`}
      >
        <p className="text-xs uppercase tracking-wide text-white/40">Awards</p>
        {awards.length === 0 ? (
          <p className="mt-1 font-semibold">No awards yet</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {awards.map((name) => (
              <li key={name} className="font-semibold">{name}</li>
            ))}
          </ul>
        )}
      </div>

      {role !== 'reserve' || preview.immediate?.role === 'first-team' ? (
        <div className={`w-full max-w-sm ${DATA_INSET} text-left text-sm text-white/80`}>
          <p className="text-xs uppercase tracking-wide text-white/40">Club status</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Starter {threshold.toFixed(2)}</p>
              <p className="mt-0.5 text-xs text-white/50">
                {ratio.toFixed(2)} goals/game this season
              </p>
            </div>
            <StatusMark ok={starterMet} />
          </div>
          {showRisingStarTrack && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Rising star {RISING_STAR_MIN_RATIO.toFixed(2)}</p>
                <p className="mt-0.5 text-xs text-white/50">
                  {risingKept
                    ? `Retained for Season ${(publicSeason ?? 1) + 1}`
                    : 'Below the minimum to stay as a Rising star'}
                </p>
              </div>
              <StatusMark ok={risingKept} />
            </div>
          )}
          {!risingKept && showRisingStarTrack && (
            <p className="mt-3 text-xs text-white/55">
              You can stay as a reserve team player, or take a loan or transfer if offers come through when you continue.
            </p>
          )}
        </div>
      ) : null}

      {role !== 'loan' && (() => {
        const stay = preview.pendingTransfer?.stay ?? preview.immediate;
        const nextLeague = stay?.clubLeague;
        const promoted = Boolean(nextLeague && nextLeague !== (clubLeague ?? club.league));
        if (!promoted || !stay || age >= RETIREMENT_AGE) return null;
        const years = stay.contractYearsRemaining;
        return (
          <div className={`w-full max-w-sm ${DATA_INSET} text-sm text-white/80`}>
            <p className="text-xs uppercase tracking-wide text-white/40">If you stay</p>
            <p className="mt-1 font-semibold">
              {leagueDisplayName(nextLeague)}
              {stay.weeklyWage != null ? ` · ${formatWeeklyWage(stay.weeklyWage)}` : ''}
              {` · ${years} year${years === 1 ? '' : 's'} left`}
            </p>
          </div>
        );
      })()}

      {age >= RETIREMENT_AGE ? (
        <p className="max-w-sm text-sm text-white/60">This was your final season.</p>
      ) : showRisingStarTrack ? null : (
        <p className="max-w-sm text-sm text-white/60">{preview.detail}</p>
      )}

      {legacyHighlights.length > 0 && (
        <div className="flex w-full max-w-sm flex-col gap-2">
          {legacyHighlights.map((item) => (
            <div
              key={`${item.kind}-${item.title}-${item.subtitle}`}
              className="rounded-2xl border border-amber-200/25 bg-amber-400/10 px-4 py-3 text-left text-sm text-amber-100"
            >
              <p className="text-xs uppercase tracking-wide text-amber-200/70">
                {item.kind === 'season' ? 'Season record' : 'All-time top 10'}
              </p>
              <p className="mt-1 font-semibold">
                {name} · {item.rankLabel} · {item.title}
              </p>
              <p className="mt-1 text-xs text-white/55">
                {item.subtitle} · {goalsLabel(item.playerGoals)}
              </p>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={continueAfterSeason}
        className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        {age >= RETIREMENT_AGE
          ? 'View career'
          : `Continue to ${displaySeasonNumber(seasonNumber + 1, { role: role === 'reserve' ? 'first-team' : role, careerStart }) === null ? 'the first team' : `Season ${displaySeasonNumber(seasonNumber + 1, { role: role === 'reserve' ? 'first-team' : role, careerStart })}`}`}
      </button>
    </div>
  );
}

function StatusMark({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        ok ? 'bg-emerald-400 text-black' : 'bg-red-500/85 text-white'
      }`}
      aria-label={ok ? 'Met' : 'Not met'}
    >
      {ok ? '✓' : '✕'}
    </span>
  );
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  if (n % 10 === 1) return 'st';
  if (n % 10 === 2) return 'nd';
  if (n % 10 === 3) return 'rd';
  return 'th';
}
