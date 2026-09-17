import type { ReactNode } from 'react';
import { getClub } from '../data/clubs';
import { currentCalendarWeek } from '../calendar';
import { careerAwardCounts, careerTrophyCounts } from '../honoursDisplay';
import { goalsLabel, identityLegacyBoards } from '../legacyRecords';
import { formatEuros, formatWeeklyWage, playerMarketValueFromSeasons, transferFeeFromValue } from '../playerValue';
import { countsTowardCareerRecord } from '../seasonDisplay';
import { getNation } from '../international';
import { useCareerStore } from '../store';
import { DATA_CARD } from './dataUi';
import { AwardIcon, EarningsIcon, RecordsIcon, TrophyIcon, WageIcon } from './careerIcons';
import { HonoursPills } from './HonoursPills';
import { PlayerKitPortrait } from './PlayerKitPortrait';

function IdentityBox({
  title,
  icon,
  children,
  className = '',
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${DATA_CARD} ${className}`}>
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
        {icon}
        {title}
      </p>
      {children}
    </section>
  );
}

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

      <PlayerKitPortrait name={name} club={club} nation={nation} />

      <div className="mt-4 grid grid-cols-2 gap-2">
        <IdentityBox title="Earnings" icon={<EarningsIcon className="h-3.5 w-3.5" />} className="mt-0">
          <p className="mt-1 text-lg font-bold">{formatEuros(careerEarnings)}</p>
        </IdentityBox>
        <IdentityBox title="Wage" icon={<WageIcon className="h-3.5 w-3.5" />} className="mt-0">
          <p className="mt-1 text-lg font-bold">{weeklyWage > 0 ? formatWeeklyWage(weeklyWage) : '—'}</p>
        </IdentityBox>
      </div>
      {value != null && (
        <p className="mt-2 text-center text-xs text-white/45">
          Market value {formatEuros(value)}
          {fee != null ? ` · Transfer fee ${fee <= 0 ? 'Free' : formatEuros(fee)}` : ''}
        </p>
      )}

      {nationalTeam && (
        <IdentityBox title="International" className="mt-3">
          <p className="mt-1 text-lg font-bold">
            {nationalTeam.caps} cap{nationalTeam.caps === 1 ? '' : 's'} · {goalsLabel(nationalTeam.goals)}
          </p>
          <p className="mt-1 text-xs text-white/45">{nation?.name ?? 'National team'}</p>
        </IdentityBox>
      )}

      <HonoursPills
        title="Trophies"
        items={trophies}
        empty="No trophies yet"
        tone="trophy"
        icon={<TrophyIcon className="h-3.5 w-3.5" />}
      />
      <HonoursPills
        title="Awards"
        items={awards}
        empty="No awards yet"
        tone="award"
        icon={<AwardIcon className="h-3.5 w-3.5" />}
      />

      <button type="button" onClick={openLegacy} className={`mt-3 w-full text-left ${DATA_CARD}`}>
        <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/40">
          <RecordsIcon className="h-3.5 w-3.5" />
          Records
        </p>
        {legacy.length === 0 ? (
          <p className="mt-2 text-sm text-white/50">No records yet</p>
        ) : (
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
                  <span className="block text-[10px] text-white/50">{goalsLabel(board.playerGoals)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-white/45">All-time boards for competitions you have appeared in.</p>
      </button>
    </div>
  );
}
