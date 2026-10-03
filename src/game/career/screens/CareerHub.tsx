import { calendarDomesticCup, calendarIncludesInternational, currentCalendarWeek, fixtureVenueLabel, type SeasonCalendar } from '../calendar';
import { clubKit } from '../data/clubKits';
import { getClub, leagueMatchWeeks } from '../data/clubs';
import { conferenceLabel, leagueDisplayName, mlsConferenceOf } from '../data/leagueFormat';
import { CONTINENTAL_CUPS, DOMESTIC_CUPS, INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { describeAvailability, isAvailable, nextMissDrops } from '../availabilityEngine';
import { describeInjury } from '../injury';
import {
  chancesForSquadStatus,
  completedFixtureKindCount,
  completedLeagueFixtureCount,
  describeRotationSitOut,
  formHighlightIndexes,
  isSquadRotationSitOut,
  isToughMinutesFixture,
  promotionStreakForStatus,
  SQUAD_STATUS_LABEL,
  squadRoleRatioGuide,
} from '../squadStatus';
import { displaySeasonLabel, displaySeasonNumber } from '../seasonDisplay';
import { clubEligibleForNationalTeam, CALL_UP_MIN_LEAGUE_GAMES, callUpRatio, getNation, isSelectedForNationalTeam, playerHasBeenCapped, SEASON_1_CALL_UP_MIN_WEEK, selectionRatioForNation } from '../international';
import { formatEuros, playerMarketValueFromSeasons, transferFeeFromValue } from '../playerValue';
import { ensureInternationalGroup, fixtureTitle, internationalRoundLabel, nextActionableFixture, type SeasonSimState } from '../seasonSim';
import { nextMatchBriefing, playerGoalsLine, sitOutRecapLine } from '../matchBriefing';
import { requiredGoalRatio } from '../transfers';
import { saveNeedsRebuild } from '../rulesStamp';
import { useCareerStore } from '../store';
import { DATA_CARD, DATA_INSET } from './dataUi';
import type { LastMatchResult, MatchRecord, SquadStatus } from '../types';

const ROLE_LABEL: Record<string, string> = {
  reserve: 'Reserve Team',
  'first-team': 'First Team',
  loan: 'On Loan',
};

const HUB_NAV_BTN = 'rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white/70';

export default function CareerHub({ onOpenMenu }: { onOpenMenu: () => void }) {
  const age = useCareerStore((s) => s.age);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const clubId = useCareerStore((s) => s.clubId);
  const parentClubId = useCareerStore((s) => s.parentClubId);
  const role = useCareerStore((s) => s.role);
  const squadStatus = useCareerStore((s) => s.squadStatus);
  const season = useCareerStore((s) => s.currentSeason);
  const seasonCalendar = useCareerStore((s) => s.seasonCalendar);
  const availability = useCareerStore((s) => s.availability);
  const nationality = useCareerStore((s) => s.nationality);
  const seasonSim = useCareerStore((s) => s.seasonSim);
  const lastMatchSummary = useCareerStore((s) => s.lastMatchSummary);
  const lastMatchResult = useCareerStore((s) => s.lastMatchResult);
  const careerGoals = useCareerStore((s) => s.careerGoals);
  const careerGames = useCareerStore((s) => s.careerGames);
  const seasonHistory = useCareerStore((s) => s.seasonHistory);
  const nationalTeam = useCareerStore((s) => s.nationalTeam);
  const contractYearsRemaining = useCareerStore((s) => s.contractYearsRemaining);
  const homeContractYearsRemaining = useCareerStore((s) => s.homeContractYearsRemaining);
  const clubLeague = useCareerStore((s) => s.clubLeague);
  const seasonSponsorship = useCareerStore((s) => s.seasonSponsorship);
  const injuryGamesRemaining = useCareerStore((s) => s.injuryGamesRemaining);
  const careerStart = useCareerStore((s) => s.careerStart);
  const rulesStamp = useCareerStore((s) => s.rulesStamp);
  const advance = useCareerStore((s) => s.advance);
  const openCareerRecord = useCareerStore((s) => s.openCareerRecord);
  const openTables = useCareerStore((s) => s.openTables);
  const openProfile = useCareerStore((s) => s.openProfile);
  const rebuildThisSeason = useCareerStore((s) => s.rebuildThisSeason);

  const club = clubId ? getClub(clubId) : undefined;
  const parentClub = role === 'loan' && parentClubId ? getClub(parentClubId) : undefined;
  const nation = nationality ? getNation(nationality) : undefined;
  let seasonSimWithGroup = seasonSim;
  try {
    if (seasonSim) {
      seasonSimWithGroup = ensureInternationalGroup(seasonSim, seasonCalendar, seasonNumber);
    }
  } catch {
    seasonSimWithGroup = seasonSim;
  }
  if (!club || !season) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center text-white">
        <p className="text-sm text-white/60">This career could not load the current season.</p>
        <button type="button" onClick={onOpenMenu} className="text-sm text-emerald-300 underline underline-offset-2">
          Menu
        </button>
      </div>
    );
  }
  const kit = clubKit(club);

  const played = season.gamesPlayed;
  const goals = season.goals;
  const ratio = played > 0 ? goals / played : 0;
  const seasonLeagueGames = season.leagueGames ?? 0;
  const onLoan = role === 'loan';
  const threshold = requiredGoalRatio(role, club, parentClub);
  const ratioProgress = Math.min(1, threshold > 0 ? ratio / threshold : 0);
  const injured = (injuryGamesRemaining ?? 0) > 0;
  const nextFixture = seasonCalendar && seasonSimWithGroup
    ? nextActionableFixture(seasonCalendar, seasonSimWithGroup)
    : undefined;
  const nextIsInternational = nextFixture?.kind === 'international';
  const squadAvailability = nextIsInternational && nationalTeam ? nationalTeam.availability : availability;
  const rotatedOut = Boolean(
    nextFixture
    && seasonCalendar
    && seasonSimWithGroup
    && isSquadRotationSitOut(
      role,
      squadStatus,
      nextFixture.kind,
      completedLeagueFixtureCount(seasonCalendar, seasonSimWithGroup.fixtureIndex),
      {
        toughMinutes: isToughMinutesFixture(nextFixture, club, nationality),
        seasonMatchCount: season.matches.length,
        continentalCup: nextFixture.continentalCup,
        domesticCupAppearances: completedFixtureKindCount(seasonCalendar, seasonSimWithGroup.fixtureIndex, 'domestic-cup'),
      },
    ),
  );
  const noChance = chancesForSquadStatus(squadStatus, nextFixture?.playerChances ?? 1) <= 0;
  const available = isAvailable(squadAvailability) && !injured && !rotatedOut && !noChance;
  const briefing = nextFixture
    ? nextMatchBriefing(nextFixture, seasonSimWithGroup, {
        playerNationName: nation?.name,
        tournament: seasonCalendar?.internationalTournament ?? seasonSimWithGroup?.internationalTournament,
      })
    : null;
  const squadLine = injured
    ? describeInjury(injuryGamesRemaining)
    : rotatedOut
      ? describeRotationSitOut(squadStatus)
      : noChance
        ? 'No chance this match'
        : nextIsInternational
        ? describeAvailability(squadAvailability, squadStatus)
        : describeAvailability(availability, squadStatus);
  const week = seasonCalendar && seasonSimWithGroup
    ? currentCalendarWeek(seasonCalendar, seasonSimWithGroup.fixtureIndex)
    : season.matches.length + 1;
  const publicSeasonNumber = displaySeasonNumber(seasonNumber, { role, careerStart });
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
  const feeYears = onLoan && homeContractYearsRemaining != null && homeContractYearsRemaining > 0
    ? homeContractYearsRemaining
    : contractYearsRemaining;
  const transferFee = transferFeeFromValue(marketValue, feeYears);

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-5 py-[max(1rem,env(safe-area-inset-top))] pb-8 text-white">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={onOpenMenu} className="text-xs text-white/40 underline underline-offset-2">
          Menu
        </button>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full bg-black/30 p-0.5 ring-1 ring-white/10">
            <button type="button" onClick={openCareerRecord} className={HUB_NAV_BTN}>
              Career
            </button>
            <button type="button" onClick={openTables} className={HUB_NAV_BTN}>
              Tables
            </button>
            <button type="button" onClick={openProfile} className={HUB_NAV_BTN}>
              Profile
            </button>
          </div>
          <span className="text-xs text-white/40">Age {age}</span>
        </div>
      </div>

      <div className={DATA_CARD} style={{ borderLeft: `4px solid ${kit.primary}` }}>
        <p className="text-[10px] uppercase tracking-wide text-white/40">
          {displaySeasonLabel(seasonNumber, { role, careerStart })} · {ROLE_LABEL[role]}
          {` · Week ${week} of ${totalWeeks}`}
        </p>
        <h1 className="font-display text-xl font-bold leading-tight">{club.name}</h1>
        <p className="text-[11px] text-white/50">
          {club.country} · {leagueDisplayName(clubLeague ?? club.league)}
          {mlsConferenceOf(club.id) ? ` · ${conferenceLabel(mlsConferenceOf(club.id))}` : ''}
          {nation ? ` · ${nation.name}` : ''}
        </p>
        <div className={`mt-1.5 inline-flex ${DATA_INSET} px-2.5 py-1`}>
          <span className="text-sm font-semibold">
            {role === 'reserve' ? ROLE_LABEL.reserve : SQUAD_STATUS_LABEL[squadStatus]}
          </span>
        </div>
        {parentClub && <p className="mt-1 text-[11px] text-white/40">On loan from {parentClub.name}</p>}
        {role !== 'reserve' && (
          <p className="mt-1 text-[11px] text-white/50">
            Market value {formatEuros(marketValue)}
            {` · Transfer fee ${transferFee <= 0 ? 'Free' : formatEuros(transferFee)}`}
          </p>
        )}
        {seasonSponsorship > 0 && (
          <p className="mt-1 text-[11px] text-white/50">Sponsorship {formatEuros(seasonSponsorship)} this season</p>
        )}
        <p className="mt-1 text-[11px] text-white/50">
          Contract {contractYearsRemaining} year{contractYearsRemaining === 1 ? '' : 's'} left
          {contractYearsRemaining <= 1 ? ' · expiring' : ''}
        </p>
        <SeasonCompetitions calendar={seasonCalendar} />
      </div>

      {saveNeedsRebuild({
        phase: 'hub',
        seasonCalendar,
        seasonSim,
        rulesStamp,
      }) && (
        <div className={`mt-3 ${DATA_CARD} border-amber-400/40`}>
          <p className="text-xs uppercase tracking-wide text-amber-300/80">Career rules updated</p>
          <p className="mt-1 text-sm text-white/70">
            New leagues and cup calendars are in. Rebuild this season to apply them. Your club, role, and stats stay.
          </p>
          <button
            type="button"
            onClick={rebuildThisSeason}
            className="mt-3 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-black transition active:scale-[0.98]"
          >
            Rebuild this season
          </button>
        </div>
      )}

      {briefing && (
        <div className={`mt-2 ${DATA_CARD} p-3`}>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Next match</p>
          <h2 className="mt-0.5 font-display text-base font-bold leading-tight">{briefing.opponent}</h2>
          <p className="mt-0.5 text-sm text-white/70">
            {[briefing.venue, briefing.competition].filter(Boolean).join(' · ')}
          </p>
          {briefing.stake && (
            <p className="mt-1 text-sm font-semibold text-emerald-300">{briefing.stake}</p>
          )}
          <div
            className={`mt-2 rounded-xl px-3 py-1.5 text-sm font-semibold ${
              available ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
            }`}
          >
            {squadLine}
          </div>
        </div>
      )}

      <RecentForm
        matches={season.matches}
        squadStatus={role === 'reserve' ? 'reserve' : squadStatus}
        openedAs={season.openedSquadStatus}
        dropWindowFails={availability.windowFails}
        nextMissDrops={nextMissDrops(availability, squadStatus)}
      />

      <button
        type="button"
        onClick={advance}
        className="mt-2 w-full rounded-2xl bg-emerald-500 px-6 py-3 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
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
          className={`mt-2 rounded-xl px-4 py-3 text-sm font-semibold ${
            available ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
          }`}
        >
          {squadLine}
        </div>
      )}

      {(lastMatchResult || lastMatchSummary) && (
        <LastMatchRecap result={lastMatchResult} fallback={lastMatchSummary} />
      )}

      <div className="mt-3 flex flex-col gap-3">
        <div className={DATA_CARD}>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wide text-white/40">Club Season ratio</span>
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
            {ratio.toFixed(2)} / {threshold.toFixed(2)} required
            {onLoan && parentClub ? ` to return to ${parentClub.name}` : ''}
          </p>
          {(() => {
            const guide = squadRoleRatioGuide(
              role === 'reserve' ? 'reserve' : squadStatus,
              onLoan && parentClub ? parentClub.firstTeamGoalRatio : club.firstTeamGoalRatio,
            );
            return (
              <p className="mt-2 text-xs text-white/55">
                {guide.keepLabel}: {guide.keepHint ?? `${guide.keepRatio.toFixed(2)} to keep this role`}
                {guide.nextLabel && (
                  <>
                    {' · '}
                    {guide.nextLabel}: {guide.nextHint ?? (guide.nextRatio != null ? `${guide.nextRatio.toFixed(2)} to move up` : 'move up')}
                  </>
                )}
              </p>
            );
          })()}
        </div>

        {nation && role !== 'reserve' && (
          <InternationalCard
            nationId={nationality!}
            nationName={nation.name}
            clubTier={club.tier}
            league={clubLeague ?? club.league}
            careerRatio={callUpRatio({
              season,
              careerGoals,
              careerGames,
              hasBeenCapped: playerHasBeenCapped({
                caps: nationalTeam?.caps,
                seasons: [...seasonHistory, ...(season ? [season] : [])],
              }),
            })}
            leagueGames={seasonLeagueGames}
            sim={seasonSimWithGroup}
            caps={nationalTeam?.caps ?? 0}
            intlGoals={nationalTeam?.goals ?? 0}
            dropped={Boolean(nationalTeam && !isAvailable(nationalTeam.availability))}
            selected={Boolean(seasonSimWithGroup?.internationalSelected)}
            publicSeason={publicSeasonNumber}
            calendarWeek={week}
            squadStatus={squadStatus}
          />
        )}
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
  const sitOutLine = sitOutRecapLine(result?.sitOutReason);

  return (
    <div className={`mt-2 ${DATA_INSET}`}>
      <p className="text-[10px] uppercase tracking-wide text-white/40">Last match</p>
      <p className="mt-1 text-sm font-semibold text-white/90">{headline}</p>
      {structured && playerLine && <p className="mt-1 text-sm text-white/70">{playerLine}</p>}
      {sitOutLine && (
        <p className="mt-1 text-sm font-semibold text-amber-200">
          {sitOutLine}
        </p>
      )}
      {result?.aggregateLine && <p className="mt-1 text-sm font-semibold text-emerald-200">{result.aggregateLine}</p>}
      {result?.nextLine && <p className="mt-1 text-sm text-white/70">{result.nextLine}</p>}
      {!structured && fallback && fallback !== headline && (
        <p className="mt-1 text-sm text-white/70">{fallback}</p>
      )}
    </div>
  );
}

function InternationalCard({
  nationId,
  nationName,
  clubTier,
  league,
  careerRatio,
  leagueGames = 0,
  sim,
  caps,
  intlGoals,
  dropped,
  selected,
  publicSeason = null,
  calendarWeek = 99,
  squadStatus = 'starter',
}: {
  nationId: string;
  nationName: string;
  clubTier: 1 | 2 | 3 | 4 | 5;
  league?: string | null;
  careerRatio: number;
  leagueGames?: number;
  sim: SeasonSimState | null;
  caps: number;
  intlGoals: number;
  dropped: boolean;
  selected: boolean;
  publicSeason?: number | null;
  calendarWeek?: number;
  squadStatus?: SquadStatus;
}) {
  const bar = selectionRatioForNation(nationId);
  const clubOk = clubEligibleForNationalTeam(clubTier, nationId, league);
  const inForm = isSelectedForNationalTeam({
    clubTier,
    careerGoalRatio: careerRatio,
    nationId,
    publicSeason,
    calendarWeek,
    squadStatus,
    league,
    leagueGames,
    hasBeenCapped: caps > 0,
  });
  const waitingForLeagueGames = caps <= 0 && leagueGames < CALL_UP_MIN_LEAGUE_GAMES;
  const waitingSeason1 = publicSeason === 1 && calendarWeek <= SEASON_1_CALL_UP_MIN_WEEK;
  const tournamentName = sim?.internationalTournament
    ? INTERNATIONAL_TOURNAMENTS[sim.internationalTournament]?.name
    : null;
  const ratioProgress = Math.min(1, bar > 0 ? careerRatio / bar : 0);
  const campaignLine = (() => {
    if (!clubOk) return null;
    if (waitingForLeagueGames) return `First call-up needs ${CALL_UP_MIN_LEAGUE_GAMES} league games this season (${leagueGames} so far).`;
    if (waitingSeason1) return `Season 1 call-ups open after week ${SEASON_1_CALL_UP_MIN_WEEK}.`;
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
      return `${tournamentName} group: ${sim.groupPoints} pts from ${sim.groupPlayed} games.`;
    }
    return `Playing at the ${tournamentName}${sim.internationalStage ? ` — ${internationalRoundLabel(sim.internationalStage as never)}` : ''}.`;
  })();

  const statusLine = (() => {
    if (!clubOk) return 'Bigger club required';
    if (squadStatus && squadStatus !== 'starter') {
      return `Call-ups are for starters — currently ${SQUAD_STATUS_LABEL[squadStatus]}.`;
    }
    if (waitingForLeagueGames) {
      return `Need ${CALL_UP_MIN_LEAGUE_GAMES} league games this season before a first call-up — currently ${leagueGames}.`;
    }
    if (waitingSeason1) {
      return `International call-ups start after week ${SEASON_1_CALL_UP_MIN_WEEK} in Season 1.`;
    }
    return null;
  })();

  return (
    <div className={DATA_CARD}>
      <p className="text-xs uppercase tracking-wide text-white/40">{nationName} {tournamentName ? `· ${tournamentName}` : 'call-up'}</p>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${ratioProgress >= 1 ? 'bg-emerald-400' : 'bg-amber-400'}`}
          style={{ width: `${ratioProgress * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-white/50">
        {careerRatio.toFixed(2)} / {bar.toFixed(2)} required
      </p>
      {statusLine && (
        <p className={`mt-1 text-sm font-semibold ${inForm && clubOk ? 'text-emerald-300' : 'text-white/80'}`}>
          {statusLine}
        </p>
      )}
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
      ? `${INTERNATIONAL_TOURNAMENTS[international]?.name ?? 'International'} qualifying`
      : (INTERNATIONAL_TOURNAMENTS[international]?.name ?? 'International')
    : null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {domesticCup && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          {DOMESTIC_CUPS[domesticCup].name}
        </span>
      )}
      {hasLeaguesCup && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          {CONTINENTAL_CUPS['leagues-cup'].name}
        </span>
      )}
      {hasPlayoffs && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          {calendar.fixtures.some((f) => f.kind === 'playoff' && f.playoffRound?.startsWith('argentina-'))
            ? 'Argentine League knockout'
            : 'American League Playoffs'}
        </span>
      )}
      {superCupLabel && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          {superCupLabel}
        </span>
      )}
      {[...cupIds].map((id) => (
        <span key={id} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          {CONTINENTAL_CUPS[id]?.name ?? id}
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

function RecentForm({
  matches,
  squadStatus,
  openedAs,
  dropWindowFails,
  nextMissDrops: dropNext,
}: {
  matches: MatchRecord[];
  squadStatus: SquadStatus;
  openedAs?: SquadStatus;
  dropWindowFails: number;
  nextMissDrops: boolean;
}) {
  const recent = matches.slice(-8);
  if (recent.length === 0) return null;
  const offset = matches.length - recent.length;
  const marks = formHighlightIndexes({
    matches,
    status: squadStatus,
    openedAs,
    dropWindowFails,
    nextMissDrops: dropNext,
  });
  const promoteSet = new Set(marks.promote);
  const dropSet = new Set(marks.drop);
  const promo = promotionStreakForStatus(squadStatus, matches, openedAs);
  const promoteReady = Boolean(promo.nextLabel && promo.streak === promo.needed - 1);

  return (
    <div className={`mt-2 ${DATA_CARD} p-3`}>
      <p className="mb-2 text-[10px] uppercase tracking-wide text-white/40">Recent form</p>
      <div className="flex items-center gap-1.5">
        {recent.map((m, i) => {
          const index = offset + i;
          const key = `${index}`;
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
          const promoteMark = promoteSet.has(index);
          const dropMark = dropSet.has(index);
          const scored = Boolean(m.scored);
          const className = dropMark
            ? 'bg-red-500 text-white ring-2 ring-red-200'
            : promoteMark
              ? 'bg-amber-400 text-black ring-2 ring-amber-200'
              : scored
                ? 'bg-emerald-400 text-black'
                : 'bg-white/10 text-white/50';
          return (
            <span
              key={key}
              title={dropMark ? 'A blank next game drops you' : promoteMark ? `Score next game for ${promo.nextLabel}` : scored ? 'Scored' : 'Blank'}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${className}`}
            >
              {scored ? '⚽' : '✕'}
            </span>
          );
        })}
      </div>
      {promoteReady && promo.nextLabel && (
        <p className="mt-2 text-[11px] font-semibold text-amber-200">
          Score next game for {promo.nextLabel}
        </p>
      )}
      {dropNext && (
        <p className="mt-2 text-[11px] font-semibold text-red-300">
          A blank next game drops you
        </p>
      )}
    </div>
  );
}
