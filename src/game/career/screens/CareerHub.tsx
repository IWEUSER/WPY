import { calendarIncludesInternational, type SeasonCalendar } from '../calendar';
import { getClub } from '../data/clubs';
import { CONTINENTAL_CUPS, INTERNATIONAL_TOURNAMENTS } from '../data/competitions';
import { describeAvailability, isAvailable } from '../availabilityEngine';
import { useCareerStore, SEASON_LENGTH } from '../store';

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
  const careerGoals = useCareerStore((s) => s.careerGoals);
  const careerGames = useCareerStore((s) => s.careerGames);
  const advance = useCareerStore((s) => s.advance);

  const club = clubId ? getClub(clubId) : undefined;
  const parentClub = role === 'loan' && parentClubId ? getClub(parentClubId) : undefined;
  if (!club || !season) return null;

  const played = season.gamesPlayed;
  const goals = season.goals;
  const ratio = played > 0 ? goals / played : 0;
  const threshold = role === 'first-team' ? club.firstTeamGoalRatio : club.reserveGoalRatio;
  const ratioProgress = Math.min(1, threshold > 0 ? ratio / threshold : 0);
  const available = isAvailable(availability);
  const matchesLeft = SEASON_LENGTH - season.matches.length;

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-5 py-[max(1.25rem,env(safe-area-inset-top))] pb-10 text-white">
      <div className="mb-5 flex items-center justify-between">
        <button type="button" onClick={onOpenMenu} className="text-xs text-white/40 underline underline-offset-2">
          Menu
        </button>
        <span className="text-xs text-white/40">Age {age}</span>
      </div>

      <div className="flex flex-col gap-5">

      <div className="rounded-2xl bg-white/5 p-4" style={{ borderLeft: `4px solid ${club.color}` }}>
        <p className="text-xs uppercase tracking-wide text-white/40">
          Season {seasonNumber} · {ROLE_LABEL[role]}
        </p>
        <h1 className="text-2xl font-extrabold">{club.name}</h1>
        <p className="text-xs text-white/50">
          {club.country} · {club.league}
        </p>
        {parentClub && <p className="mt-1 text-xs text-white/40">On loan from {parentClub.name}</p>}
        <SeasonCompetitions calendar={seasonCalendar} />
      </div>

      <div
        className={`rounded-xl px-4 py-3 text-sm font-semibold ${
          available ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
        }`}
      >
        {describeAvailability(availability)}
      </div>

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
        <p className="mt-1 text-xs text-white/40">{matchesLeft} matches left this season</p>
        {parentClub && (
          <p className="mt-2 text-xs text-emerald-300/80">
            Hit {parentClub.reserveGoalRatio.toFixed(2)} and {parentClub.name} will bring you straight back into their
            first team.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <p className="text-lg font-bold">{careerGoals}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Career goals</p>
        </div>
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <p className="text-lg font-bold">{careerGames}</p>
          <p className="text-[10px] uppercase tracking-wide text-white/40">Career games</p>
        </div>
      </div>

        <RecentForm matches={season.matches} />
      </div>

      <button
        type="button"
        onClick={advance}
        className="mt-8 rounded-2xl bg-emerald-500 px-6 py-4 text-lg font-bold text-black shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
      >
        {available ? 'Play Next Match' : 'Continue'}
      </button>
    </div>
  );
}

/**
 * A honest, calendar-only hint at what else this season involves - the
 * competitions the club/country qualified for, not a live table (there's no
 * league-table/European-standing simulation yet - see matchEngine.ts). Once
 * that exists, this is where the locked design's "league position + European
 * standing only" summary will replace this simple badge list.
 */
function SeasonCompetitions({ calendar }: { calendar: SeasonCalendar | null }) {
  if (!calendar) return null;
  const cupIds = new Set(calendar.fixtures.map((f) => f.continentalCup).filter((id) => id !== undefined));
  const international = calendarIncludesInternational(calendar);
  if (cupIds.size === 0 && !international) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {[...cupIds].map((id) => (
        <span key={id} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          {CONTINENTAL_CUPS[id].name}
        </span>
      ))}
      {international && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
          {INTERNATIONAL_TOURNAMENTS[international].name}
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
