import { useEffect } from 'react';
import { calendarDomesticCup, calendarIncludesInternational, currentCalendarWeek, fixtureVenueLabel, type SeasonCalendar } from '../calendar';
import { clubKit } from '../data/clubKits';
import { getClub, leagueMatchWeeks } from '../data/clubs';
import { conferenceLabel, leagueDisplayName, mlsConferenceOf } from '../data/leagueFormat';
import { CONTINENTAL_CUPS, DOMESTIC_CUPS, INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { describeAvailability, isAvailable } from '../availabilityEngine';
import { describeInjury } from '../injury';
import { clubEligibleForNationalTeam, callUpRatio, getNation, isSelectedForNationalTeam, selectionRatioForNation } from '../international';
import type { SeasonStandings } from '../matchEngine';
import { displaySeasonLabel } from '../seasonDisplay';
import { formatEuros, formatWeeklyWage, playerMarketValueFromSeasons, transferFeeFromValue } from '../playerValue';
import { conferenceTable, ensureInternationalGroup, fixtureTitle, internationalRoundLabel, nextPlayableFixture, type SeasonSimState } from '../seasonSim';
import { nextMatchBriefing, playerGoalsLine } from '../matchBriefing';
import { groupPosition, sortGroupTable } from '../internationalTable';
import { requiredGoalRatio } from '../transfers';
import { useCareerStore } from '../store';
import { DATA_CARD, DATA_INSET } from './dataUi';
import type { LastMatchResult } from '../types';

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
  const lastMatchResult = useCareerStore((s) => s.lastMatchResult);
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
  const careerStart = useCareerStore((s) => s.careerStart);
  const advance = useCareerStore((s) => s.advance);
  const openCareerRecord = useCareerStore((s) => s.openCareerRecord);

  const club = clubId ? getClub(clubId) : undefined;
  const parentClub = role === 'loan' && parentClubId ? getClub(parentClubId) : undefined;
  const nation = nationality ? getNation(nationality) : undefined;
  if (!club || !season) return null;
  const kit = clubKit(club);
  const seasonSimWithGroup = seasonSim
    ? ensureInternationalGroup(seasonSim, seasonCalendar, seasonNumber)
    : seasonSim;
  useEffect(() => {
    if (!seasonSimWithGroup || seasonSimWithGroup === seasonSim) return;
    useCareerStore.setState({ seasonSim: seasonSimWithGroup });
  }, [seasonSim, seasonSimWithGroup]);

  const played = season.gamesPlayed;
  const goals = season.goals;
  const ratio = played > 0 ? goals / played : 0;
  const onLoan = role === 'loan';
  const threshold = requiredGoalRatio(role, club, parentClub);
  const ratioProgress = Math.min(1, threshold > 0 ? ratio / threshold : 0);
  const injured = (injuryGamesRemaining ?? 0) > 0;
  const nextFixture = seasonCalendar && seasonSim ? nextPlayableFixture(seasonCalendar, seasonSim) : undefined;
  const nextIsInternational = nextFixture?.kind === 'international';
  const squadAvailability = nextIsInternational && nationalTeam ? nationalTeam.availability : availability;
  const available = isAvailable(squadAvailability) && !injured;
  const briefing = nextFixture
    ? nextMatchBriefing(nextFixture, seasonSim, {
        playerNationName: nation?.name,
        tournament: seasonCalendar?.internationalTournament ?? seasonSim?.internationalTournament,
      })
    : null;
  const squadLine = injured
    ? describeInjury(injuryGamesRemaining)
    : nextIsInternational
      ? describeAvailability(squadAvailability)
      : describeAvailability(availability);
  const week = seasonCalendar && seasonSim
    ? currentCalendarWeek(seasonCalendar, seasonSim.fixtureIndex)
    : season.matches.length + 1;
  const totalWeeks = seasonCalendar?.totalWeeks ?? leagueMatchWeeks(club.league);
  const marketValue = playerMarketValueFromSeasons({
    age,
    careerGoals,
    careerGames,
    seasons: [...seasonHistory, season],
    fallbackClub: club,
    contractYearsRemaining,
    seasonNumber,
    calendarWeek: week,
    careerStart,
    role,
  });
  const transferFee = transferFeeFromValue(marketValue, contractYearsRemaining);

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

      <div className={DATA_CARD} style={{ borderLeft: `4px solid ${kit.primary}` }}>
        <p className="text-xs uppercase tracking-wide text-white/40">
          {displaySeasonLabel(seasonNumber, { role, careerStart })} · {ROLE_LABEL[role]}
          {` · Week ${week} of ${totalWeeks}`}
        </p>
        <h1 className="font-display text-2xl font-bold">{club.name}</h1>
        <p className="text-xs text-white/50">
          {club.country} · {leagueDisplayName(clubLeague ?? club.league)}
          {mlsConferenceOf(club.id) ? ` · ${conferenceLabel(mlsConferenceOf(club.id))}` : ''}
        </p>
        {nation && <p className="mt-1 text-xs text-white/50">International: {nation.name}</p>}
        {parentClub && <p className="mt-1 text-xs text-white/40">On loan from {parentClub.name}</p>}
        {role !== 'reserve' && (
          <p className="mt-1 text-xs text-white/50">
            Market value {formatEuros(marketValue)}
            {` · Transfer fee ${transferFee <= 0 ? 'Free' : formatEuros(transferFee)}`}
          </p>
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

      {briefing && (
        <div className={`mt-4 ${DATA_CARD}`}>
          <p className="text-xs uppercase tracking-wide text-white/40">Next match</p>
          <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{briefing.opponent}</h2>
          <p className="mt-1 text-sm text-white/70">
            {[briefing.venue, briefing.competition].filter(Boolean).join(' · ')}
          </p>
          {briefing.stake && (
            <p className="mt-2 text-sm font-semibold text-emerald-300">{briefing.stake}</p>
          )}
          <div
            className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${
              available ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
            }`}
          >
            {squadLine}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={advance}
        className="mt-4 w-full rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        {available ? (nextFixture ? 'Play Next Match' : 'End of season') : 'Continue'}
        {!briefing && nextFixture ? (
          <span className="mt-1 block text-xs font-medium text-black/70">
            {fixtureTitle(nextFixture, {
              playerNationName: nation?.name,
              tournament: seasonCalendar?.internationalTournament ?? seasonSim?.internationalTournament,
            })}
            {nextFixture.kind !== 'rest' ? ` · ${fixtureVenueLabel(nextFixture)}` : ''}
          </span>
        ) : seasonCalendar && seasonSim && !nextFixture ? (
          <span className="mt-1 block text-xs font-medium text-black/70">Review the campaign</span>
        ) : null}
      </button>

      {!briefing && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
            available ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
          }`}
        >
          {squadLine}
        </div>
      )}

      {week > 0 && (
        <div className={`mt-3 ${DATA_INSET}`}>
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

      {(lastMatchResult || lastMatchSummary) && (
        <LastMatchRecap result={lastMatchResult} fallback={lastMatchSummary} />
      )}

      <div className="mt-5 flex flex-col gap-5">
        <div className={DATA_CARD}>
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
            {onLoan && parentClub
              ? `Need ${threshold.toFixed(2)} goals/game to return to ${parentClub.name}'s first team · currently ${ratio.toFixed(2)}`
              : `Need ${threshold.toFixed(2)} goals/game to ${role === 'first-team' ? 'keep your place' : 'earn a promotion'} · currently ${ratio.toFixed(2)}`}
          </p>
        </div>

        {nation && role !== 'reserve' && (
          <InternationalCard
            nationId={nationality!}
            nationName={nation.name}
            clubTier={club.tier}
            careerRatio={callUpRatio({ season, careerGoals, careerGames })}
            sim={seasonSimWithGroup}
            caps={nationalTeam?.caps ?? 0}
            intlGoals={nationalTeam?.goals ?? 0}
            dropped={Boolean(nationalTeam && !isAvailable(nationalTeam.availability))}
            selected={Boolean(seasonSimWithGroup?.internationalSelected)}
            includeTable={false}
          />
        )}

        <details className={DATA_CARD}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-white/85 [&::-webkit-details-marker]:hidden">
            Tables
            <span className="mt-0.5 block text-xs font-medium text-white/40">League, cups, internationals</span>
          </summary>
          <div className="mt-4 flex flex-col gap-5">
            {seasonStandings && (
              <StandingsCard
                standings={seasonStandings}
                clubId={club.id}
                cupName={seasonSim?.domesticCup ? DOMESTIC_CUPS[seasonSim.domesticCup].name : null}
                cupStage={seasonSim?.domesticCupStage ?? null}
                sim={seasonSim}
                nested
              />
            )}
            {nation && role !== 'reserve' && seasonSimWithGroup?.internationalGroup && (
              <InternationalCard
                nationId={nationality!}
                nationName={nation.name}
                clubTier={club.tier}
                careerRatio={callUpRatio({ season, careerGoals, careerGames })}
                sim={seasonSimWithGroup}
                caps={nationalTeam?.caps ?? 0}
                intlGoals={nationalTeam?.goals ?? 0}
                dropped={Boolean(nationalTeam && !isAvailable(nationalTeam.availability))}
                selected={Boolean(seasonSimWithGroup?.internationalSelected)}
                includeTable
                tableOnly
              />
            )}
          </div>
        </details>

        <RecentForm matches={season.matches} />
      </div>
    </div>
  );
}

function LastMatchRecap({
  result,
  fallback,
}: {
  result: LastMatchResult | null;
  fallback: string | null;
}) {
  const headline = result?.headline ?? result?.summary ?? fallback;
  if (!headline) return null;
  const playerLine =
    result?.playerGoals != null && result?.chances != null
      ? playerGoalsLine(result.playerGoals, result.chances)
      : null;
  const structured = Boolean(result?.headline || result?.aggregateLine || result?.nextLine || playerLine);

  return (
    <div className={`mt-3 ${DATA_INSET}`}>
      <p className="text-xs uppercase tracking-wide text-white/40">Last match</p>
      <p className="mt-1 text-sm font-semibold text-white/90">{headline}</p>
      {structured && playerLine && <p className="mt-1 text-sm text-white/70">{playerLine}</p>}
      {result?.aggregateLine && <p className="mt-1 text-sm font-semibold text-emerald-200">{result.aggregateLine}</p>}
      {result?.nextLine && <p className="mt-1 text-sm text-white/70">{result.nextLine}</p>}
      {!structured && fallback && fallback !== headline && (
        <p className="mt-1 text-sm text-white/70">{fallback}</p>
      )}
    </div>
  );
}

function StandingsCard({
  standings,
  clubId,
  cupName,
  cupStage,
  sim,
  nested = false,
}: {
  standings: SeasonStandings;
  clubId: string;
  cupName: string | null;
  cupStage: string | null;
  sim: SeasonSimState | null;
  nested?: boolean;
}) {
  const conference = conferenceTable(standings.league, clubId);
  const inMls = Boolean(mlsConferenceOf(clubId));
  const conferenceRow = inMls ? conference.find((r) => r.clubId === clubId) : undefined;
  const overall = standings.league.find((r) => r.clubId === clubId);
  const us = conferenceRow ?? overall;
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
    pending: '—',
  };
  const cupHeadline = europe
    ? { stage: stageLabel[europe.stage] ?? europe.stage, name: CONTINENTAL_CUPS[europe.cup].name }
    : sim?.leaguesCupStage && sim.leaguesCupStage !== 'not-entered'
      ? { stage: stageLabel[sim.leaguesCupStage] ?? sim.leaguesCupStage, name: 'Leagues Cup' }
      : cupName && cupStage && cupStage !== 'not-entered'
        ? { stage: stageLabel[cupStage] ?? cupStage, name: cupName }
        : { stage: '—', name: 'Cup' };
  const extraCup =
    cupName && cupStage && cupStage !== 'not-entered' && cupHeadline.name !== cupName
      ? `${cupName}: ${stageLabel[cupStage] ?? cupStage}`
      : null;

  return (
    <div className={nested ? '' : DATA_CARD}>
      <p className="text-xs uppercase tracking-wide text-white/40">Standings</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-2xl font-extrabold">{us && us.played > 0 ? `${us.position}` : '—'}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">
            {inMls ? conferenceLabel(mlsConferenceOf(clubId)) : 'League position'}
          </p>
          {inMls && overall && overall.played > 0 && (
            <p className="mt-1 text-xs text-white/50">
              {overall.position}{ordinal(overall.position)} overall
            </p>
          )}
          {us && (
            <p className="mt-1 text-xs text-white/50">
              {us.points} pts · {us.played} played
            </p>
          )}
        </div>
        <div>
          <p className="text-lg font-bold leading-tight">{cupHeadline.stage}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">{cupHeadline.name}</p>
          {extraCup && <p className="mt-1 text-xs text-white/50">{extraCup}</p>}
        </div>
      </div>
    </div>
  );
}

function InternationalCard({
  nationId,
  nationName,
  clubTier,
  careerRatio,
  sim,
  caps,
  intlGoals,
  dropped,
  selected,
  includeTable = true,
  tableOnly = false,
}: {
  nationId: string;
  nationName: string;
  clubTier: 1 | 2 | 3 | 4 | 5;
  careerRatio: number;
  sim: SeasonSimState | null;
  caps: number;
  intlGoals: number;
  dropped: boolean;
  selected: boolean;
  includeTable?: boolean;
  tableOnly?: boolean;
}) {
  const bar = selectionRatioForNation(nationId);
  const clubOk = clubEligibleForNationalTeam(clubTier);
  const inForm = isSelectedForNationalTeam({ clubTier, careerGoalRatio: careerRatio, nationId });
  const tournamentName = sim?.internationalTournament
    ? INTERNATIONAL_TOURNAMENTS[sim.internationalTournament].name
    : null;
  const group = sim?.internationalGroup;
  const pos = group ? groupPosition(group, nationId) : 0;
  const campaignLine = (() => {
    if (!clubOk) return `Call-ups are for players at a higher club level.`;
    if (!sim || !selected || !tournamentName) return `Not selected for ${nationName} this window.`;
    if (dropped) return `Dropped for this ${tournamentName} match.`;
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
    if (sim.internationalStage === 'friendly') {
      return `${tournamentName} friendlies before the tournament.`;
    }
    if (sim.internationalStage === 'group') {
      const place = pos > 0 ? ` · ${pos}${ordinal(pos)} in group ${group?.letter ?? ''}` : '';
      return `${tournamentName} group: ${sim.groupPoints} pts from ${sim.groupPlayed} games${place}.`;
    }
    return `Playing at the ${tournamentName}${sim.internationalStage ? ` — ${internationalRoundLabel(sim.internationalStage as never)}` : ''}.`;
  })();

  const statusLine = (() => {
    if (!clubOk) {
      return `Need a move to a higher-level club before ${nationName} will consider you.`;
    }
    if (inForm) return `Your ${careerRatio.toFixed(2)} goals/game is enough for ${nationName}.`;
    return `Need a ${bar.toFixed(2)} goals/game ratio for a call-up — currently ${careerRatio.toFixed(2)}.`;
  })();

  const showTable = includeTable && Boolean(group && sim?.internationalStage && sim.internationalStage !== 'not-selected');

  if (tableOnly) {
    if (!showTable || !group) return null;
    return (
      <div>
        <p className="text-xs uppercase tracking-wide text-white/40">{nationName} table</p>
        <table className="mt-3 w-full table-fixed border-collapse text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-white/40">
              <th className="pb-1 font-medium">{group.kind === 'qualifying' ? 'Qualifying' : `Group ${group.letter}`}</th>
              <th className="w-10 pb-1 text-right font-medium">P</th>
              <th className="w-10 pb-1 text-right font-medium">GD</th>
              <th className="w-10 pb-1 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {sortGroupTable(group.rows).map((row, i) => (
              <tr key={row.nationId} className={row.nationId === nationId ? 'font-semibold text-white' : 'text-white/70'}>
                <td className="py-0.5 pr-2">{i + 1}. {row.name}</td>
                <td className="py-0.5 text-right tabular-nums">{row.played}</td>
                <td className="py-0.5 text-right tabular-nums">{row.goalsFor - row.goalsAgainst}</td>
                <td className="py-0.5 text-right tabular-nums">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={DATA_CARD}>
      <p className="text-xs uppercase tracking-wide text-white/40">{nationName} {tournamentName ? `· ${tournamentName}` : 'call-up'}</p>
      <p className={`mt-1 text-sm font-semibold ${inForm ? 'text-emerald-300' : 'text-white/80'}`}>
        {statusLine}
      </p>
      {campaignLine && <p className="mt-1 text-xs text-emerald-200/80">{campaignLine}</p>}
      {group && pos > 0 && (
        <p className="mt-1 text-xs text-white/60">
          {group.kind === 'qualifying' ? 'Qualifying' : `Group ${group.letter}`} · {pos}{ordinal(pos)}
        </p>
      )}
      {showTable && group && (
        <table className="mt-3 w-full table-fixed border-collapse text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-white/40">
              <th className="pb-1 font-medium">{group.kind === 'qualifying' ? 'Qualifying' : `Group ${group.letter}`}</th>
              <th className="w-10 pb-1 text-right font-medium">P</th>
              <th className="w-10 pb-1 text-right font-medium">GD</th>
              <th className="w-10 pb-1 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {sortGroupTable(group.rows).map((row, i) => (
              <tr key={row.nationId} className={row.nationId === nationId ? 'font-semibold text-white' : 'text-white/70'}>
                <td className="py-0.5 pr-2">{i + 1}. {row.name}</td>
                <td className="py-0.5 text-right tabular-nums">{row.played}</td>
                <td className="py-0.5 text-right tabular-nums">{row.goalsFor - row.goalsAgainst}</td>
                <td className="py-0.5 text-right tabular-nums">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {caps > 0 && (
        <p className="mt-1 text-xs text-white/60">
          {caps} cap{caps === 1 ? '' : 's'} · {intlGoals} international goal{intlGoals === 1 ? '' : 's'}
        </p>
      )}
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

function SeasonCompetitions({ calendar }: { calendar: SeasonCalendar | null }) {
  if (!calendar) return null;
  const cupIds = new Set(
    calendar.fixtures
      .map((f) => f.continentalCup)
      .filter((id): id is NonNullable<typeof id> => id !== undefined && id !== 'leagues-cup'),
  );
  const international = calendarIncludesInternational(calendar);
  const domesticCup = calendarDomesticCup(calendar);
  const hasLeaguesCup = calendar.fixtures.some((f) => f.kind === 'leagues-cup');
  const hasPlayoffs = calendar.fixtures.some((f) => f.kind === 'playoff');
  const hasSuperCup = calendar.fixtures.some((f) => f.kind === 'super-cup');
  const superCupLabel =
    calendar.fixtures.find((f) => f.kind === 'super-cup' && f.domesticSuperCup)?.domesticSuperCupName
    ?? (hasSuperCup ? 'Super Cup' : null);
  if (cupIds.size === 0 && !international && !domesticCup && !hasLeaguesCup && !hasPlayoffs && !hasSuperCup) {
    return null;
  }
  const internationalLabel = international
    ? calendar.internationalPhase === 'qualifiers'
      ? `${INTERNATIONAL_TOURNAMENTS[international].name} qualifying`
      : INTERNATIONAL_TOURNAMENTS[international].name
    : null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {domesticCup && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          {DOMESTIC_CUPS[domesticCup].name}
        </span>
      )}
      {hasLeaguesCup && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          Leagues Cup
        </span>
      )}
      {hasPlayoffs && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          MLS Cup Playoffs
        </span>
      )}
      {superCupLabel && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          {superCupLabel}
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
    <div className={DATA_CARD}>
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
