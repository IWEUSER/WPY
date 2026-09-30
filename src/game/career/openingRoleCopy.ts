import type { OpeningSquadPick } from './squadStatus';

export const OPENING_ROLE_EYEBROW = 'Season 1 place';
export const OPENING_ROLE_TITLE = 'How do you start?';
export const OPENING_ROLE_LEAD =
  'Choose your place for Season 1. You can still earn a bigger role — or lose minutes — from here.';

export const OPENING_ROLE_CARDS: readonly {
  id: OpeningSquadPick;
  title: string;
  body: string;
}[] = [
  {
    id: 'rising-star',
    title: 'Rising star',
    body: 'Coming through as a young player. The club eases you in and watches what you do with the minutes you get.',
  },
  {
    id: 'impact',
    title: 'Impact',
    body: 'In the squad to change games. More involved than a Rising star, and a step toward the starting XI if you take your chances.',
  },
  {
    id: 'starter',
    title: 'Starter',
    body: 'Trusted in the side from the first whistle. You play the matches that matter and take the looks that come with that place.',
  },
];
