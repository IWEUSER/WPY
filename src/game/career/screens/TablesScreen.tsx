import { getClub } from '../data/clubs';
import { argentinaGroupLabel, argentinaGroupOf, conferenceLabel, leagueDisplayName, mlsConferenceOf } from '../data/leagueFormat';
import { CONTINENTAL_CUPS, DOMESTIC_CUPS, INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { getNation } from '../international';
import { rankLeagueTable, type SeasonStandings } from '../matchEngine';
import { argentinaGroupTable, conferenceTable, ensureInternationalGroup, type SeasonSimState } from '../seasonSim';
import { sortGroupTable } from '../internationalTable';
import { competitionStageLabel } from '../honoursDisplay';
import { useCareerStore } from '../store';
import { DATA_CARD } from './dataUi';

export default function TablesScreen() {
  const clubId = useCareerStore((s) => s.clubId);
  const role = useCareerStore((s) => s.role);
  const nationality = useCareerStore((s) => s.nationality);
  const seasonStandings = useCareerStore((s) => s.seasonStandings);
  const seasonSim = useCareerStore((s) => s.seasonSim);
  const seasonCalendar = useCareerStore((s) => s.seasonCalendar);
  const seasonNumber = useCareerStore((s) => s.seasonNumber);
  const clubLeague = useCareerStore((s) => s.clubLeague);
  const returnToHub = useCareerStore((s) => s.returnToHub);

  const club = clubId ? getClub(clubId) : undefined;
  const nation = nationality ? getNation(nationality) : undefined;
  let seasonSimWithGroup = seasonSim;
  try {
    if (seasonSim) {
      seasonSimWithGroup = ensureInternationalGroup(seasonSim, seasonCalendar, seasonNumber);
    }
  } catch {
    seasonSimWithGroup = seasonSim;
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-5 py-[max(1.25rem,env(safe-area-inset-top))] pb-10 text-white">
      <div className="mb-5 flex items-center justify-between">
        <button type="button" onClick={returnToHub} className="text-xs text-white/40 underline underline-offset-2">
          Back
        </button>
        <span className="text-xs uppercase tracking-wide text-white/40">Tables</span>
      </div>

      <div className="flex flex-col gap-5">
        {seasonStandings && club && (
          <StandingsCard
            standings={seasonStandings}
            clubId={club.id}
            cupName={seasonSim?.domesticCup ? DOMESTIC_CUPS[seasonSim.domesticCup]?.name ?? null : null}
            cupStage={seasonSim?.domesticCupStage ?? null}
            sim={seasonSimWithGroup}
          />
        )}
        {seasonSimWithGroup && club && (
          <LeagueTableCard
            table={seasonSimWithGroup.leagueTable}
            clubId={club.id}
            leagueName={leagueDisplayName(clubLeague ?? club.league)}
          />
        )}
        {seasonSimWithGroup && club && (
          <EuropeanTableCard
            table={seasonSimWithGroup.europeanTable ?? []}
            clubId={club.id}
            standing={seasonSimWithGroup.europeanStanding}
            remainingOpponents={(seasonCalendar?.fixtures ?? [])
              .map((fixture, index) => ({ fixture, index }))
              .filter(({ fixture, index }) =>
                fixture.kind === 'continental-group'
                && index >= (seasonSimWithGroup.fixtureIndex ?? 0)
                && Boolean(fixture.opponentLabel),
              )
              .map(({ fixture }) => fixture.opponentLabel!)}
          />
        )}
        {nation && role !== 'reserve' && seasonSimWithGroup?.internationalGroup && (
          <div className={DATA_CARD}>
            <InternationalTableCard
              nationId={nationality!}
              nationName={nation.name}
              sim={seasonSimWithGroup}
            />
          </div>
        )}
        {!seasonStandings && !seasonSimWithGroup && (
          <p className="text-sm text-white/50">Tables appear once the season is underway.</p>
        )}
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
  const inMls = Boolean(mlsConferenceOf(clubId));
  const argGroup = argentinaGroupOf(clubId);
  const groupTable = argGroup ? argentinaGroupTable(standings.league, clubId) : [];
  const conferenceRow = inMls ? conference.find((r) => r.clubId === clubId) : undefined;
  const groupRow = argGroup ? groupTable.find((r) => r.clubId === clubId) : undefined;
  const overall = standings.league.find((r) => r.clubId === clubId);
  const us = conferenceRow ?? groupRow ?? overall;
  const europe = standings.europeanStanding;
  const competitions: { name: string; stage: string }[] = [];
  if (europe) {
    competitions.push({
      name: CONTINENTAL_CUPS[europe.cup]?.name ?? europe.cup,
      stage: competitionStageLabel(europe.stage, {
        leaguePhase: europe.cup === 'ucl' || europe.cup === 'uel' || europe.cup === 'uecl',
      }),
    });
  } else if (sim?.leaguesCupStage && sim.leaguesCupStage !== 'not-entered') {
    competitions.push({
      name: CONTINENTAL_CUPS['leagues-cup'].name,
      stage: competitionStageLabel(sim.leaguesCupStage),
    });
  }
  if (cupName && cupStage && cupStage !== 'not-entered' && !competitions.some((c) => c.name === cupName)) {
    competitions.push({
      name: cupName,
      stage: competitionStageLabel(cupStage),
    });
  }
  const intlName = sim?.internationalTournament
    ? INTERNATIONAL_TOURNAMENTS[sim.internationalTournament]?.name
    : null;
  if (intlName && sim?.internationalSelected && sim.internationalStage && sim.internationalStage !== 'not-selected') {
    competitions.push({
      name: intlName,
      stage: competitionStageLabel(sim.internationalReached ?? sim.internationalStage),
    });
  }

  return (
    <div className={DATA_CARD}>
      <p className="text-xs uppercase tracking-wide text-white/40">Standings</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <p className="text-2xl font-extrabold">{us && us.played > 0 ? `${us.position}` : '—'}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">
            {inMls ? conferenceLabel(mlsConferenceOf(clubId)) : argGroup ? argentinaGroupLabel(argGroup) : 'League position'}
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
        <div className="space-y-3">
          {competitions.length === 0 ? (
            <div>
              <p className="text-sm font-semibold leading-tight">Cup</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/40">—</p>
            </div>
          ) : (
            competitions.map((comp) => (
              <div key={comp.name}>
                <p className="text-sm font-semibold leading-tight">{comp.name}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-white/40">{comp.stage}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function LeagueTableRows({
  table,
  clubId,
}: {
  table: SeasonSimState['leagueTable'];
  clubId: string;
}) {
  const rows = rankLeagueTable(table ?? []).filter((row) => row.played > 0);
  if (rows.length === 0) return null;
  return (
    <table className="mt-3 w-full table-fixed border-collapse text-left text-xs">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-white/40">
          <th className="pb-1 font-medium">Club</th>
          <th className="w-10 pb-1 text-right font-medium">P</th>
          <th className="w-10 pb-1 text-right font-medium">GD</th>
          <th className="w-10 pb-1 text-right font-medium">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const name = getClub(row.clubId)?.name ?? row.clubId;
          return (
            <tr key={row.clubId} className={row.clubId === clubId ? 'font-semibold text-white' : 'text-white/70'}>
              <td className="py-0.5 pr-2">{row.position}. {name}</td>
              <td className="py-0.5 text-right tabular-nums">{row.played}</td>
              <td className="py-0.5 text-right tabular-nums">{row.goalsFor - row.goalsAgainst}</td>
              <td className="py-0.5 text-right tabular-nums">{row.points}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LeagueTableCard({
  table,
  clubId,
  leagueName,
}: {
  table: SeasonSimState['leagueTable'];
  clubId: string;
  leagueName: string;
}) {
  const inMls = Boolean(mlsConferenceOf(clubId));
  const argGroup = argentinaGroupOf(clubId);
  const conference = inMls ? conferenceTable(table ?? [], clubId) : [];
  const group = argGroup ? argentinaGroupTable(table ?? [], clubId) : [];
  const overall = table ?? [];
  const hasConference = inMls && rankLeagueTable(conference).some((row) => row.played > 0);
  const hasGroup = Boolean(argGroup) && rankLeagueTable(group).some((row) => row.played > 0);
  const hasOverall = rankLeagueTable(overall).some((row) => row.played > 0);
  if (!hasConference && !hasGroup && !hasOverall) return null;

  return (
    <div className={`${DATA_CARD} flex flex-col gap-4`}>
      {hasConference && (
        <div>
          <p className="text-xs uppercase tracking-wide text-white/40">
            {leagueName} · {conferenceLabel(mlsConferenceOf(clubId))}
          </p>
          <LeagueTableRows table={conference} clubId={clubId} />
        </div>
      )}
      {hasGroup && (
        <div>
          <p className="text-xs uppercase tracking-wide text-white/40">
            {leagueName} · {argentinaGroupLabel(argGroup)}
          </p>
          <LeagueTableRows table={group} clubId={clubId} />
        </div>
      )}
      <div>
        <p className="text-xs uppercase tracking-wide text-white/40">
          {inMls || argGroup ? `${leagueName} table` : leagueName}
        </p>
        <LeagueTableRows table={overall} clubId={clubId} />
      </div>
    </div>
  );
}

function EuropeanTableCard({
  table,
  clubId,
  standing,
  remainingOpponents = [],
}: {
  table: SeasonSimState['europeanTable'];
  clubId: string;
  standing: SeasonSimState['europeanStanding'];
  remainingOpponents?: string[];
}) {
  const cupName = standing ? (CONTINENTAL_CUPS[standing.cup]?.name ?? standing.cup) : null;
  const rows = rankLeagueTable(table ?? []);
  if (!cupName || rows.length === 0) return null;
  const leaguePhase = standing?.cup === 'ucl' || standing?.cup === 'uel' || standing?.cup === 'uecl';

  return (
    <div className={DATA_CARD}>
      <p className="text-xs uppercase tracking-wide text-white/40">
        {cupName}
        {standing?.stage ? ` · ${competitionStageLabel(standing.stage, { leaguePhase })}` : ''}
        {leaguePhase || rows.length >= 24 ? ` · ${rows.length} clubs` : ''}
        {standing?.cup === 'ucl' ? ' · 8 matches' : ''}
      </p>
      {remainingOpponents.length > 0 && standing?.cup === 'ucl' && (
        <p className="mt-1 text-[11px] text-white/50">
          Remaining ties: {remainingOpponents.join(' · ')}
        </p>
      )}
      <div className="mt-3 max-h-72 overflow-y-auto pr-1">
      <table className="w-full table-fixed border-collapse text-left text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-white/40">
            <th className="pb-1 font-medium">Club</th>
            <th className="w-10 pb-1 text-right font-medium">P</th>
            <th className="w-10 pb-1 text-right font-medium">GD</th>
            <th className="w-10 pb-1 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const name = getClub(row.clubId)?.name ?? row.clubId;
            return (
              <tr key={row.clubId} className={row.clubId === clubId ? 'font-semibold text-white' : 'text-white/70'}>
                <td className="py-0.5 pr-2">{row.position}. {name}</td>
                <td className="py-0.5 text-right tabular-nums">{row.played}</td>
                <td className="py-0.5 text-right tabular-nums">{row.goalsFor - row.goalsAgainst}</td>
                <td className="py-0.5 text-right tabular-nums">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function InternationalTableCard({
  nationId,
  nationName,
  sim,
}: {
  nationId: string;
  nationName: string;
  sim: SeasonSimState;
}) {
  const group = sim.internationalGroup;
  if (!group) return null;
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

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  if (n % 10 === 1) return 'st';
  if (n % 10 === 2) return 'nd';
  if (n % 10 === 3) return 'rd';
  return 'th';
}
