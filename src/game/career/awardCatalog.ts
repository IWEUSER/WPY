import { CONTINENTAL_CUPS, INTERNATIONAL_TOURNAMENTS } from './data/competitions';

export interface AwardCopy {
  first: string;
  again: string;
}

const LEAGUE_BOOT: AwardCopy = {
  first:
    "The Golden Boot is yours; the league's defenders spent a season trying to stop you, and every single one failed.",
  again:
    'The Golden Boot returns to you. Defenders had a whole season to learn, and they still could not live with you.',
};

const LEAGUE_PLAYER: AwardCopy = {
  first:
    "The undivided respect of your peers—you didn't just play in the league this year, you completely dictated it.",
  again:
    'Voted the best in the league again. When the votes come in, there is only one column that matters.',
};

const WPY: AwardCopy = {
  first: 'The debate is officially over; look at the trophy in your hands—you are the best football player on planet earth.',
  again: 'The planet’s best, confirmed again. The debate did not even last until winter.',
};

const AFRICAN_PLAYER: AwardCopy = {
  first: 'African Player of the Year — the continent has named you its finest.',
  again: 'African Player of the Year again. The continent has not changed its mind.',
};

const ASIAN_PLAYER: AwardCopy = {
  first: 'Asian Player of the Year — the continent has named you its finest.',
  again: 'Asian Player of the Year again. The continent has not changed its mind.',
};

const CLUB_AWARDS: Record<string, AwardCopy> = {
  'European Cup Player of the Tournament': {
    first:
      'Player of the European Cup. This is the club tournament that outranks the rest of Europe, and it had one name on it.',
    again:
      'Player of the European Cup again. The other European trophies are not this; this one still bends to you.',
  },
  'European Cup top goalscorer': {
    first:
      'The European Cup golden boot. Most goals in the club competition that matters more than any other in Europe.',
    again:
      'The European Cup golden boot is yours again. Same tournament, same finishing chart, still the one that counts.',
  },
  'European Trophy Player of the Tournament': {
    first:
      'Player of the European Trophy — a proper honour, and still a step below the European Cup.',
    again:
      'Player of the European Trophy again. Useful silver; the European Cup remains the one above it.',
  },
  'European Trophy top goalscorer': {
    first:
      'Most goals in the European Trophy. A finishing title, not the European Cup golden boot.',
    again:
      'European Trophy top goalscorer again. The chart is yours; the European Cup chart is the bigger one.',
  },
  'European Challenge Player of the Tournament': {
    first:
      'Player of the European Challenge. A European night, not the European Cup.',
    again:
      'Player of the European Challenge again. Still Europe, still not the Cup.',
  },
  'European Challenge top goalscorer': {
    first:
      'Most goals in the European Challenge. A scoring title on the third European rung.',
    again:
      'European Challenge top goalscorer again. Same rung, same chart.',
  },
  'Asian Club Cup Player of the Tournament': {
    first:
      'Player of the Asian Club Cup. The continent’s club tournament had one outstanding name.',
    again:
      'Player of the Asian Club Cup again. Asia’s club nights still run through you.',
  },
  'Asian Club Cup top goalscorer': {
    first: 'Most goals in the Asian Club Cup. The continent’s club finishing chart is yours.',
    again: 'Asian Club Cup top goalscorer again. Same tournament, same mark.',
  },
  'South American Cup Player of the Tournament': {
    first:
      'Player of the South American Cup. The continent’s great club tournament belonged to you.',
    again:
      'Player of the South American Cup again. Those club nights have not found anyone else.',
  },
  'South American Cup top goalscorer': {
    first: 'Most goals in the South American Cup. The finishing chart on that stage is yours.',
    again: 'South American Cup top goalscorer again. Same competition, same standard.',
  },
  'South American Trophy Player of the Tournament': {
    first:
      'Player of the South American Trophy — the second club prize on that continent, and still yours.',
    again:
      'Player of the South American Trophy again. The Cup above it is the bigger one.',
  },
  'South American Trophy top goalscorer': {
    first: 'Most goals in the South American Trophy. A scoring title on the second continental rung.',
    again: 'South American Trophy top goalscorer again. Same rung, same chart.',
  },
  'North American Cup Player of the Tournament': {
    first: 'Player of the North American Cup. The regional club tournament had your name on it.',
    again: 'Player of the North American Cup again. The region still looks to you.',
  },
  'North American Cup top goalscorer': {
    first: 'Most goals in the North American Cup. The finishing chart is yours.',
    again: 'North American Cup top goalscorer again. Same tournament, same mark.',
  },
  'Continental Player of the Tournament': {
    first: 'Player of the tournament in a continental club competition.',
    again: 'Player of that continental club tournament again.',
  },
  'Continental top goalscorer': {
    first: 'Top goalscorer in a continental club competition.',
    again: 'Continental club top goalscorer again.',
  },
};

const NATION_AWARDS: Record<string, AwardCopy> = {
  'World Championship Player of the Tournament': {
    first: 'A tournament defined by your individual genius, carrying your nation through the fire to absolute history.',
    again: 'The world’s tournament, your tournament — again. History does not usually repeat this cleanly.',
  },
  'World Championship top goalscorer': {
    first:
      'The Golden Boot at the World Championship — most goals at the tournament, not a league season dressed up as something else.',
    again:
      'The World Championship Golden Boot is yours again. Same tournament, same finishing chart, another top mark.',
  },
  'European Nations Cup Player of the Tournament': {
    first: 'Europe’s finest nights belonged to you; the tournament had one name on it from the first whistle.',
    again: 'Europe’s player of the tournament, twice over. The rest of the grid was playing for second.',
  },
  'European Nations Cup top goalscorer': {
    first: 'Most goals at the European Nations Cup. This is the finishing chart for that tournament, nothing else.',
    again: 'European Nations Cup top goalscorer again. Same grid, same chart.',
  },
  'Nations Cup Player of the Tournament': {
    first: 'You were the difference in every round; the Nations Cup had a player, and that player was you.',
    again: 'You owned the Nations Cup again. Same shirt, same gravity, another golden night.',
  },
  'Nations Cup top goalscorer': {
    first: 'Most goals at the Nations Cup. The tournament finishing chart is yours.',
    again: 'Nations Cup top goalscorer again. The chart still has your name at the top.',
  },
  'South American Championship Player of the Tournament': {
    first:
      'Player of the South American Championship. A continent on your shoulders, and the tournament had your name on it.',
    again:
      'Player of the South American Championship again. Your continent still looks to you when it tightens.',
  },
  'South American Championship top goalscorer': {
    first: 'Most goals at the South American Championship. That tournament’s finishing chart is yours.',
    again: 'South American Championship top goalscorer again. Same tournament, same mark.',
  },
  'North American Championship Player of the Tournament': {
    first: 'Player of the North American Championship. The tournament had one outstanding name.',
    again: 'Player of the North American Championship again. The region has not found another.',
  },
  'North American Championship top goalscorer': {
    first: 'Most goals at the North American Championship. The finishing chart is yours.',
    again: 'North American Championship top goalscorer again. Same tournament, same mark.',
  },
  'African Championship Player of the Tournament': {
    first: 'Player of the African Championship. The tournament belonged to you from the first whistle.',
    again: 'Player of the African Championship again. The continent’s tournament still runs through you.',
  },
  'African Championship top goalscorer': {
    first: 'Most goals at the African Championship. That tournament’s finishing chart is yours.',
    again: 'African Championship top goalscorer again. Same tournament, same mark.',
  },
  'Asian Championship Player of the Tournament': {
    first: 'Player of the Asian Championship. The tournament had one name on it.',
    again: 'Player of the Asian Championship again. Asia’s tournament nights still bend to you.',
  },
  'Asian Championship top goalscorer': {
    first: 'Most goals at the Asian Championship. That tournament’s finishing chart is yours.',
    again: 'Asian Championship top goalscorer again. Same tournament, same mark.',
  },
  'Oceania Championship Player of the Tournament': {
    first: 'Player of the Oceania Championship. The tournament had your name on it.',
    again: 'Player of the Oceania Championship again. Same shirt, same gravity.',
  },
  'Oceania Championship top goalscorer': {
    first: 'Most goals at the Oceania Championship. The finishing chart is yours.',
    again: 'Oceania Championship top goalscorer again. Same tournament, same mark.',
  },
  'Continental Championship Player of the Tournament': {
    first: 'Player of the Continental Championship. The tournament had your name on it.',
    again: 'Player of the Continental Championship again.',
  },
  'Continental Championship top goalscorer': {
    first: 'Most goals at the Continental Championship.',
    again: 'Continental Championship top goalscorer again.',
  },
};

export const AWARD_CATALOG: Record<string, AwardCopy> = {
  'League top goalscorer': LEAGUE_BOOT,
  'League player of the year': LEAGUE_PLAYER,
  'World Player of the Year': WPY,
  'African Player of the Year': AFRICAN_PLAYER,
  'Asian Player of the Year': ASIAN_PLAYER,
  ...CLUB_AWARDS,
  ...NATION_AWARDS,
};

/** Every individual award the career can currently award, plus the matching club-cup scoring titles. */
export const ALL_AWARD_NAMES: readonly string[] = Object.freeze(Object.keys(AWARD_CATALOG));

const LEGACY_AWARD_MILESTONE: Record<string, string> = {
  'League top goalscorer': 'league-golden-boot',
  'League player of the year': 'league-player',
  'World Championship top goalscorer': 'world-golden-boot',
  'World Championship Player of the Tournament': 'world-pott',
  'European Nations Cup Player of the Tournament': 'euro-pott',
  'Nations Cup Player of the Tournament': 'nations-pott',
  'World Player of the Year': 'wpy',
};

export function awardMilestoneIdForName(awardName: string): string {
  return `award:${awardName.trim()}`;
}

export function hasWonThisAward(
  seen: readonly string[] | null | undefined,
  awardName: string,
): boolean {
  const name = awardName.trim();
  if (!name) return false;
  const ids = seen ?? [];
  if (ids.includes(awardMilestoneIdForName(name))) return true;
  const legacy = LEGACY_AWARD_MILESTONE[name];
  return Boolean(legacy && ids.includes(legacy));
}

export function awardCopyForName(awardName: string, first: boolean, fallback?: string | null): string {
  const entry = AWARD_CATALOG[awardName.trim()];
  if (entry) return first ? entry.first : entry.again;
  const trimmed = fallback?.trim();
  if (trimmed) return trimmed;
  return first
    ? 'An individual honour. This one is new.'
    : 'This honour returns to you. You have won this specific award before.';
}

/** Guard so a newly added competition still has award lines. */
export function missingCatalogAwards(): string[] {
  const expected = new Set<string>([
    'League top goalscorer',
    'League player of the year',
    'World Player of the Year',
    'African Player of the Year',
    'Asian Player of the Year',
  ]);
  for (const cup of Object.values(CONTINENTAL_CUPS)) {
    expected.add(`${cup.name} Player of the Tournament`);
    expected.add(`${cup.name} top goalscorer`);
  }
  for (const cup of Object.values(INTERNATIONAL_TOURNAMENTS)) {
    expected.add(`${cup.name} Player of the Tournament`);
    expected.add(`${cup.name} top goalscorer`);
  }
  return [...expected].filter((name) => !AWARD_CATALOG[name]);
}
