/** Product name. The in-game award stays World Player of the Year. */
export const GAME_TITLE = 'Football Legacy';
export const GAME_SHORT_TITLE = 'Legacy';
export const GAME_TAGLINE = '20 seasons. Chase the all-time records.';
export const GAME_LOGO_SRC = '/logo.png';
export const WPY_AWARD_NAME = 'World Player of the Year';

/**
 * Human label for the current live ship. Update this whenever merging to main
 * so the first menu names what landed. The UTC clock is added at build time.
 */
export const LIVE_SHIP_LABEL = 'No reserve · Youth trials';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** UTC clock shown on the first menu so a live PWA can be matched to a deploy. */
export function formatLiveBuildStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${day} ${month} ${hours}:${minutes} UTC`;
}

function builtAtIso(): string {
  try {
    const fromEnv = import.meta.env?.VITE_LIVE_BUILT_AT;
    if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  } catch {
    // tsx scripts have no Vite env.
  }
  return '';
}

/** First-menu stamp: ship name plus the production build clock. */
export function liveMenuStamp(builtAt = builtAtIso()): string {
  if (!builtAt) return `${LIVE_SHIP_LABEL} · dev`;
  return `${LIVE_SHIP_LABEL} · ${formatLiveBuildStamp(builtAt)}`;
}
