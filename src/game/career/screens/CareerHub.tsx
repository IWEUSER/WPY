import { calendarDomesticCup, calendarIncludesInternational, currentCalendarWeek, type SeasonCalendar } from '../calendar';
import { getClub, leagueMatchWeeks } from '../data/clubs';
import { conferenceLabel, leagueDisplayName, mlsConferenceOf } from '../data/leagueFormat';
import { CONTINENTAL_CUPS, DOMESTIC_CUPS, INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { describeAvailability, isAvailable } from '../availabilityEngine';
import { describeInjury } from '../injury';
import { clubEligibleForNationalTeam, getNation, isSelectedForNationalTeam, seasonRatioForSelection, selectionRatioForNation } from '../international';
import type { SeasonStandings } from '../matchEngine';
import { displaySeasonLabel } from '../seasonDisplay';
import { formatEuros, formatWeeklyWage, playerMarketValueFromSeasons } from '../playerValue';
import { conferenceTable, fixtureTitle, internationalRoundLabel, nextPlayableFixture, type SeasonSimState } from '../seasonSim';
import { useCareerStore } from '../store';

const ROLE_LABEL: Record<string, string> = {
  reserve: 'Reserve Team',
  'first-team': 'First Team',
  loan: 'On Loan',
};

export default function CareerHub({ onOpenMenu }: { onOpenMenu: () => void }) {
  const age = useCareerStore((s) => s.age);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const clubId = useCareerStore((s) => s.clubId);
  const parentClubId = useCareerStore((s) => s.parentClubId);
  const role = useCareerStore((s) => s.role);
  const season = useCareerStore((s) => s.currentSeason);
  const seasonCalendar = useCareerStore((s) => s.seasonCalendar);
  const availability = useCareerStore((s) => s.availability);
  const nationality = useCareerStore((s) => s.nationality);
  const seasonStandings = useCareerStore((s) => s.seasonStandings);
  const seasonSim = useCareerStore((s) => s.seasonSim);
  const lastMatchSummary = useCareerStore((s) => s.lastMatchSummary);
  const careerGoals = useCareerStore((s) => s.careerGoals);
  const careerGames = useCareerStore((s) => s.careerGames);
  const seasonHistory = useCareerStore((s) => s.seasonHistory);
  const nationalTeam = useCareerStore((s) => s.nationalTeam);
  const careerEarnings = useCareerStore((s) => s.careerEarnings);
  const weeklyWage = useCareerStore((s) => s.weeklyWage);
  const contractYearsRemaining = useCareerStore((s) => s.contractYearsRemaining);
  const clubLeague = useCareerStore((s) => s.clubLeague);
  const seasonSponsorship = useCareerStore((s) => s.seasonSponsorship);
  const injuryGamesRemaining = useCareerStore((s) => s.injuryGamesRemaining);
  const advance = useCareerStore((s) => s.advance);
  const openCareerRecord = useCareerStore((s) => s.openCareerRecord);

  const club = clubId ? getClub(clubId) : undefined;
  const parentClub = role === 'loan' && parentClubId ? getClub(parentClubId) : undefined;
  const nation = nationality ? getNation(nationality) : undefined;
  if (!club || !season) return null;

  const played = season.gamesPlayed;
  const goals = season.goals;
  const ratio = played > 0 ? goals / played : 0;
  const threshold = role === 'first-team' ? club.firstTeamGoalRatio : club.reserveGoalRatio;
  const ratioProgress = Math.min(1, threshold > 0 ? ratio / threshold : 0);
  const injured = (injuryGamesRemaining ?? 0) > 0;
  const available = isAvailable(availability) && !injured;
  const week = seasonCalendar && seasonSim
    ? currentCalendarWeek(seasonCalendar, seasonSim.fixtureIndex)
    : season.matches.length + 1;
  const totalWeeks = seasonCalendar?.totalWeeks ?? leagueMatchWeeks(club.league);
  const nextFixture = seasonCalendar && seasonSim ? nextPlayableFixture(seasonCalendar, seasonSim) : undefined;
  const marketValue = playerMarketValueFromSeasons({
    age,
    careerGoals,
    careerGames,
    seasons: [...seasonHistory, season],
    fallbackClub: club,
    contractYearsRemaining,
    seasonNumber,
    calendarWeek: week,
  });

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-5 py-[max(1.25rem,env(safe-area-inset-top))] pb-10 text-white">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={onOpenMenu} className="text-xs text-white/40 underline underline-offset-2">
          Menu
        </button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={openCareerRecord} className="text-xs text-white/40 underline underline-offset-2">
            Career
          </button>
          <span className="text-xs text-white/40">Age {age}</span>
        </div>
      </div>

      <div className="rounded-2xl bg-white/5 p-4" style={{ borderLeft: `4px solid ${club.color}` }}>
        <p className="text-xs uppercase tracking-wide text-white/40">
          {displaySeasonLabel(seasonNumber)} · {ROLE_LABEL[role]}
          {seasonNumber >= 2 ? ` · Week ${week} of ${totalWeeks}` : ''}
        </p>
        <h1 className="text-2xl font-extrabold">{club.name}</h1>
        <p className="text-xs text-white/50">
          {club.country} · {leagueDisplayName(clubLeague ?? club.league)}
          {mlsConferenceOf(club.id) ? ` · ${conferenceLabel(mlsConferenceOf(club.id))}` : ''}
        </p>
        {nation && <p className="mt-1 text-xs text-white/50">International: {nation.name}</p>}
        {parentClub && <p className="mt-1 text-xs text-white/40">On loan from {parentClub.name}</p>}
        {seasonNumber >= 2 && (
          <p className="mt-1 text-xs text-white/50">Market value {formatEuros(marketValue)}</p>
        )}
        {(careerEarnings > 0 || weeklyWage > 0) && (
          <p className="mt-1 text-xs text-white/50">
            Earnings {formatEuros(careerEarnings)}
            {weeklyWage > 0 ? ` · ${formatWeeklyWage(weeklyWage)}` : ''}
          </p>
        )}
        {seasonSponsorship > 0 && (
          <p className="mt-1 text-xs text-white/50">Sponsorship {formatEuros(seasonSponsorship)} this season</p>
        )}
        <p className="mt-1 text-xs text-white/50">
          Contract {contractYearsRemaining} year{contractYearsRemaining === 1 ? '' : 's'} left
          {contractYearsRemaining <= 1 ? ' · expiring' : ''}
        </p>
        <SeasonCompetitions calendar={seasonCalendar} />
      </div>

      <button
        type="button"
        onClick={advance}
        className="mt-4 w-full rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        {available ? 'Play Next Match' : 'Continue'}
        {nextFixture && (
          <span className="mt-1 block text-xs font-medium text-black/70">
            {fixtureTitle(nextFixture, { playerNationName: nation?.name })}
            {nextFixture.kind === 'league' && nextFixture.opponentId === seasonSim?.titleRivalId
              ? ' · league rival'
              : ''}
          </span>
        )}
      </button>

      <div
        className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
          available ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
        }`}
      >
        {injured ? describeInjury(injuryGamesRemaining) : describeAvailability(availability)}
      </div>

      {seasonNumber >= 2 && (
        <div className="mt-3 rounded-xl bg-white/5 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wide text-white/40">Season week</span>
            <span className="text-sm font-bold">
              {week} / {totalWeeks}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${Math.min(100, (week / Math.max(1, totalWeeks)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {lastMatchSummary && (
        <div className="mt-3 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/80">{lastMatchSummary}</div>
      )}

      <div className="mt-5 flex flex-col gap-5">
        {seasonStandings && (
          <StandingsCard
            standings={seasonStandings}
            clubId={club.id}
            cupName={seasonSim?.domesticCup ? DOMESTIC_CUPS[seasonSim.domesticCup].name : null}
            cupStage={seasonSim?.domesticCupStage ?? null}
            sim={seasonSim}
          />
        )}

        <div className="rounded-2xl bg-white/5 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wide text-white/40">Season ratio</span>
            <span className="text-sm font-bold">
              {goals} goal{goals === 1 ? '' : 's'} / {played} played
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${ratioProgress >= 1 ? 'bg-emerald-400' : 'bg-amber-400'}`}
              style={{ width: `${ratioProgress * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-white/50">
            Need {threshold.toFixed(2)} goals/game to {role === 'first-team' ? 'keep your place' : 'earn a promotion'} ·
            currently {ratio.toFixed(2)}
          </p>
          {parentClub && (
            <p className="mt-2 text-xs text-emerald-300/80">
              Hit {parentClub.firstTeamGoalRatio.toFixed(2)} and {parentClub.name} will bring you straight back into
              their first team. Miss it and you choose another loan or a transfer — never the reserves.
            </p>
          )}
        </div>

        {nation && (
          <InternationalCard
            nationId={nationality!}
            nationName={nation.name}
            clubTier={club.tier}
            seasonNumber={seasonNumber}
            careerRatio={seasonRatioForSelection(season)}
            sim={seasonSim}
            caps={nationalTeam?.caps ?? 0}
            intlGoals={nationalTeam?.goals ?? 0}
          />
        )}

        <RecentForm matches={season.matches} />
      </div>
    </div>
  );
}

function StandingsCard({
  standings,
  clubId,
  cupName,
  cupStage,
  sim,
}: {
  standings: SeasonStandings;
  clubId: string;
  cupName: string | null;
  cupStage: string | null;
  sim: SeasonSimState | null;
}) {
  const conference = conferenceTable(standings.league, clubId);
  const us = (conference.length > 0 && mlsConferenceOf(clubId) ? conference : standings.league).find((r) => r.clubId === clubId);
  const europe = standings.europeanStanding;
  const stageLabel: Record<string, string> = {
    group: 'Group stage',
    'round-of-16': 'Round of 16',
    'quarter-final': 'Quarter-final',
    'semi-final': 'Semi-final',
    final: 'Final',
    eliminated: 'Eliminated',
    champion: 'Champions',
    'not-entered': '—',
  };

  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-white/40">Standings</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-2xl font-extrabold">{us && us.played > 0 ? `${us.position}` : '—'}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">
            {mlsConferenceOf(clubId) ? conferenceLabel(mlsConferenceOf(clubId)) : 'League position'}
          </p>
          {us && (
            <p className="mt-1 text-xs text-white/50">
              {us.points} pts · {us.played} played
            </p>
          )}
        </div>
        <div>
          <p className="text-lg font-bold leading-tight">
            {europe ? stageLabel[europe.stage] : sim?.leaguesCupStage && sim.leaguesCupStage !== 'not-entered'
              ? stageLabel[sim.leaguesCupStage] ?? sim.leaguesCupStage
              : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">
            {europe
              ? CONTINENTAL_CUPS[europe.cup].name
              : sim?.leaguesCupStage && sim.leaguesCupStage !== 'not-entered'
                ? 'Leagues Cup'
                : 'Continental'}
          </p>
        </div>
      </div>
      {cupName && cupStage && cupStage !== 'not-entered' && (
        <p className="mt-3 text-xs text-white/50">
          {cupName}: {stageLabel[cupStage] ?? cupStage}
        </p>
      )}
    </div>
  );
}

function InternationalCard({
  nationId,
  nationName,
  clubTier,
  seasonNumber,
  careerRatio,
  sim,
  caps,
  intlGoals,
}: {
  nationId: string;
  nationName: string;
  clubTier: 1 | 2 | 3 | 4 | 5;
  seasonNumber: number;
  careerRatio: number;
  sim: SeasonSimState | null;
  caps: number;
  intlGoals: number;
}) {
  const bar = selectionRatioForNation(nationId);
  const clubOk = clubEligibleForNationalTeam(clubTier);
  const inForm = isSelectedForNationalTeam({ clubTier, careerGoalRatio: careerRatio, nationId });
  const tournamentName = sim?.internationalTournament
    ? INTERNATIONAL_TOURNAMENTS[sim.internationalTournament].name
    : null;
  const campaignLine = (() => {
    if (seasonNumber < 2) return `${nationName} do not pick players during the reserve year.`;
    if (!clubOk) return `Call-ups are for players at a higher club level.`;
    if (!sim?.internationalSelected || !tournamentName) return null;
    if (sim.internationalStage === 'qualifying') {
      const carried = sim.qualifierCarryPlayed > 0 ? ` (plus ${sim.qualifierCarryPoints} pts carried)` : '';
      return `Qualifying for the ${tournamentName}: ${sim.qualifierPoints} pts from ${sim.qualifierPlayed}/${sim.qualifierTarget}${carried}.`;
    }
    if (sim.internationalStage === 'failed-qualifying') {
      return `Did not qualify for the ${tournamentName}.`;
    }
    if (sim.internationalStage === 'qualified') {
      return `Qualified for the ${tournamentName}. The finals are next cycle.`;
    }
    if (sim.internationalStage === 'champion') return `Won the ${tournamentName}.`;
    if (sim.internationalStage === 'eliminated') return `Out of the ${tournamentName}.`;
    if (sim.internationalStage === 'group') {
      return `${tournamentName} group: ${sim.groupPoints} pts from ${sim.groupPlayed} games.`;
    }
    return `Playing at the ${tournamentName}${sim.internationalStage ? ` — ${internationalRoundLabel(sim.internationalStage as never)}` : ''}.`;
  })();

  const statusLine = (() => {
    if (seasonNumber < 2) {
      return 'International football begins in Season 1, once you are in the first team.';
    }
    if (!clubOk) {
      return `Need a move to a higher-level club before ${nationName} will consider you.`;
    }
    if (inForm) return `This season’s ${careerRatio.toFixed(2)} goals/game is enough for ${nationName}.`;
    return `Need a ${bar.toFixed(2)} goals/game ratio this season — currently ${careerRatio.toFixed(2)}.`;
  })();

  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <p className="text-xs uppercase tracking-wide text-white/40">{nationName} call-up</p>
      <p className={`mt-1 text-sm font-semibold ${inForm && seasonNumber >= 2 ? 'text-emerald-300' : 'text-white/80'}`}>
        {statusLine}
      </p>
      {campaignLine && <p className="mt-1 text-xs text-emerald-200/80">{campaignLine}</p>}
      {caps > 0 && (
        <p className="mt-1 text-xs text-white/60">
          {caps} cap{caps === 1 ? '' : 's'} · {intlGoals} international goal{intlGoals === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}

function SeasonCompetitions({ calendar }: { calendar: SeasonCalendar | null }) {
  if (!calendar) return null;
  const cupIds = new Set(
    calendar.fixtures
      .map((f) => f.continentalCup)
      .filter((id): id is NonNullable<typeof id> => id !== undefined && id !== 'leagues-cup'),
  );
  const international = calendarIncludesInternational(calendar);
  const domesticCup = calendarDomesticCup(calendar);
  if (cupIds.size === 0 && !international && !domesticCup) return null;
  const internationalLabel = international
    ? `${INTERNATIONAL_TOURNAMENTS[international].name}${
        calendar.internationalPhase === 'qualifiers' ? ' qualifying' : ''
      }`
    : null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {domesticCup && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          {DOMESTIC_CUPS[domesticCup].name}
        </span>
      )}
      {calendar.fixtures.some((f) => f.kind === 'leagues-cup') && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          Leagues Cup
        </span>
      )}
      {calendar.fixtures.some((f) => f.kind === 'playoff') && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          MLS Cup Playoffs
        </span>
      )}
      {calendar.fixtures.some((f) => f.kind === 'super-cup') && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          Super Cup
        </span>
      )}
      {[...cupIds].map((id) => (
        <span key={id} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          {CONTINENTAL_CUPS[id].name}
        </span>
      ))}
      {internationalLabel && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          {internationalLabel}
        </span>
      )}
    </div>
  );
}

function RecentForm({ matches }: { matches: { played: boolean; scored: boolean | null }[] }) {
  const recent = matches.slice(-8);
  if (recent.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-white/40">Recent form</p>
      <div className="flex items-center gap-2">
        {recent.map((m, i) => {
          const key = `${matches.length - recent.length + i}`;
          if (!m.played) {
            return (
              <span
                key={key}
                title="Dropped from the squad"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-[10px] text-white/40"
              >
                –
              </span>
            );
          }
          return (
            <span
              key={key}
              title={m.scored ? 'Scored' : 'Blank'}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                m.scored ? 'bg-emerald-400 text-black' : 'bg-white/10 text-white/50'
              }`}
            >
              {m.scored ? '⚽' : '✕'}
            </span>
          );
        })}
      </div>
    </div>
  );
}
