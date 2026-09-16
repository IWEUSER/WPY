import { TARGET_LEAGUE_SIZE, getClub } from './data/clubs';
import {
  CONTINENTAL_TOURNAMENT_FOR_CONFEDERATION,
  DOMESTIC_CUPS,
  INTERNATIONAL_TOURNAMENTS,
  domesticCupForCountry,
  type Confederation,
  type DomesticCupId,
  type InternationalTournamentId,
} from './data/competitions';
import { leagueDisplayName } from './data/leagueFormat';
import { countsTowardCareerRecord } from './seasonDisplay';
import { aggregateContinental } from './seasonStats';
import type { NationalTeamState } from './international';
import type { SeasonRecord } from './types';

export const LEGACY_TABLE_SIZE = 99;
export const LEGACY_TOP_N = 10;
export const PLAYER_RECORD_NAME = 'You';

export type LegacyBoardKind = 'league' | 'champions-league' | 'national-cup' | 'tournament' | 'international';
export type LegacyReveal = 'outside' | 'listed' | 'top10';

export interface HistoricalScorer {
  name: string;
  goals: number;
}

export interface LegacyBoardDef {
  id: string;
  kind: LegacyBoardKind;
  title: string;
  subtitle: string;
  group: 'league' | 'club' | 'national' | 'international';
}

export interface LegacyTableRow {
  rank: number;
  name: string;
  goals: number;
  you: boolean;
}

export interface LegacyBoardView {
  def: LegacyBoardDef;
  historical: HistoricalScorer[];
  playerGoals: number;
  rank: number;
  reveal: LegacyReveal;
  rankLabel: string;
  goalsToEnter: number;
  goalsToTop10: number;
  tenthGoals: number;
  table: LegacyTableRow[] | null;
}

export interface LegacyCareerInput {
  seasons: SeasonRecord[];
  nationalTeam: NationalTeamState | null;
  currentLeague?: string | null;
  nationalityConfederation?: Confederation | null;
}

const LEAGUE_SCALE: Record<string, { first: number; last: number }> = {
  'Premier League': { first: 260, last: 54 },
  Championship: { first: 202, last: 48 },
  'La Liga': { first: 308, last: 72 },
  'La Liga 2': { first: 196, last: 52 },
  'Serie A': { first: 274, last: 68 },
  'Serie B': { first: 188, last: 46 },
  Bundesliga: { first: 318, last: 74 },
  '2. Bundesliga': { first: 176, last: 44 },
  'Ligue 1': { first: 288, last: 70 },
  'Ligue 2': { first: 168, last: 42 },
  'Primeira Liga': { first: 278, last: 66 },
  Eredivisie: { first: 272, last: 64 },
  'Super Lig': { first: 242, last: 56 },
  'Saudi Pro League': { first: 148, last: 36 },
  MLS: { first: 172, last: 40 },
};

const CUP_SCALE: Record<DomesticCupId, { first: number; last: number }> = {
  'fa-cup': { first: 44, last: 12 },
  'copa-del-rey': { first: 56, last: 14 },
  'coppa-italia': { first: 48, last: 12 },
  'dfb-pokal': { first: 52, last: 13 },
  'coupe-de-france': { first: 50, last: 13 },
  'kings-cup': { first: 38, last: 10 },
  'us-open-cup': { first: 34, last: 9 },
  'taca-de-portugal': { first: 46, last: 12 },
  'knvb-beker': { first: 42, last: 11 },
  'turkish-cup': { first: 40, last: 11 },
};

const TOURNAMENT_SCALE: Partial<Record<InternationalTournamentId, { first: number; last: number }>> = {
  'world-cup': { first: 16, last: 4 },
  euro: { first: 14, last: 3 },
  'copa-america': { first: 17, last: 4 },
  afcon: { first: 18, last: 4 },
  'asian-cup': { first: 16, last: 3 },
  'gold-cup': { first: 18, last: 4 },
  'ofc-nations-cup': { first: 14, last: 3 },
  'nations-league': { first: 10, last: 3 },
};

const CHAMPIONS_LEAGUE_SCALE = { first: 140, last: 22 };
const INTERNATIONAL_SCALE = { first: 109, last: 38 };

const TOURNAMENT_BOARDS: InternationalTournamentId[] = [
  'world-cup',
  'euro',
  'copa-america',
  'afcon',
  'asian-cup',
  'gold-cup',
  'ofc-nations-cup',
  'nations-league',
];

type NameCulture =
  | 'english'
  | 'spanish'
  | 'italian'
  | 'german'
  | 'french'
  | 'portuguese'
  | 'dutch'
  | 'turkish'
  | 'arabic'
  | 'american'
  | 'south-american'
  | 'african'
  | 'east-asian'
  | 'oceanic'
  | 'european';

const NAMES: Record<NameCulture, { first: string[]; last: string[] }> = {
  english: {
    first: ['Callum', 'Reece', 'Finley', 'Harvey', 'Owen', 'Ellis', 'Rhys', 'Kieran', 'Brody', 'Ewan', 'Nolan', 'Quinn', 'Alfie', 'Fraser', 'Keir', 'Bram', 'Leighton', 'Corin', 'Dorian', 'Travis', 'Malachi', 'Soren', 'Arlo', 'Jed', 'Kit'],
    last: ['Hargreaves', 'Whittaker', 'Croft', 'Pendleton', 'Ashford', 'Millward', 'Hawthorne', 'Langley', 'Pritchard', 'Colburn', 'Westbrook', 'Dunlevy', 'Fairclough', 'Thacker', 'Bexley', 'Calloway', 'Drayton', 'Fenwick', 'Halstead', 'Ingram', 'Kestrel', 'Rowanlea', 'Stanhope', 'Aldridge', 'Bramwell'],
  },
  spanish: {
    first: ['Mateo', 'Iker', 'Unai', 'Biel', 'Aitor', 'Gorka', 'Izan', 'Oriol', 'Ander', 'Ekaitz', 'Gaizka', 'Asier', 'Julen', 'Oier', 'Peio', 'Nil', 'Pol', 'Quim', 'Unax', 'Jon', 'Ibai', 'Markel', 'Eneko', 'Hodei', 'Aritz'],
    last: ['Palomares', 'Cifuentes', 'Arriaga', 'Larralde', 'Campuzano', 'Recalde', 'Villacorta', 'Najarro', 'Zalduegi', 'Igartua', 'Basterra', 'Valduerna', 'Otxoa', 'Lezaun', 'Sarrion', 'Urdiain', 'Goiko', 'Elizondo', 'Madariaga', 'Lizarraga', 'Aranburu', 'Etxaide', 'Iribarren', 'Lopetegi', 'Zubiri'],
  },
  italian: {
    first: ['Luca', 'Matteo', 'Nicolo', 'Davide', 'Simone', 'Alessio', 'Federico', 'Lorenzo', 'Riccardo', 'Gabriele', 'Tommaso', 'Edoardo', 'Samuele', 'Mattia', 'Andrea', 'Pietro', 'Giulio', 'Daniele', 'Emanuele', 'Filippo', 'Stefano', 'Marco', 'Paolo', 'Enrico', 'Cesare'],
    last: ['Ferretti', 'Bellucci', 'Moretti', 'Rinaldi', 'Galli', 'Martini', 'Vitale', 'Sartori', 'De Santis', 'Palumbo', 'Caruso', 'Greco', 'Fontana', 'Serra', 'Longo', 'Costa', 'Barbieri', 'Testa', 'Monti', 'Ferrara', 'Lombardi', 'Giordano', 'Marchetti', 'Bianchi', 'Rizzo'],
  },
  german: {
    first: ['Jonas', 'Lukas', 'Niklas', 'Tobias', 'Florian', 'Jan', 'Felix', 'Moritz', 'Tim', 'Nils', 'Leon', 'Paul', 'Finn', 'Jannik', 'Hannes', 'Lars', 'Sven', 'Erik', 'Ole', 'Mats', 'Ben', 'Maximilian', 'Kilian', 'Soeren', 'Timo'],
    last: ['Hartmann', 'Schreiber', 'Krueger', 'Hofmann', 'Schuster', 'Wolf', 'Keller', 'Schumacher', 'Vogel', 'Richter', 'Baumann', 'Lorenz', 'Hahn', 'Pohl', 'Engel', 'Otto', 'Gunter', 'Seidel', 'Bergmann', 'Franke', 'Albrecht', 'Peters', 'Sommer', 'Graf', 'Wendt'],
  },
  french: {
    first: ['Hugo', 'Louis', 'Arthur', 'Jules', 'Raphael', 'Leo', 'Adam', 'Mael', 'Noah', 'Gabin', 'Enzo', 'Nathan', 'Theo', 'Maxime', 'Baptiste', 'Mathis', 'Antoine', 'Clement', 'Adrien', 'Quentin', 'Valentin', 'Tristan', 'Loic', 'Yann', 'Killian'],
    last: ['Moreau', 'Fournier', 'Girard', 'Bonnet', 'Dupont', 'Lambert', 'Fontaine', 'Rousseau', 'Vincent', 'Masson', 'Lefevre', 'Faure', 'Andre', 'Mercier', 'Blanc', 'Guerin', 'Boyer', 'Garnier', 'Chevalier', 'Francois', 'Leclerc', 'Gaillard', 'Perrin', 'Morin', 'Rolland'],
  },
  portuguese: {
    first: ['Tiago', 'Diogo', 'Rui', 'Nuno', 'Goncalo', 'Bruno', 'Pedro', 'Miguel', 'Joao', 'Andre', 'Ricardo', 'Sergio', 'Paulo', 'Carlos', 'Luis', 'Filipe', 'Hugo', 'Vitor', 'Renato', 'Daniel', 'Eduardo', 'Fernando', 'Mario', 'Helder', 'Ivo'],
    last: ['Ferreira', 'Carvalho', 'Almeida', 'Rodrigues', 'Pereira', 'Oliveira', 'Costa', 'Martins', 'Sousa', 'Fernandes', 'Lopes', 'Marques', 'Teixeira', 'Correia', 'Pinto', 'Gomes', 'Ribeiro', 'Mendes', 'Nunes', 'Cardoso', 'Rocha', 'Dias', 'Neves', 'Cunha', 'Barros'],
  },
  dutch: {
    first: ['Daan', 'Sem', 'Luuk', 'Bram', 'Finn', 'Milan', 'Lars', 'Thijs', 'Sven', 'Jens', 'Koen', 'Niels', 'Tim', 'Max', 'Stijn', 'Ruben', 'Thomas', 'Jesse', 'Mees', 'Wout', 'Guus', 'Jasper', 'Cas', 'Teun', 'Mats'],
    last: ['Visser', 'Bakker', 'Smit', 'Meijer', 'Bos', 'Vos', 'Dekker', 'Dijkstra', 'Peters', 'Hendriks', 'Van Loon', 'Van den Berg', 'Mulder', 'De Vries', 'Jacobs', 'Vermeer', 'Schouten', 'Willems', 'Kuiper', 'Postma', 'Brouwer', 'Koster', 'Prins', 'Hofman', 'Veenstra'],
  },
  turkish: {
    first: ['Emre', 'Cem', 'Burak', 'Ozan', 'Kaan', 'Eren', 'Yigit', 'Arda', 'Mert', 'Can', 'Deniz', 'Baran', 'Kerem', 'Onur', 'Serkan', 'Hakan', 'Umut', 'Tolga', 'Berk', 'Alp', 'Tuna', 'Ege', 'Kuzey', 'Doruk', 'Sarp'],
    last: ['Yilmaz', 'Kaya', 'Demir', 'Celik', 'Sahin', 'Yildiz', 'Aydin', 'Ozturk', 'Aslan', 'Kurt', 'Koc', 'Arslan', 'Dogan', 'Kilic', 'Acar', 'Polat', 'Erdogan', 'Gunes', 'Aksoy', 'Cetinkaya', 'Karaca', 'Yavuz', 'Tas', 'Yalcin', 'Ucar'],
  },
  arabic: {
    first: ['Omar', 'Youssef', 'Hassan', 'Karim', 'Nasser', 'Faisal', 'Tariq', 'Ziad', 'Samir', 'Majid', 'Walid', 'Bassam', 'Adel', 'Rami', 'Anas', 'Ibrahim', 'Hamza', 'Khalid', 'Sami', 'Nabil', 'Jamal', 'Faris', 'Lutfi', 'Zakariya', 'Idris'],
    last: ['Al Harbi', 'Al Qahtani', 'Al Mutairi', 'Al Shamrani', 'Al Dosari', 'Al Otaibi', 'Al Ghamdi', 'Al Zahrani', 'Al Harthi', 'Al Subaie', 'Al Anzi', 'Al Johani', 'Al Qahtan', 'Al Malki', 'Al Shehri', 'Al Amri', 'Al Harbiya', 'Al Fahad', 'Al Nemer', 'Al Rashid', 'Al Bishi', 'Al Qaht', 'Al Jaber', 'Al Harthiya', 'Al Dossari'],
  },
  american: {
    first: ['Mason', 'Caleb', 'Wyatt', 'Grayson', 'Hunter', 'Colton', 'Parker', 'Carson', 'Bryson', 'Jace', 'Kayden', 'Easton', 'Ryder', 'Sawyer', 'Bentley', 'Tucker', 'Hayden', 'Gage', 'Dalton', 'Reid', 'Nash', 'Grant', 'Chase', 'Blake', 'Cole'],
    last: ['Hendricks', 'Whitfield', 'Caldwell', 'Brennan', 'McAllister', 'Sutherland', 'Harrington', 'Prescott', 'Langford', 'McCrae', 'Donovan', 'Fletcher', 'Graves', 'Holloway', 'Kincaid', 'Lawson', 'Maddox', 'Nashwell', 'Oakley', 'Patterson', 'Quincy', 'Ramsey', 'Sinclair', 'Tanner', 'Vaughn'],
  },
  'south-american': {
    first: ['Thiago', 'Mateo', 'Santiago', 'Nicolas', 'Tomas', 'Agustin', 'Facundo', 'Joaquin', 'Gonzalo', 'Franco', 'Lucas', 'Bruno', 'Diego', 'Emiliano', 'Valentino', 'Benja', 'Iker', 'Gael', 'Bautista', 'Lautaro', 'Maximo', 'Enzo', 'Pablo', 'Rafael', 'Camilo'],
    last: ['Bustos', 'Caceres', 'Delgado', 'Espinoza', 'Figueroa', 'Godoy', 'Herrera', 'Ibarra', 'Juarez', 'Ledesma', 'Molina', 'Nunez', 'Ojeda', 'Paredes', 'Quiroga', 'Rivas', 'Sosa', 'Toledo', 'Urrutia', 'Vargas', 'Acosta', 'Benitez', 'Correa', 'Duarte', 'Echeverria'],
  },
  african: {
    first: ['Kwame', 'Kofi', 'Amadou', 'Idriss', 'Mamadou', 'Sekou', 'Ousmane', 'Abdoulaye', 'Ibrahima', 'Cheikh', 'Youssouf', 'Bakary', 'Moussa', 'Saliou', 'Kalidou', 'Ismael', 'Boubacar', 'Lamine', 'Pape', 'Modou', 'Teboho', 'Sipho', 'Thabo', 'Kabelo', 'Tendai'],
    last: ['Diallo', 'Traore', 'Coulibaly', 'Keita', 'Camara', 'Toure', 'Sylla', 'Bah', 'Sow', 'Ndiaye', 'Fall', 'Diop', 'Gueye', 'Thiam', 'Faye', 'Cisse', 'Ba', 'Ndao', 'Ndoye', 'Coly', 'Dlamini', 'Ncube', 'Molefe', 'Khumalo', 'Nkrumah'],
  },
  'east-asian': {
    first: ['Hiro', 'Kaito', 'Ren', 'Sora', 'Haruto', 'Yuki', 'Minjun', 'Jisoo', 'Hyun', 'Taeyang', 'Wei', 'Jun', 'Hao', 'Chen', 'Bo', 'Kenji', 'Daiki', 'Riku', 'Sota', 'Yuto', 'Minho', 'Joon', 'Seojun', 'Haneul', 'Liang'],
    last: ['Takahashi', 'Yamamoto', 'Kobayashi', 'Watanabe', 'Nakamura', 'Kimura', 'Hayashi', 'Park', 'Choi', 'Jung', 'Kang', 'Yoon', 'Han', 'Lim', 'Seo', 'Zhang', 'Liu', 'Huang', 'Zhou', 'Wu', 'Xu', 'Sun', 'Ma', 'Guo', 'He'],
  },
  oceanic: {
    first: ['Tane', 'Wiremu', 'Hemi', 'Manaia', 'Kauri', 'Liam', 'Jack', 'Hunter', 'Cooper', 'Mason', 'Sione', 'Tevita', 'Lisiate', 'Mikaele', 'Aisea', 'Finn', 'Archie', 'Hamish', 'Angus', 'Callan', 'Niko', 'Jett', 'Zane', 'Beau', 'Cruz'],
    last: ['Williams', 'Thompson', 'Ngata', 'Rangi', 'Hohepa', 'Patel', 'Singh', 'Tuigamala', 'Fotu', 'Havea', 'Asofa', 'MacLeod', 'Fraser', 'Campbell', 'Stewart', 'Walsh', 'Brennan', 'OConnor', 'Murphy', 'Kelly', 'Taumalolo', 'Vaka', 'Latu', 'Pulu', 'Finau'],
  },
  european: {
    first: ['Luka', 'Marko', 'Ivan', 'Petar', 'Nikola', 'Stefan', 'Milan', 'Andrei', 'Vlad', 'Tomas', 'Jakub', 'Piotr', 'Michal', 'Adam', 'Erik', 'Oskar', 'Viktor', 'Nikolai', 'Dmitri', 'Alexandru', 'Cristian', 'Gabriel', 'Mateusz', 'Bartosz', 'Kacper'],
    last: ['Novak', 'Horvat', 'Kovac', 'Jovanovic', 'Petrovic', 'Popescu', 'Ionescu', 'Nowak', 'Kowalski', 'Wisniewski', 'Dvorak', 'Svoboda', 'Horvath', 'Nagy', 'Toth', 'Larsen', 'Nielsen', 'Johansson', 'Lindberg', 'Korhonen', 'Nieminen', 'Ivanov', 'Smirnov', 'Popov', 'Volkov'],
  },
};

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function historicalTotals(first: number, last: number, count = LEGACY_TABLE_SIZE): number[] {
  if (count <= 1) return [first];
  const totals: number[] = new Array(count);
  totals[0] = first;
  totals[count - 1] = last;
  const canStrict = first - last >= count - 1;
  if (canStrict) {
    for (let i = 1; i < count - 1; i += 1) {
      const t = i / (count - 1);
      const eased = 1 - (1 - t) ** 1.28;
      const maxAllowed = totals[i - 1]! - 1;
      const minNeeded = last + (count - 1 - i);
      totals[i] = Math.min(maxAllowed, Math.max(minNeeded, Math.round(first - (first - last) * eased)));
    }
    if ((totals[count - 2] ?? last) <= last) totals[count - 2] = last + 1;
    return totals;
  }
  let value = first;
  for (let i = 1; i < count - 1; i += 1) {
    if (value > last) value -= 1;
    totals[i] = value;
  }
  return totals;
}

function cultureForBoard(def: LegacyBoardDef): NameCulture {
  if (def.kind === 'league') {
    if (def.title.includes('Premier') || def.title === 'Championship') return 'english';
    if (def.title.includes('La Liga')) return 'spanish';
    if (def.title.includes('Serie')) return 'italian';
    if (def.title.includes('Bundesliga')) return 'german';
    if (def.title.includes('Ligue')) return 'french';
    if (def.title.includes('Primeira')) return 'portuguese';
    if (def.title === 'Eredivisie') return 'dutch';
    if (def.title.includes('Super Lig')) return 'turkish';
    if (def.title.includes('Saudi') || def.title.includes('Roshn')) return 'arabic';
    if (def.title === 'MLS') return 'american';
  }
  if (def.kind === 'national-cup') {
    if (def.id.includes('fa-cup')) return 'english';
    if (def.id.includes('copa-del-rey')) return 'spanish';
    if (def.id.includes('coppa')) return 'italian';
    if (def.id.includes('dfb')) return 'german';
    if (def.id.includes('coupe')) return 'french';
    if (def.id.includes('kings-cup')) return 'arabic';
    if (def.id.includes('us-open')) return 'american';
    if (def.id.includes('taca')) return 'portuguese';
    if (def.id.includes('knvb')) return 'dutch';
    if (def.id.includes('turkish')) return 'turkish';
  }
  if (def.kind === 'tournament') {
    if (def.id.endsWith('euro') || def.id.endsWith('nations-league')) return 'european';
    if (def.id.includes('copa-america')) return 'south-american';
    if (def.id.includes('afcon')) return 'african';
    if (def.id.includes('asian-cup')) return 'east-asian';
    if (def.id.includes('gold-cup')) return 'american';
    if (def.id.includes('ofc')) return 'oceanic';
    return 'european';
  }
  if (def.kind === 'champions-league') return 'european';
  return 'european';
}

function uniqueNames(culture: NameCulture, count: number, seed: string): string[] {
  const pool = NAMES[culture];
  const rng = mulberry32(hashString(`${seed}:${culture}`));
  const used = new Set<string>();
  const names: string[] = [];
  let guard = 0;
  while (names.length < count && guard < count * 40) {
    guard += 1;
    const first = pool.first[Math.floor(rng() * pool.first.length)]!;
    const last = pool.last[Math.floor(rng() * pool.last.length)]!;
    const name = `${first} ${last}`;
    if (used.has(name)) continue;
    used.add(name);
    names.push(name);
  }
  let extra = 1;
  while (names.length < count) {
    names.push(`${pool.first[names.length % pool.first.length]} ${pool.last[names.length % pool.last.length]} ${extra}`);
    extra += 1;
  }
  return names;
}

export function historicalLadder(def: LegacyBoardDef): HistoricalScorer[] {
  const scale = scaleForBoard(def);
  const totals = historicalTotals(scale.first, scale.last);
  const names = uniqueNames(cultureForBoard(def), totals.length, def.id);
  return totals.map((goals, i) => ({ name: names[i]!, goals }));
}

function scaleForBoard(def: LegacyBoardDef): { first: number; last: number } {
  if (def.kind === 'league') {
    const league = Object.keys(LEAGUE_SCALE).find((name) => def.id === leagueBoardId(name));
    return (league ? LEAGUE_SCALE[league] : { first: 180, last: 40 })!;
  }
  if (def.kind === 'national-cup') {
    const cupId = def.id.replace('cup:', '') as DomesticCupId;
    return CUP_SCALE[cupId] ?? { first: 40, last: 10 };
  }
  if (def.kind === 'champions-league') return CHAMPIONS_LEAGUE_SCALE;
  if (def.kind === 'international') return INTERNATIONAL_SCALE;
  const tournament = def.id.replace('tournament:', '') as InternationalTournamentId;
  return TOURNAMENT_SCALE[tournament] ?? { first: 12, last: 3 };
}

export function leagueBoardId(league: string): string {
  return `league:${league.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function allLegacyBoards(): LegacyBoardDef[] {
  const leagues: LegacyBoardDef[] = Object.keys(TARGET_LEAGUE_SIZE).map((league) => ({
    id: leagueBoardId(league),
    kind: 'league',
    title: leagueDisplayName(league),
    subtitle: 'All-time league goals',
    group: 'league',
  }));
  const cups: LegacyBoardDef[] = (Object.keys(DOMESTIC_CUPS) as DomesticCupId[]).map((id) => ({
    id: `cup:${id}`,
    kind: 'national-cup',
    title: DOMESTIC_CUPS[id].name,
    subtitle: 'All-time national cup goals',
    group: 'national',
  }));
  const tournaments: LegacyBoardDef[] = TOURNAMENT_BOARDS.map((id) => ({
    id: `tournament:${id}`,
    kind: 'tournament',
    title: INTERNATIONAL_TOURNAMENTS[id].name,
    subtitle: 'All-time tournament goals',
    group: 'international',
  }));
  return [
    ...leagues,
    {
      id: 'continental:ucl',
      kind: 'champions-league',
      title: 'Champions League',
      subtitle: 'All-time club goals',
      group: 'club',
    },
    ...cups,
    ...tournaments,
    {
      id: 'international:all-time',
      kind: 'international',
      title: 'International goals',
      subtitle: 'All-time caps scoring',
      group: 'international',
    },
  ];
}

export function seasonLeagueName(season: SeasonRecord): string | null {
  return season.league ?? getClub(season.clubId)?.league ?? null;
}

export function countedSeasons(seasons: SeasonRecord[]): SeasonRecord[] {
  return seasons.filter((season) => countsTowardCareerRecord(season.seasonNumber, season.role));
}

export function playerGoalsForBoard(def: LegacyBoardDef, input: LegacyCareerInput): number {
  const seasons = countedSeasons(input.seasons);
  if (def.kind === 'league') {
    const league = Object.keys(TARGET_LEAGUE_SIZE).find((name) => leagueBoardId(name) === def.id);
    if (!league) return 0;
    return seasons.reduce((sum, season) => sum + (seasonLeagueName(season) === league ? season.leagueGoals ?? 0 : 0), 0);
  }
  if (def.kind === 'champions-league') {
    return aggregateContinental(seasons).find((row) => row.cup === 'ucl')?.goals ?? 0;
  }
  if (def.kind === 'national-cup') {
    const cupId = def.id.replace('cup:', '') as DomesticCupId;
    return seasons.reduce((sum, season) => {
      const club = getClub(season.clubId);
      if (!club || domesticCupForCountry(club.country) !== cupId) return sum;
      return sum + (season.cupGoals ?? 0);
    }, 0);
  }
  if (def.kind === 'tournament') {
    const tournament = def.id.replace('tournament:', '') as InternationalTournamentId;
    return input.nationalTeam?.byCompetition.find((row) => row.tournament === tournament)?.finalsGoals ?? 0;
  }
  return input.nationalTeam?.goals ?? 0;
}

export function rankForGoals(playerGoals: number, historical: HistoricalScorer[]): number {
  return 1 + historical.filter((row) => row.goals > playerGoals).length;
}

export function revealForRank(rank: number): LegacyReveal {
  if (rank <= LEGACY_TOP_N) return 'top10';
  if (rank <= LEGACY_TABLE_SIZE) return 'listed';
  return 'outside';
}

function combinedTopTable(playerGoals: number, historical: HistoricalScorer[]): LegacyTableRow[] {
  const ahead = historical.filter((row) => row.goals > playerGoals);
  const tied = historical.filter((row) => row.goals === playerGoals);
  const behind = historical.filter((row) => row.goals < playerGoals);
  const youRow = { name: PLAYER_RECORD_NAME, goals: playerGoals, you: true };
  const before = [...ahead, ...tied].slice(0, Math.max(0, LEGACY_TOP_N - 1));
  const remaining = Math.max(0, LEGACY_TOP_N - (before.length + 1));
  const combined = [
    ...before.map((row) => ({ ...row, you: false })),
    youRow,
    ...behind.slice(0, remaining).map((row) => ({ ...row, you: false })),
  ];
  return combined.map((row) => ({
    rank: 1 + combined.filter((other) => other.goals > row.goals).length,
    name: row.name,
    goals: row.goals,
    you: row.you,
  }));
}

export function viewForBoard(def: LegacyBoardDef, input: LegacyCareerInput): LegacyBoardView {
  const historical = historicalLadder(def);
  const playerGoals = playerGoalsForBoard(def, input);
  const rank = rankForGoals(playerGoals, historical);
  const reveal = revealForRank(rank);
  const last = historical[historical.length - 1]?.goals ?? 0;
  const tenth = historical[LEGACY_TOP_N - 1]?.goals ?? last;
  return {
    def,
    historical,
    playerGoals,
    rank,
    reveal,
    rankLabel: rank > LEGACY_TABLE_SIZE ? '100+' : ordinal(rank),
    goalsToEnter: Math.max(0, last - playerGoals),
    goalsToTop10: Math.max(0, tenth - playerGoals),
    tenthGoals: tenth,
    table: reveal === 'top10' ? combinedTopTable(playerGoals, historical) : null,
  };
}

export function careerLegacyBoards(input: LegacyCareerInput): LegacyBoardView[] {
  return allLegacyBoards().map((def) => viewForBoard(def, input));
}

export function chaseBoardIds(input: LegacyCareerInput): string[] {
  const ids: string[] = [];
  if (input.currentLeague) ids.push(leagueBoardId(input.currentLeague));
  ids.push('continental:ucl');
  ids.push('international:all-time');
  ids.push('tournament:world-cup');
  if (input.nationalityConfederation) {
    const continental = CONTINENTAL_TOURNAMENT_FOR_CONFEDERATION[input.nationalityConfederation];
    ids.push(`tournament:${continental}`);
  }
  if (input.currentLeague) {
    const sample = countedSeasons(input.seasons).find((season) => seasonLeagueName(season) === input.currentLeague)
      ?? input.seasons.find((season) => seasonLeagueName(season) === input.currentLeague);
    const country = sample ? getClub(sample.clubId)?.country : null;
    const cup = country ? domesticCupForCountry(country) : null;
    if (cup) ids.push(`cup:${cup}`);
  }
  return [...new Set(ids)];
}

export function featuredLegacyBoards(input: LegacyCareerInput): LegacyBoardView[] {
  const all = careerLegacyBoards(input);
  const featured = new Set(chaseBoardIds(input));
  const picked = all.filter((board) => featured.has(board.def.id));
  const extras = all
    .filter((board) => !featured.has(board.def.id) && board.reveal !== 'outside')
    .sort((a, b) => a.rank - b.rank);
  return [...picked, ...extras];
}
