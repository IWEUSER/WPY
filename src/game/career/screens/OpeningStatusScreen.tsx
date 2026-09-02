import { getClub } from '../data/clubs';
import { getNation } from '../international';
import { fixtureTitle } from '../seasonSim';
import { fixtureVenueLabel } from '../calendar';
import { trialRatioRequired } from '../trial';
import { useCareerStore } from '../store';

export default function OpeningStatusScreen() {
  const opening = useCareerStore((s) => s.openingCampaign);
  const nationality = useCareerStore((s) => s.nationality);
  const lastMatchSummary = useCareerStore((s) => s.lastMatchSummary);
  const advance = useCareerStore((s) => s.advance);

  if (!opening) return null;

  const nation = nationality ? getNation(nationality) : undefined;
  const club = opening.trialClubId ? getClub(opening.trialClubId) : undefined;
  const next = opening.calendar.fixtures[opening.fixtureIndex];
  const youth = opening.kind === 'youth-tournament';
  const ratio = opening.gamesPlayed > 0 ? opening.goals / opening.gamesPlayed : 0;
  const required = club ? trialRatioRequired(club) : 0;

  const groupRows = youth
    ? [opening.playerGroup, ...opening.groupOthers]
        .slice()
        .sort((a, b) => b.points - a.points || b.gd - a.gd)
        .map((row, i) => ({
          ...row,
          position: i + 1,
          name: row.id === nationality ? (nation?.name ?? 'You') : (getNation(row.id)?.name ?? row.id),
        }))
    : [];

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-5 py-[max(1.25rem,env(safe-area-inset-top))] pb-10 text-white">
      <div className="rounded-2xl bg-white/5 p-4" style={club ? { borderLeft: `4px solid ${club.color}` } : undefined}>
        <p className="text-xs uppercase tracking-wide text-white/40">
          {youth ? opening.youthName : `${club?.name ?? 'Club'} trial`}
        </p>
        <h1 className="font-display text-2xl font-bold">
          {youth ? (nation?.name ?? 'Your country') : (club?.name ?? 'Trial')}
        </h1>
        <p className="mt-1 text-xs text-white/50">
          {opening.goals} goal{opening.goals === 1 ? '' : 's'} · {opening.gamesPlayed} game
          {opening.gamesPlayed === 1 ? '' : 's'}
          {!youth && club ? ` · ${ratio.toFixed(2)} / ${required.toFixed(2)} required` : ''}
        </p>
      </div>

      {lastMatchSummary && (
        <div className="mt-3 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/80">{lastMatchSummary}</div>
      )}

      {groupRows.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white/5 p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-white/40">Group</p>
          <div className="flex flex-col gap-1.5">
            {groupRows.map((row) => (
              <div
                key={row.id}
                className={`flex items-baseline justify-between rounded-lg px-2 py-1 text-sm ${
                  row.id === nationality ? 'bg-emerald-400/15 text-emerald-100' : 'text-white/80'
                }`}
              >
                <span>
                  {row.position}. {row.name}
                </span>
                <span className="text-xs text-white/50">
                  {row.points} pts · GD {row.gd > 0 ? '+' : ''}
                  {row.gd}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={advance}
        className="mt-4 w-full rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        Play Next Match
        {next && (
          <span className="mt-1 block text-xs font-medium text-black/70">
            {youth
              ? fixtureTitle(next, {
                playerNationName: nation?.name,
                tournament: opening.calendar.internationalTournament,
              })
              : `${club?.name ?? 'Trial'} — ${fixtureTitle(next, { tournament: opening.calendar.internationalTournament })}`}
            {next.kind !== 'rest' ? ` · ${fixtureVenueLabel(next)}` : ''}
          </span>
        )}
      </button>
    </div>
  );
}
