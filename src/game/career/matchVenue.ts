import { fixtureCrowdAwayShare, fixtureIsHome, type CalendarFixture } from './calendar';
import { getClub, type Club } from './data/clubs';
import { nationKitOrFallback } from './data/nationColours';
import type { Nation } from './data/nations';
import type { KitScheme } from '../shooting/kitPalette';
import { schemeFromColor } from '../shooting/kitPalette';
import type { StadiumAppearance } from '../shooting/stadium';

const GENERIC_OPPONENT = '#1D4ED8';

function clubScheme(club: Club | undefined, fallback = GENERIC_OPPONENT): KitScheme {
  if (!club) return { primary: fallback };
  return schemeFromColor(club.color);
}

/**
 * Home/away stadium look for a live match: majority crowd is the side
 * whose ground it is; the defender always wears the opponent's kit.
 */
export function resolveMatchStadium(args: {
  fixture?: CalendarFixture;
  club?: Club;
  nation?: Nation;
}): StadiumAppearance {
  const { fixture, club, nation } = args;
  const isInternational = fixture?.kind === 'international';
  const isHome = fixture ? fixtureIsHome(fixture) : true;

  const player: KitScheme = isInternational
    ? nationKitOrFallback(nation?.id)
    : clubScheme(club);
  const opponent: KitScheme = isInternational
    ? nationKitOrFallback(fixture?.opponentId)
    : clubScheme(fixture?.opponentId ? getClub(fixture.opponentId) : undefined);

  const home = isHome ? player : opponent;
  const away = isHome ? opponent : player;

  return {
    isHome,
    homeColor: home.primary,
    homeSecondary: home.secondary,
    awayColor: away.primary,
    awaySecondary: away.secondary,
    opponentColor: opponent.primary,
    opponentSecondary: opponent.secondary,
    awayShare: fixture ? fixtureCrowdAwayShare(fixture) : 0.2,
  };
}

export function trialStadium(nation?: Nation): StadiumAppearance {
  const home = nationKitOrFallback(nation?.id);
  const away: KitScheme = { primary: GENERIC_OPPONENT };
  return {
    isHome: true,
    homeColor: home.primary,
    homeSecondary: home.secondary,
    awayColor: away.primary,
    opponentColor: away.primary,
    awayShare: 0.22,
  };
}
