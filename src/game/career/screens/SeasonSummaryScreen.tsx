import { getClub } from '../data/clubs';
import { formatEuros } from '../playerValue';
import { CONTINENTAL_CUPS, DOMESTIC_CUPS, INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { displaySeasonLabel, displaySeasonNumber } from '../seasonDisplay';
import { countLoanSpells, resolveSeasonTransition } from '../transfers';
import { leagueMatchWeeks } from '../data/clubs';
import { useCareerStore } from '../store';

export default function SeasonSummaryScreen() {
  const clubId = useCareerStore((s) => s.clubId);
  const parentClubId = useCareerStore((s) => s.parentClubId);
  const season = useCareerStore((s) => s.currentSeason);
  const role = useCareerStore((s) => s.role);
  const seasonsAtCurrentClub = useCareerStore((s) => s.seasonsAtCurrentClub);
  const age = useCareerStore((s) => s.age);
  const careerGoals = useCareerStore((s) => s.careerGoals);
  const careerGames = useCareerStore((s) => s.careerGames);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const seasonCalendar = useCareerStore((s) => s.seasonCalendar);
  const seasonSim = useCareerStore((s) => s.seasonSim);
  const seasonStandings = useCareerStore((s) => s.seasonStandings);
  const wpyResult = useCareerStore((s) => s.wpyResult);
  const nationality = useCareerStore((s) => s.nationality);
  const seasonHistory = useCareerStore((s) => s.seasonHistory);
  const continueAfterSeason = useCareerStore((s) => s.continueAfterSeason);
  const lastMatchSummary = useCareerStore((s) => s.lastMatchSummary);
  const contractYearsRemaining = useCareerStore((s) => s.contractYearsRemaining);

  const club = clubId ? getClub(clubId) : undefined;
  if (!club || !season || !clubId || !parentClubId) return null;

  const ratio = season.gamesPlayed > 0 ? season.goals / season.gamesPlayed : 0;
  const threshold = role === 'first-team' ? club.firstTeamGoalRatio : club.reserveGoalRatio;
  const scheduled = seasonCalendar?.fixtures.length ?? leagueMatchWeeks(club.league);
  const gamesMissed = Math.max(0, scheduled - season.gamesPlayed);
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
  });

  const honours: string[] = [];
  if (seasonSim?.honours.leagueChampion) honours.push(`Won ${club.league}`);
  if (seasonSim?.honours.continentalChampion) {
    honours.push(`Won the ${CONTINENTAL_CUPS[seasonSim.honours.continentalChampion].name}`);
  }
  if (seasonSim?.honours.superCup) honours.push('Won the Super Cup');
  if (seasonSim?.honours.internationalChampion) {
    honours.push(`Won the ${INTERNATIONAL_TOURNAMENTS[seasonSim.honours.internationalChampion].name}`);
  } else if (seasonSim?.internationalSelected && seasonSim.internationalTournament && seasonSim.internationalStage === 'qualified') {
    honours.push(`Qualified for the ${INTERNATIONAL_TOURNAMENTS[seasonSim.internationalTournament].name}`);
  }
  if (seasonSim?.honours.domesticCup) {
    honours.push(`Won the ${DOMESTIC_CUPS[seasonSim.honours.domesticCup].name}`);
  }
  if (season.topGoalscorer) honours.push('Top goalscorer');
  if (season.playerOfTheYear) honours.push('Player of the Year');
  const missedTournament =
    seasonSim?.internationalSelected &&
    seasonSim.internationalTournament &&
    seasonSim.internationalStage === 'failed-qualifying'
      ? `Did not qualify for the ${INTERNATIONAL_TOURNAMENTS[seasonSim.internationalTournament].name}`
      : null;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto px-6 py-10 text-center text-white">
      <div>
        <p className="text-xs uppercase tracking-wide text-white/40">{displaySeasonLabel(seasonNumber)} complete</p>
        <h1 className="mt-1 text-2xl font-extrabold">{preview.headline}</h1>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-white/5 p-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xl font-bold">{season.goals}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Goals</p>
          </div>
          <div>
            <p className="text-xl font-bold">{season.gamesPlayed}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Played</p>
          </div>
          <div>
            <p className="text-xl font-bold">{gamesMissed}</p>
            <p className="text-[10px] uppercase tracking-wide text-white/40">Missed</p>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold text-white/80">
          Ratio: {ratio.toFixed(2)} / {threshold.toFixed(2)} required
        </p>
        {(season.earnings ?? 0) > 0 && (
          <p className="mt-1 text-xs text-white/50">Earned {formatEuros(season.earnings ?? 0)} this season</p>
        )}
        {us && (
          <p className="mt-2 text-xs text-white/50">
            Finished {us.position}{ordinal(us.position)} · {us.points} pts
            {seasonStandings?.europeanStanding
              ? ` · ${CONTINENTAL_CUPS[seasonStandings.europeanStanding.cup].name}: ${seasonStandings.europeanStanding.stage}`
              : ''}
          </p>
        )}
      </div>

      {honours.length > 0 && (
        <div className="w-full max-w-sm rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {honours.join(' · ')}
        </div>
      )}

      {missedTournament && (
        <div className="w-full max-w-sm rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/60">
          {missedTournament}
        </div>
      )}

      {wpyResult && (
        <div
          className={`w-full max-w-sm rounded-2xl px-4 py-3 text-sm ${
            wpyResult.won ? 'bg-amber-400/15 text-amber-200' : 'bg-white/5 text-white/60'
          }`}
        >
          <p className="text-xs uppercase tracking-wide text-white/40">World Player of the Year</p>
          <p className="mt-1 font-semibold">{wpyResult.won ? 'You won it.' : 'Not this season.'}</p>
          <p className="mt-1 text-xs">{wpyResult.reason}</p>
        </div>
      )}

      {lastMatchSummary && (
        <div className="w-full max-w-sm rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/80">{lastMatchSummary}</div>
      )}

      <p className="max-w-sm text-sm text-white/60">{preview.detail}</p>

      <button
        type="button"
        onClick={continueAfterSeason}
        className="rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        Continue to {displaySeasonNumber(seasonNumber + 1) === null ? 'the first team' : `Season ${displaySeasonNumber(seasonNumber + 1)}`}
      </button>
    </div>
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
