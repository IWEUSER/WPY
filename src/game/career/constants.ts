/** Fallback when a club's league size is unknown. Real seasons use
 * `leagueMatchWeeks()` from the club list (home and away vs every rival). */
export const SEASON_LENGTH = 38;

/** Used to turn a weekly wage into season earnings. */
export const WEEKS_PER_SEASON = 52;

export const STARTING_AGE = 16;

/** Last season the player can play. The career ends after this age. */
export const RETIREMENT_AGE = 36;

/** Rolling window of club+country games used by the WPY "extreme form" clause. */
export const FORM_WINDOW_GAMES = 50;
