import { getClub, SECOND_DIVISIONS, clubsInCountry, clubsInLeague, type Club } from './data/clubs';
import { leagueDisplayName } from './data/leagueFormat';

const NAMED_SUPER_CUPS: Record<string, string> = {
  England: 'English Super Cup',
  Spain: 'Spanish Super Cup',
  Italy: 'Italian Super Cup',
  Germany: 'German Super Cup',
  France: 'French Super Cup',
  Portugal: 'Portuguese Super Cup',
  Netherlands: 'Dutch Super Cup',
  Belgium: 'Belgian Super Cup',
  Turkey: 'Turkish Super Cup',
  Scotland: 'Scottish Super Cup',
  Brazil: 'Brazilian Super Cup',
  Argentina: 'Argentine Super Cup',
  Colombia: 'Colombian Super Cup',
  Mexico: 'Mexican Super Cup',
  Japan: 'Japanese Super Cup',
  'South Korea': 'Korean Super Cup',
  Australia: 'Australian Super Cup',
  'United States': 'American Super Cup',
  Canada: 'American Super Cup',
};

/** Saudi already has its four-team Super Cup. Do not schedule a second one. */
export function domesticSuperCupName(country: string, league?: string | null): string | null {
  if (league === 'Saudi Pro League') return null;
  if (league === 'MLS' || country === 'United States' || country === 'Canada') return 'American Super Cup';
  return NAMED_SUPER_CUPS[country] ?? (league ? `${leagueDisplayName(league)} Super Cup` : `${country} Super Cup`);
}

export function planDomesticSuperCup(params: {
  nextClub: Club;
  previousClubId: string | null;
  wonLeague: boolean;
  wonCup: boolean;
  previousLeague?: string | null;
}): { include: boolean; opponentId?: string; name?: string } {
  const { nextClub, previousClubId, previousLeague } = params;
  if (!previousClubId || previousClubId !== nextClub.id) return { include: false };
  const league = previousLeague ?? nextClub.league;
  const name = domesticSuperCupName(nextClub.country, league);
  if (!name) return { include: false };
  const leagueTitleCounts = params.wonLeague && !SECOND_DIVISIONS.has(league);
  if (!leagueTitleCounts && !params.wonCup) return { include: false };

  const pool = [
    ...clubsInLeague(league),
    ...clubsInCountry(nextClub.country),
  ].filter((c) => c.id !== nextClub.id && c.playable !== false);
  const ranked = [...pool].sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
  const opponent = ranked[0] ?? getClub(nextClub.id === 'real-madrid' ? 'barcelona' : 'real-madrid');
  return { include: true, opponentId: opponent?.id, name };
}
