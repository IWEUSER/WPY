/** Public season numbers. First-team and loan seasons count from 1.
 * A leftover academy `reserve` role (old saves) is hidden from the label. */
export function displaySeasonNumber(
  seasonNumber: number,
  opts?: { role?: 'reserve' | 'first-team' | 'loan'; careerStart?: string | null },
): number | null {
  if (opts?.role === 'reserve') return null;
  if (opts?.role === 'first-team' || opts?.role === 'loan') return Math.max(1, seasonNumber);
  if (
    opts?.careerStart === 'favourite-first-team'
    || opts?.careerStart === 'youth'
    || opts?.careerStart === 'favourite-trial'
  ) {
    return Math.max(1, seasonNumber);
  }
  if (seasonNumber < 2) return null;
  return seasonNumber - 1;
}

/** First public first-team season on every career path (age 17, then 18 in Season 2). */
export function isFirstPublicSeason(
  seasonNumber: number,
  opts?: { role?: 'reserve' | 'first-team' | 'loan'; careerStart?: string | null },
): boolean {
  return displaySeasonNumber(seasonNumber, opts) === 1;
}

export function displaySeasonLabel(
  seasonNumber: number,
  opts?: { role?: 'reserve' | 'first-team' | 'loan'; careerStart?: string | null },
): string {
  const n = displaySeasonNumber(seasonNumber, opts);
  return n === null ? 'Reserves' : `Season ${n}`;
}

/** Academy leftover seasons stay out of the career record. First-team and loans count. */
export function countsTowardCareerRecord(
  seasonNumber: number,
  role?: 'reserve' | 'first-team' | 'loan',
): boolean {
  if (role === 'reserve') return false;
  if (role === 'first-team' || role === 'loan') return true;
  return seasonNumber >= 2;
}
