import { fixtureCrowdAwayShare, fixtureIsHome, fixtureIsNeutral, fixtureIsNight, type CalendarFixture } from './calendar';
import { getClub, type Club } from './data/clubs';
import { clubKit } from './data/clubKits';
import { nationKitOrFallback } from './data/nationColours';
import { fifaRank } from './data/fifaRankings';
import type { Nation } from './data/nations';
import type { KitScheme } from '../shooting/kitPalette';
import { stadiumScaleFromCapacity, type StadiumAppearance } from '../shooting/stadium';
import { groundForClub, groundForCupFinal, groundForNationRank, type ClubGround } from '../shooting/grounds';

const GENERIC_OPPONENT: KitScheme = { primary: '#1D4ED8', pattern: 'solid' };

function appearanceFromGround(
  ground: ClubGround,
  base: Omit<StadiumAppearance, 'capacity' | 'standTiers' | 'unique' | 'groundName' | 'scale'>,
): StadiumAppearance {
  return {
    ...base,
    scale: stadiumScaleFromCapacity(ground.capacity),
    capacity: ground.capacity,
    standTiers: ground.tiers,
    unique: ground.unique,
    groundName: ground.name,
  };
}

/**
 * Home/away stadium look for a live match: majority crowd is the side
 * whose ground it is; the defender always wears the opponent's kit.
 * Stand height follows that club's real capacity; decks follow the table.
 */
export function resolveMatchStadium(args: {
  fixture?: CalendarFixture;
  club?: Club;
  nation?: Nation;
}): StadiumAppearance {
  const { fixture, club, nation } = args;
  const isInternational = fixture?.kind === 'international';
  const neutral = fixture ? fixtureIsNeutral(fixture) : false;
  const isHome = fixture ? fixtureIsHome(fixture) : true;

  const player: KitScheme = isInternational
    ? nationKitOrFallback(nation?.id)
    : clubKit(club);
  const opponent: KitScheme = isInternational
    ? nationKitOrFallback(fixture?.opponentId)
    : clubKit(fixture?.opponentId ? getClub(fixture.opponentId) : undefined);

  const home = neutral || isHome ? player : opponent;
  const away = neutral || isHome ? opponent : player;
  const groundClub = isInternational || neutral
    ? undefined
    : (isHome ? club : (fixture?.opponentId ? getClub(fixture.opponentId) : undefined));
  const groundNationId = isInternational
    ? (isHome ? nation?.id : fixture?.opponentId)
    : undefined;
  const ground = neutral
    ? groundForCupFinal()
    : isInternational
      ? groundForNationRank(fifaRank(groundNationId ?? ''))
      : groundForClub(groundClub?.id);

  return appearanceFromGround(ground, {
    isHome,
    night: fixture ? fixtureIsNight(fixture) : false,
    homeColor: home.primary,
    homeSecondary: home.secondary,
    awayColor: away.primary,
    awaySecondary: away.secondary,
    opponentColor: opponent.primary,
    opponentSecondary: opponent.secondary,
    opponentShorts: opponent.shorts,
    opponentSocks: opponent.socks,
    opponentPattern: opponent.pattern,
    awayShare: fixture ? fixtureCrowdAwayShare(fixture) : 0.2,
  });
}

export function trialStadium(nation?: Nation): StadiumAppearance {
  const home = nationKitOrFallback(nation?.id);
  return appearanceFromGround(groundForClub(undefined), {
    isHome: true,
    night: false,
    homeColor: home.primary,
    homeSecondary: home.secondary,
    awayColor: GENERIC_OPPONENT.primary,
    opponentColor: GENERIC_OPPONENT.primary,
    opponentPattern: 'solid',
    awayShare: 0.22,
  });
}
