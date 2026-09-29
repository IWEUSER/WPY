export const OPENING_ROLE_EYEBROW = 'Season 1 place';
export const OPENING_ROLE_TITLE = 'Join as a Rising star';
export const OPENING_ROLE_LEAD =
  'Every career starts Season 1 as a Rising star. Play the full first season — team selection, chances, and the path up — before Season 2.';
export const JOIN_RISING_STAR_LABEL = 'Join as a Rising star';

export const OPENING_ROLE_CARDS = [
  {
    id: 'rising-star',
    title: 'Rising star',
    body: 'You do not pick the XI — the club rotates you. Sit the first match, then every fourth league game. One chance each time you play. No continental, super-cup, or Leagues Cup minutes, and only the first two domestic cup ties. Extra goals in one game still count as one.',
  },
  {
    id: 'impact',
    title: 'Impact',
    body: 'Score in 3 consecutive games as a Rising star to become Impact. Impact plays league, cups, and continentals, still on the every-fourth rotation, and sits two of three tough games. Two chances each time you play. Keep it for the rest of the season.',
  },
  {
    id: 'starter',
    title: 'Starter',
    body: 'A Starter is in the starting XI across league, cups, and internationals — every game, no rotation sit-outs, with the full number of chances the fixture draws. Score in 3 more consecutive games as Impact to earn it.',
  },
  {
    id: 'reserve',
    title: 'Reserve',
    body: 'If you lose your place later, Reserve sits European Cup nights. In the European Trophy or lower, continental ties come first and league games are the ones rotated. Every second other game. Score in 3 consecutive games to become a Starter.',
  },
] as const;
