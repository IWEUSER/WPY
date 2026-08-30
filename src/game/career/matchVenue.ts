import { fixtureCrowdAwayShare, fixtureIsHome, fixtureIsNight, isClubFinalNeutral, isInternationalTournamentFixture, type CalendarFixture } from './calendar';
import { getClub, type Club } from './data/clubs';
import { clubKit } from './data/clubKits';
import { nationKitOrFallback } from './data/nationColours';
import { fifaRank } from './data/fifaRankings';
import type { Nation } from './data/nations';
import type { KitScheme } from '../shooting/kitPalette';
import { stadiumScaleFromCapacity, type StadiumAppearance } from '../shooting/stadium';
import { groundForClub, groundForClubTrial, groundForCupFinal, groundForInternationalTournament, groundForNationRank, groundForYouthTournament, UNLISTED_GROUND, type ClubGround } from '../shooting/grounds';

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
  openingKind?: 'youth-tournament' | 'club-trial' | null;
}): StadiumAppearance {
  const { fixture, club, nation, openingKind } = args;
  const isInternational = fixture?.kind === 'international';
  const clubFinal = fixture ? isClubFinalNeutral(fixture) : false;
  const intlTournament = fixture ? isInternationalTournamentFixture(fixture) : false;
  const neutral = clubFinal || intlTournament;
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
  const ground = openingKind === 'youth-tournament'
    ? groundForYouthTournament()
    : openingKind === 'club-trial'
      ? groundForClubTrial()
    : clubFinal
      ? groundForCupFinal()
      : intlTournament
        ? groundForInternationalTournament()
        : isInternational
          ? groundForNationRank(fifaRank(groundNationId ?? ''))
          : groundForClub(groundClub?.id);

  return appearanceFromGround(ground, {
    isHome: neutral ? true : isHome,
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

/** Scout trial: the original open pitch, no stadium bowl. */
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
    bowl: false,
  };
}

/** Reserve-year matches use the generic municipal bowl, not a first-team ground. */
export function reserveStadium(club?: Club): StadiumAppearance {
  const home = clubKit(club);
  return appearanceFromGround(UNLISTED_GROUND, {
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

export function resolveCareerStadium(args: {
  fixture?: CalendarFixture;
  club?: Club;
  nation?: Nation;
  seasonNumber?: number;
  role?: 'reserve' | 'first-team' | 'loan';
  openingKind?: 'youth-tournament' | 'club-trial' | null;
}): StadiumAppearance {
  if (args.openingKind === 'youth-tournament' || args.openingKind === 'club-trial') {
    return resolveMatchStadium({ ...args, openingKind: args.openingKind });
  }
  if ((args.seasonNumber != null && args.seasonNumber < 2) || args.role === 'reserve') {
    return reserveStadium(args.club);
  }
  return resolveMatchStadium(args);
}
