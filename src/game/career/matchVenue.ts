import { fixtureCrowdAwayShare, fixtureIsHome, fixtureIsNight, type CalendarFixture } from './calendar';
import { getClub, type Club } from './data/clubs';
import { clubKit } from './data/clubKits';
import { nationKitOrFallback } from './data/nationColours';
import type { Nation } from './data/nations';
import type { KitScheme } from '../shooting/kitPalette';
import type { StadiumAppearance } from '../shooting/stadium';

const GENERIC_OPPONENT: KitScheme = { primary: '#1D4ED8', pattern: 'solid' };

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
    : clubKit(club);
  const opponent: KitScheme = isInternational
    ? nationKitOrFallback(fixture?.opponentId)
    : clubKit(fixture?.opponentId ? getClub(fixture.opponentId) : undefined);

  const home = isHome ? player : opponent;
  const away = isHome ? opponent : player;

  return {
    isHome,
    night: fixture ? fixtureIsNight(fixture) : false,
    homeColor: home.primary,
    homeSecondary: home.secondary,
    awayColor: away.primary,
    awaySecondary: away.secondary,
    opponentColor: opponent.primary,
    opponentSecondary: opponent.secondary,
    opponentShorts: opponent.shorts,
    opponentPattern: opponent.pattern,
    awayShare: fixture ? fixtureCrowdAwayShare(fixture) : 0.2,
  };
}

export function trialStadium(nation?: Nation): StadiumAppearance {
  const home = nationKitOrFallback(nation?.id);
  return {
    isHome: true,
    night: false,
    homeColor: home.primary,
    homeSecondary: home.secondary,
    awayColor: GENERIC_OPPONENT.primary,
    opponentColor: GENERIC_OPPONENT.primary,
    opponentPattern: 'solid',
    awayShare: 0.22,
  };
}
