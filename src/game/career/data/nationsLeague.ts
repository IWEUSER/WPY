import { fifaRank } from './fifaRankings';
import { getNation } from './nations';

/** Fixed Nations League league-phase groups (A–L). */
export const NATIONS_LEAGUE_GROUPS: Record<string, readonly string[]> = {
  A: ['france', 'italy', 'belgium', 'turkey'],
  B: ['germany', 'netherlands', 'serbia', 'greece'],
  C: ['spain', 'croatia', 'england', 'czechia'],
  D: ['portugal', 'denmark', 'norway', 'wales'],
  E: ['scotland', 'switzerland', 'slovenia', 'north-macedonia'],
  F: ['hungary', 'ukraine', 'georgia', 'northern-ireland'],
  G: ['israel', 'austria', 'republic-of-ireland', 'kosovo'],
  H: ['poland', 'bosnia-and-herzegovina', 'romania', 'sweden'],
  I: ['albania', 'finland', 'belarus', 'san-marino'],
  J: ['montenegro', 'armenia', 'cyprus', 'latvia'],
  K: ['kazakhstan', 'slovakia', 'faroe-islands', 'moldova'],
  L: ['iceland', 'bulgaria', 'estonia', 'luxembourg'],
};

export const NATIONS_LEAGUE_QF_GROUPS = ['A', 'B', 'C', 'D'] as const;

/** UEFA sides that default into each European Championship (groups A–H). */
export const EURO_DEFAULT_QUALIFIERS: readonly string[] = [
  ...NATIONS_LEAGUE_GROUPS.A,
  ...NATIONS_LEAGUE_GROUPS.B,
  ...NATIONS_LEAGUE_GROUPS.C,
  ...NATIONS_LEAGUE_GROUPS.D,
  ...NATIONS_LEAGUE_GROUPS.E,
  ...NATIONS_LEAGUE_GROUPS.F,
  ...NATIONS_LEAGUE_GROUPS.G,
  ...NATIONS_LEAGUE_GROUPS.H,
];

export function nationsLeagueGroupLetter(nationId: string): string | null {
  for (const [letter, teams] of Object.entries(NATIONS_LEAGUE_GROUPS)) {
    if (teams.includes(nationId)) return letter;
  }
  return null;
}

export function nationsLeagueGroupTeams(nationId: string): string[] {
  const letter = nationsLeagueGroupLetter(nationId);
  if (!letter) return [];
  return [...NATIONS_LEAGUE_GROUPS[letter]];
}

export function nationsLeagueCanReachKnockout(nationId: string): boolean {
  const letter = nationsLeagueGroupLetter(nationId);
  return letter != null && (NATIONS_LEAGUE_QF_GROUPS as readonly string[]).includes(letter);
}

export function isEuroDefaultQualifier(nationId: string): boolean {
  return EURO_DEFAULT_QUALIFIERS.includes(nationId);
}

/**
 * Snake-seed the 32 Euro defaults into eight groups of four, strongest to
 * weakest, so pots reshuffle every championship.
 */
export function seededEuroGroups(seasonNumber: number): Record<string, string[]> {
  const ranked = [...EURO_DEFAULT_QUALIFIERS].sort((a, b) => {
    const d = fifaRank(a) - fifaRank(b);
    if (d !== 0) return d;
    return a.localeCompare(b);
  });
  const offset = Math.abs(seasonNumber * 3) % ranked.length;
  const rotated = [...ranked.slice(offset), ...ranked.slice(0, offset)];
  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const groups: Record<string, string[]> = Object.fromEntries(letters.map((l) => [l, []]));
  rotated.forEach((id, i) => {
    const row = Math.floor(i / letters.length);
    const col = row % 2 === 0 ? i % letters.length : letters.length - 1 - (i % letters.length);
    groups[letters[col]].push(id);
  });
  return groups;
}

export function euroGroupForNation(nationId: string, seasonNumber: number): { letter: string; teams: string[] } | null {
  if (!isEuroDefaultQualifier(nationId)) return null;
  const groups = seededEuroGroups(seasonNumber);
  for (const [letter, teams] of Object.entries(groups)) {
    if (teams.includes(nationId)) return { letter, teams };
  }
  return null;
}

export function nationLabel(id: string): string {
  return getNation(id)?.name ?? id;
}
