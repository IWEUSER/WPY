import { getClub } from '../data/clubs';
import { currentCalendarWeek } from '../calendar';
import { careerAwardCounts, careerTrophyCounts } from '../honoursDisplay';
import { identityLegacyBoards } from '../legacyRecords';
import { formatEuros, formatWeeklyWage, playerMarketValueFromSeasons, transferFeeFromValue } from '../playerValue';
import { countsTowardCareerRecord } from '../seasonDisplay';
import { getNation } from '../international';
import { useCareerStore } from '../store';
import { DATA_CARD, DATA_TILE } from './dataUi';
import { HonoursPills } from './HonoursPills';

export default function ProfileScreen() {
  const history = useCareerStore((s) => s.seasonHistory);
  const current = useCareerStore((s) => s.currentSeason);
  const careerGoals = useCareerStore((s) => s.careerGoals);
  const careerGames = useCareerStore((s) => s.careerGames);
  const nationalTeam = useCareerStore((s) => s.nationalTeam);
  const nationality = useCareerStore((s) => s.nationality);
  const clubId = useCareerStore((s) => s.clubId);
  const age = useCareerStore((s) => s.age);
  const careerEarnings = useCareerStore((s) => s.careerEarnings);
  const weeklyWage = useCareerStore((s) => s.weeklyWage);
  const contractYearsRemaining = useCareerStore((s) => s.contractYearsRemaining);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const seasonCalendar = useCareerStore((s) => s.seasonCalendar);
  const seasonSim = useCareerStore((s) => s.seasonSim);
  const returnFromProfile = useCareerStore((s) => s.returnFromProfile);
  const openLegacy = useCareerStore((s) => s.openLegacy);
  const careerStart = useCareerStore((s) => s.careerStart);
  const playerName = useCareerStore((s) => s.playerName);
  const role = useCareerStore((s) => s.role);

  const recordSeasons = [...history, ...(current && countsTowardCareerRecord(current.seasonNumber, current.role) ? [current] : [])];
  const scoredSeasons = recordSeasons.filter((season) => countsTowardCareerRecord(season.seasonNumber, season.role));
  const trophies = careerTrophyCounts(scoredSeasons);
  const awards = careerAwardCounts(scoredSeasons);
  const nation = nationality ? getNation(nationality) : undefined;
  const club = clubId ? getClub(clubId) : undefined;
  const week = seasonCalendar && seasonSim
    ? currentCalendarWeek(seasonCalendar, seasonSim.fixtureIndex)
    : current?.gamesPlayed ?? 0;
  const value =
    club && careerGames > 0
      ? playerMarketValueFromSeasons({
          age,
          careerGoals,
          careerGames,
          seasons: [...history, ...(current ? [current] : [])],
          fallbackClub: club,
          contractYearsRemaining,
          seasonNumber,
          calendarWeek: week,
          careerStart,
          role: current?.role ?? role,
        })
      : null;
  const fee = value != null ? transferFeeFromValue(value, contractYearsRemaining) : null;
  const name = playerName?.trim() || 'Player';
  const legacy = identityLegacyBoards({
    seasons: scoredSeasons,
    nationalTeam,
    nationality,
    playerName: name,
  });

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-5 py-[max(1.25rem,env(safe-area-inset-top))] pb-10 text-white">
      <div className="mb-5 flex items-center justify-between">
        <button type="button" onClick={returnFromProfile} className="text-xs text-white/40 underline underline-offset-2">
          Back
        </button>
        <span className="text-xs uppercase tracking-wide text-white/40">Profile</span>
      </div>

      <p className="text-xs uppercase tracking-wide text-white/40">Career identity</p>
      <h1 className="mt-1 font-display text-3xl font-bold">{name}</h1>
      <p className="mt-1 text-sm text-white/55">
        {nation?.name ?? 'No nationality'}
        {club ? ` · ${club.name}` : ''}
        {` · Age ${age}`}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className={DATA_TILE}>
          <p className="text-lg font-bold">{formatEuros(careerEarnings)}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Earnings</p>
        </div>
        <div className={DATA_TILE}>
          <p className="text-lg font-bold">{weeklyWage > 0 ? formatWeeklyWage(weeklyWage) : '—'}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Wage</p>
        </div>
      </div>
      {value != null && (
        <p className="mt-2 text-center text-xs text-white/45">
          Market value {formatEuros(value)}
          {fee != null ? ` · Transfer fee ${fee <= 0 ? 'Free' : formatEuros(fee)}` : ''}
        </p>
      )}

      {nationalTeam && (
        <section className={`mt-4 ${DATA_CARD}`}>
          <p className="text-xs uppercase tracking-wide text-white/40">International</p>
          <p className="mt-1 text-lg font-bold">
            {nationalTeam.caps} caps · {nationalTeam.goals} goals
          </p>
          <p className="mt-1 text-xs text-white/45">{nation?.name ?? 'National team'}</p>
        </section>
      )}

      <HonoursPills title="Trophies" items={trophies} empty="No trophies yet" tone="trophy" />
      <HonoursPills title="Awards" items={awards} empty="No awards yet" tone="award" />

      {legacy.length > 0 && (
        <section className="mt-3 rounded-2xl border border-amber-200/25 bg-amber-400/10 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-200/70">Legacy</p>
          <ul className="mt-2 space-y-2">
            {legacy.map((board) => (
              <li key={board.def.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold text-amber-100">
                  {board.def.title}
                  <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-white/45">
                    {board.def.subtitle}
                  </span>
                </span>
                <span className="shrink-0 text-right text-amber-200">
                  {board.rankLabel}
                  <span className="block text-[10px] text-white/50">{board.playerGoals} goals</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" onClick={openLegacy} className={`mt-4 w-full ${DATA_CARD} text-left`}>
        <p className="text-xs uppercase tracking-wide text-amber-200/70">Records</p>
        <p className="mt-1 text-lg font-extrabold">Tournaments played</p>
        <p className="mt-1 text-sm text-white/55">All-time boards for competitions you have appeared in.</p>
      </button>
    </div>
  );
}
