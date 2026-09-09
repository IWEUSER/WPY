/** Public-facing season numbers skip the reserve year: internal season 2 is Season 1. */
export function displaySeasonNumber(
  seasonNumber: number,
  opts?: { role?: 'reserve' | 'first-team' | 'loan'; careerStart?: string | null },
): number | null {
  if (opts?.role === 'reserve') return null;
  if (opts?.careerStart === 'favourite-first-team') return Math.max(1, seasonNumber);
  if (seasonNumber < 2) return opts?.role === 'first-team' || opts?.role === 'loan' ? 1 : null;
  return seasonNumber - 1;
}

export function displaySeasonLabel(
  seasonNumber: number,
  opts?: { role?: 'reserve' | 'first-team' | 'loan'; careerStart?: string | null },
): string {
  const n = displaySeasonNumber(seasonNumber, opts);
  return n === null ? 'Reserves' : `Season ${n}`;
}

/** The opening reserve year is hidden from the career record and overall ratio. */
export function countsTowardCareerRecord(
  seasonNumber: number,
  role?: 'reserve' | 'first-team' | 'loan',
): boolean {
  if (role === 'reserve') return false;
  if (role === 'first-team' || role === 'loan') return true;
  return seasonNumber >= 2;
}
