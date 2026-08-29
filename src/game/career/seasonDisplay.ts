/** Public-facing season numbers skip the reserve year: internal season 2 is Season 1. */
export function displaySeasonNumber(seasonNumber: number): number | null {
  if (seasonNumber < 2) return null;
  return seasonNumber - 1;
}

export function displaySeasonLabel(seasonNumber: number): string {
  const n = displaySeasonNumber(seasonNumber);
  return n === null ? 'Reserves' : `Season ${n}`;
}

/** The opening reserve year is hidden from the career record and overall ratio. */
export function countsTowardCareerRecord(seasonNumber: number): boolean {
  return seasonNumber >= 2;
}
