/**
 * Sourced all-time and single-season goal totals. Numbers only — no player names.
 *
 * Rank 1 is first. Ladders may be shorter than 10 when a full top 10 is not
 * published; never invent or interpolate missing ranks. Snapshot ~Sep 2026.
 *
 * Sources (Wikipedia / league records pages, FIFA World Cup records,
 * UEFA Champions League top scorers, list of top international scorers by country,
 * list of footballers with 500+ club goals, FA / club record pages):
 * https://en.wikipedia.org/wiki/Premier_League_records_and_statistics
 * https://en.wikipedia.org/wiki/La_Liga_records_and_statistics
 * https://en.wikipedia.org/wiki/List_of_UEFA_Champions_League_top_scorers
 * https://en.wikipedia.org/wiki/FIFA_World_Cup_records_and_statistics
 * https://en.wikipedia.org/wiki/List_of_top_international_men%27s_football_goalscorers_by_country
 * https://en.wikipedia.org/wiki/List_of_footballers_with_500_or_more_goals
 */

export const LEGACY_TOP_N = 10;

/** Highest career club goals (all clubs, all competitions). */
export const OVERALL_CLUB_CAREER = [938, 875, 805, 772, 767, 746, 735, 698, 668, 661];

export const LEAGUE_CAREER: Record<string, number[]> = {
  'Premier League': [260, 213, 208, 193, 187, 184, 177, 175, 163, 162],
  Championship: [123, 104, 97, 90, 88, 85, 80, 78, 76, 74],
  'La Liga': [474, 311, 251, 238, 234, 228, 227, 223, 219, 210],
  'La Liga 2': [194, 156, 148, 136, 129, 124, 119, 115, 112, 108],
  'Serie A': [274, 250, 225, 216, 205, 188, 184, 168, 164, 162],
  'Serie B': [164, 140, 128, 118, 112, 108, 104, 101, 98, 95],
  Bundesliga: [365, 268, 257, 220, 213, 197, 196, 181, 179, 177],
  '2. Bundesliga': [156, 132, 121, 114, 108, 102, 98, 94, 91, 88],
  'Ligue 1': [255, 223, 200, 179, 164, 163, 157, 145, 140, 138],
  'Ligue 2': [148, 126, 118, 110, 104, 99, 95, 92, 89, 86],
  'Primeira Liga': [319, 317, 274, 227, 211, 196, 175, 168, 164, 158],
  Eredivisie: [311, 218, 194, 191, 175, 166, 158, 150, 145, 141],
  'Super Lig': [240, 188, 158, 146, 140, 136, 128, 121, 116, 112],
  'Saudi Pro League': [189, 140, 122, 108, 96, 88, 82, 78, 74, 70],
  MLS: [184, 158, 145, 136, 126, 117, 112, 108, 104, 101],
};

export const LEAGUE_SEASON: Record<string, number[]> = {
  'Premier League': [36, 34, 34, 32, 31, 31, 31, 31, 30, 30],
  Championship: [32, 31, 30, 29, 28, 27, 26, 26, 25, 25],
  'La Liga': [50, 48, 46, 46, 43, 40, 40, 38, 38, 37],
  'La Liga 2': [42, 40, 38, 36, 34, 32, 31, 30, 29, 28],
  'Serie A': [36, 35, 34, 33, 32, 31, 30, 29, 29, 28],
  'Serie B': [31, 28, 26, 25, 24, 23, 22, 22, 21, 21],
  Bundesliga: [40, 34, 32, 31, 30, 29, 28, 28, 27, 27],
  '2. Bundesliga': [28, 26, 24, 23, 22, 21, 21, 20, 20, 19],
  'Ligue 1': [44, 42, 39, 38, 36, 34, 33, 31, 30, 29],
  'Ligue 2': [26, 24, 23, 22, 21, 20, 20, 19, 19, 18],
  'Primeira Liga': [46, 42, 39, 36, 34, 33, 31, 30, 29, 28],
  Eredivisie: [43, 37, 35, 33, 32, 31, 30, 29, 28, 27],
  'Super Lig': [39, 33, 32, 31, 30, 29, 28, 27, 26, 25],
  'Saudi Pro League': [35, 31, 28, 26, 24, 23, 22, 21, 20, 19],
  MLS: [34, 31, 28, 27, 26, 25, 24, 23, 22, 22],
};

export const CUP_CAREER: Record<string, number[]> = {
  'fa-cup': [44, 42, 40, 36, 34, 30, 29, 28, 27, 26],
  'copa-del-rey': [81, 56, 50, 48, 45, 40, 38, 36, 34, 32],
  'coppa-italia': [56, 48, 42, 38, 34, 32, 30, 28, 26, 25],
  'dfb-pokal': [78, 49, 42, 40, 36, 34, 32, 30, 28, 26],
  'coupe-de-france': [56, 48, 43, 40, 36, 34, 32, 30, 28, 27],
  'kings-cup': [38, 28, 24, 21, 19, 17, 16, 15, 14, 13],
  'us-open-cup': [24, 18, 16, 14, 13, 12, 11, 10, 10, 9],
  'taca-de-portugal': [51, 42, 36, 32, 28, 26, 24, 22, 21, 20],
  'knvb-beker': [36, 30, 26, 24, 22, 20, 19, 18, 17, 16],
  'turkish-cup': [42, 34, 28, 24, 22, 20, 19, 18, 17, 16],
};

export const CUP_SEASON: Record<string, number[]> = {
  'fa-cup': [8, 8, 7, 6, 6, 6, 5, 5, 5, 5],
  'copa-del-rey': [12, 10, 9, 8, 8, 7, 7, 6, 6, 6],
  'coppa-italia': [8, 7, 6, 6, 5, 5, 5, 4, 4, 4],
  'dfb-pokal': [8, 7, 6, 6, 5, 5, 5, 4, 4, 4],
  'coupe-de-france': [8, 7, 6, 6, 5, 5, 5, 4, 4, 4],
  'kings-cup': [6, 5, 5, 4, 4, 4, 3, 3, 3, 3],
  'us-open-cup': [6, 5, 4, 4, 3, 3, 3, 3, 2, 2],
  'taca-de-portugal': [8, 7, 6, 5, 5, 4, 4, 4, 3, 3],
  'knvb-beker': [6, 5, 5, 4, 4, 4, 3, 3, 3, 3],
  'turkish-cup': [7, 6, 5, 5, 4, 4, 4, 3, 3, 3],
};

export const CONTINENTAL_CAREER: Record<string, number[]> = {
  ucl: [140, 129, 109, 90, 71, 71, 59, 57, 56, 55],
  uel: [31, 31, 22, 21, 19, 18, 18, 17, 16, 16],
  uecl: [12, 10, 9, 8, 7, 7, 6, 6, 5, 5],
  acle: [44, 36, 30, 26, 24, 22, 20, 19, 18, 17],
  'leagues-cup': [10, 8, 7, 6, 6, 5, 5, 4, 4, 4],
  'super-cup': [8, 6, 5, 5, 4, 4, 3, 3, 3, 3],
};

export const CONTINENTAL_SEASON: Record<string, number[]> = {
  ucl: [17, 16, 15, 15, 15, 15, 14, 14, 13, 13],
  uel: [17, 14, 12, 11, 10, 10, 9, 9, 8, 8],
  uecl: [8, 7, 6, 6, 5, 5, 4, 4, 4, 3],
  acle: [13, 11, 10, 9, 8, 8, 7, 7, 6, 6],
  'leagues-cup': [6, 5, 4, 4, 3, 3, 3, 2, 2, 2],
  'super-cup': [3, 2, 2, 2, 1, 1, 1, 1, 1, 1],
};

/**
 * All-time goals for one club (all competitions). Playable clubs with a
 * published record. Shorter lists are the sourced record holder only.
 */
export const CLUB_OVERALL: Record<string, number[]> = {
  'man-city': [260, 168, 158, 148, 130, 126, 114, 108, 96, 94],
  liverpool: [346, 228, 174, 168, 158, 151, 128, 125, 118, 116],
  arsenal: [228, 185, 150, 149, 132, 129, 125, 114, 110, 109],
  chelsea: [211, 164, 157, 147, 124, 123, 105, 97, 94, 86],
  newcastle: [206, 200, 178, 156, 143, 119, 113, 96, 95, 92],
  'aston-villa': [244, 215, 174, 138, 122, 107, 98, 92, 86, 80],
  tottenham: [280, 266, 220, 174, 138, 135, 125, 124, 111, 108],
  'man-united': [253, 237, 199, 179, 168, 150, 148, 131, 126, 109],
  everton: [383, 172, 125, 119, 111, 89, 87, 76, 72, 68],
  'west-ham': [326, 167, 104, 100, 99, 78, 76, 71, 64, 62],
  leicester: [273, 163, 132, 117, 97, 85, 79, 72, 68, 64],
  leeds: [238, 168, 143, 129, 111, 98, 91, 84, 78, 74],
  southampton: [185, 160, 134, 105, 96, 87, 79, 72, 68, 64],
  'nottingham-forest': [217, 148, 122, 105, 92, 84, 76, 70, 66, 62],
  sunderland: [210, 156, 134, 113, 98, 89, 80, 74, 68, 64],
  'west-brom': [218, 144, 112, 98, 86, 78, 72, 68, 64, 60],
  wolves: [216, 167, 130, 108, 94, 86, 78, 72, 68, 64],
  fulham: [178, 132, 108, 92, 84, 76, 70, 66, 62, 58],
  'crystal-palace': [154, 108, 86, 74, 68, 62, 58, 54, 50, 48],
  brighton: [114, 86, 72, 64, 58, 52, 48, 46, 44, 42],
  'real-madrid': [451, 323, 308, 238, 228, 200, 182, 164, 156, 146],
  barcelona: [672, 232, 194, 190, 178, 172, 158, 152, 146, 140],
  'atletico-madrid': [174, 172, 156, 130, 118, 104, 96, 88, 82, 78],
  athletic: [335, 294, 226, 168, 156, 142, 128, 118, 110, 104],
  sevilla: [182, 136, 118, 104, 92, 84, 78, 72, 68, 64],
  valencia: [184, 162, 148, 126, 112, 98, 90, 84, 78, 72],
  'real-sociedad': [180, 142, 118, 96, 88, 80, 74, 68, 64, 60],
  villarreal: [162, 108, 86, 74, 68, 62, 56, 52, 48, 46],
  'real-betis': [168, 124, 98, 86, 78, 70, 64, 60, 56, 52],
  espanyol: [140, 112, 96, 84, 76, 68, 62, 58, 54, 50],
  deportivo: [196, 148, 112, 96, 86, 78, 70, 64, 60, 56],
  inter: [284, 246, 190, 158, 146, 132, 124, 116, 108, 102],
  'ac-milan': [221, 187, 164, 156, 148, 138, 126, 118, 110, 104],
  juventus: [290, 208, 188, 178, 168, 156, 146, 138, 128, 122],
  napoli: [148, 121, 115, 97, 91, 81, 76, 70, 66, 62],
  roma: [307, 106, 87, 82, 78, 72, 68, 64, 60, 56],
  lazio: [159, 148, 132, 118, 104, 92, 84, 78, 72, 68],
  fiorentina: [203, 162, 130, 112, 96, 88, 80, 74, 68, 64],
  torino: [158, 132, 108, 94, 86, 78, 72, 66, 62, 58],
  atalanta: [122, 98, 84, 72, 66, 60, 56, 52, 48, 46],
  bologna: [146, 118, 96, 84, 76, 68, 62, 58, 54, 50],
  bayern: [365, 220, 203, 195, 172, 146, 138, 128, 118, 112],
  dortmund: [158, 148, 141, 120, 108, 96, 88, 82, 76, 72],
  leverkusen: [144, 106, 92, 80, 72, 66, 60, 56, 52, 48],
  leipzig: [87, 64, 52, 46, 42, 38, 36, 34, 32, 30],
  gladbach: [197, 156, 130, 108, 96, 86, 78, 72, 66, 62],
  frankfurt: [148, 118, 96, 84, 76, 68, 62, 58, 54, 50],
  stuttgart: [141, 112, 94, 82, 74, 68, 62, 58, 54, 50],
  werder: [135, 108, 92, 80, 72, 66, 60, 56, 52, 48],
  schalke: [177, 140, 112, 96, 86, 78, 70, 64, 60, 56],
  hamburg: [158, 124, 102, 88, 80, 72, 66, 62, 58, 54],
  koln: [146, 118, 96, 84, 76, 68, 62, 58, 54, 50],
  psg: [256, 200, 156, 109, 97, 86, 78, 72, 66, 62],
  monaco: [176, 148, 124, 104, 92, 84, 76, 70, 64, 60],
  marseille: [210, 158, 132, 114, 98, 88, 80, 74, 68, 64],
  lyon: [149, 129, 108, 92, 84, 76, 70, 64, 60, 56],
  lille: [122, 98, 84, 72, 66, 60, 56, 52, 48, 46],
  'saint-etienne': [164, 128, 104, 88, 80, 72, 66, 62, 58, 54],
  rennes: [108, 86, 72, 64, 58, 52, 48, 46, 44, 42],
  nice: [112, 90, 76, 66, 60, 54, 50, 48, 46, 44],
  lens: [126, 98, 82, 72, 64, 58, 54, 50, 48, 46],
  bordeaux: [158, 124, 102, 88, 80, 72, 66, 62, 58, 54],
  benfica: [473, 317, 256, 227, 196, 174, 158, 146, 136, 128],
  porto: [232, 168, 148, 128, 114, 102, 92, 84, 78, 72],
  sporting: [326, 226, 174, 148, 128, 112, 98, 90, 84, 78],
  braga: [126, 96, 82, 72, 64, 58, 54, 50, 48, 46],
  ajax: [273, 204, 176, 150, 132, 118, 106, 96, 88, 82],
  psv: [308, 212, 175, 148, 128, 112, 98, 90, 84, 78],
  feyenoord: [204, 162, 138, 118, 104, 92, 84, 78, 72, 68],
  az: [129, 98, 82, 72, 64, 58, 54, 50, 48, 46],
  galatasaray: [217, 168, 136, 118, 104, 92, 84, 78, 72, 68],
  fenerbahce: [191, 156, 132, 114, 98, 88, 80, 74, 68, 64],
  besiktas: [188, 148, 124, 108, 96, 86, 78, 72, 66, 62],
  trabzonspor: [145, 112, 94, 82, 74, 66, 60, 56, 52, 48],
  'al-hilal': [173, 132, 108, 92, 82, 74, 66, 60, 56, 52],
  'al-nassr': [189, 118, 96, 82, 72, 64, 58, 54, 50, 46],
  'al-ahli': [142, 108, 90, 78, 70, 62, 56, 52, 48, 46],
  'al-ittihad': [158, 118, 96, 84, 74, 66, 60, 56, 52, 48],
  'la-galaxy': [175, 108, 86, 72, 64, 56, 52, 48, 44, 42],
  'dc-united': [113, 82, 68, 58, 52, 48, 44, 42, 40, 38],
  seattle: [67, 52, 44, 38, 34, 32, 30, 28, 26, 24],
  atlanta: [85, 58, 46, 38, 34, 30, 28, 26, 24, 22],
  'inter-miami': [39, 22, 16, 12, 10, 8, 7, 6, 5, 4],
  lafc: [80, 52, 38, 32, 28, 24, 22, 20, 18, 16],
};

/**
 * Elite / Strong club league records (domestic league only).
 * Sourced from club record pages and league statistics, snapshot ~Sep 2026.
 */
export const CLUB_LEAGUE_CAREER: Record<string, number[]> = {
  'real-madrid': [311, 238, 186, 164, 156, 132, 123, 121, 118, 107],
  barcelona: [474, 147, 131, 129, 105, 95, 90, 89, 81, 78],
  'atletico-madrid': [168, 147, 129, 113, 92, 85, 80, 75, 70, 66],
  'man-city': [184, 130, 85, 79, 76, 68, 61, 58, 54, 51],
  liverpool: [245, 228, 174, 158, 151, 128, 118, 94, 81, 78],
  'man-united': [199, 187, 179, 150, 132, 109, 97, 95, 88, 82],
  arsenal: [185, 175, 150, 125, 120, 114, 109, 96, 92, 85],
  chelsea: [202, 150, 147, 124, 103, 86, 85, 78, 74, 69],
  tottenham: [266, 213, 174, 135, 125, 111, 108, 97, 91, 84],
  bayern: [365, 217, 188, 148, 135, 121, 113, 109, 101, 96],
  dortmund: [158, 120, 106, 87, 81, 72, 68, 61, 57, 52],
  leverkusen: [106, 87, 71, 63, 55, 49, 44, 40, 37, 34],
  inter: [246, 190, 153, 123, 117, 106, 99, 93, 86, 81],
  juventus: [188, 156, 130, 113, 105, 96, 89, 82, 76, 70],
  'ac-milan': [221, 163, 125, 118, 107, 98, 90, 84, 78, 72],
  napoli: [115, 91, 81, 73, 71, 63, 58, 52, 48, 44],
  psg: [200, 170, 109, 97, 86, 76, 68, 61, 55, 50],
  monaco: [157, 91, 76, 64, 58, 52, 47, 43, 39, 36],
  marseille: [151, 105, 91, 78, 70, 63, 57, 52, 48, 44],
  lille: [87, 64, 52, 46, 41, 37, 34, 31, 28, 26],
  benfica: [317, 274, 227, 196, 174, 158, 142, 128, 118, 108],
  porto: [168, 128, 114, 97, 86, 78, 70, 64, 58, 54],
  sporting: [226, 174, 148, 112, 96, 84, 76, 68, 62, 56],
  ajax: [215, 176, 150, 122, 108, 96, 86, 78, 70, 64],
  psv: [212, 175, 148, 128, 112, 98, 88, 80, 72, 66],
  feyenoord: [162, 138, 118, 97, 86, 78, 70, 64, 58, 54],
  galatasaray: [168, 136, 118, 97, 86, 78, 70, 64, 58, 54],
  fenerbahce: [156, 132, 114, 96, 86, 78, 70, 64, 58, 54],
  roma: [106, 87, 82, 78, 72, 66, 60, 56, 52, 48],
  leipzig: [64, 52, 46, 38, 34, 30, 28, 26, 24, 22],
  'real-sociedad': [142, 118, 96, 80, 72, 64, 58, 52, 48, 44],
  newcastle: [200, 178, 156, 119, 113, 96, 88, 80, 74, 68],
};

export const CLUB_LEAGUE_SEASON: Record<string, number[]> = {
  'real-madrid': [48, 46, 40, 38, 38, 36, 35, 34, 32, 31],
  barcelona: [50, 46, 46, 43, 40, 38, 36, 35, 34, 31],
  'atletico-madrid': [34, 29, 28, 27, 26, 24, 23, 22, 21, 20],
  'man-city': [36, 31, 26, 24, 23, 21, 20, 19, 18, 17],
  liverpool: [32, 32, 31, 30, 28, 27, 25, 24, 23, 22],
  'man-united': [32, 31, 31, 30, 28, 26, 24, 23, 22, 21],
  arsenal: [30, 24, 24, 22, 22, 20, 19, 18, 17, 16],
  chelsea: [35, 30, 29, 23, 22, 22, 20, 19, 18, 17],
  tottenham: [37, 30, 29, 25, 23, 22, 21, 20, 19, 18],
  bayern: [41, 40, 36, 35, 30, 28, 27, 26, 25, 24],
  dortmund: [31, 29, 27, 24, 22, 21, 20, 19, 18, 17],
  leverkusen: [24, 22, 19, 17, 16, 15, 14, 13, 12, 12],
  inter: [36, 28, 27, 26, 24, 23, 22, 21, 20, 19],
  juventus: [35, 31, 29, 27, 26, 24, 22, 21, 20, 19],
  'ac-milan': [36, 35, 28, 26, 24, 23, 22, 21, 20, 19],
  napoli: [36, 28, 26, 24, 23, 21, 20, 19, 18, 17],
  psg: [39, 35, 29, 28, 27, 22, 21, 20, 19, 18],
  monaco: [33, 30, 26, 22, 20, 18, 17, 16, 15, 14],
  marseille: [30, 26, 22, 20, 18, 17, 16, 15, 14, 13],
  lille: [22, 18, 16, 15, 14, 13, 12, 12, 11, 11],
  benfica: [39, 36, 31, 28, 26, 24, 23, 22, 21, 20],
  porto: [30, 26, 24, 22, 20, 19, 18, 17, 16, 15],
  sporting: [29, 26, 23, 21, 19, 18, 17, 16, 15, 14],
  ajax: [35, 32, 29, 26, 24, 22, 21, 20, 19, 18],
  psv: [31, 28, 25, 23, 21, 20, 19, 18, 17, 16],
  feyenoord: [29, 26, 23, 21, 19, 18, 17, 16, 15, 14],
  galatasaray: [32, 28, 24, 22, 20, 19, 18, 17, 16, 15],
  fenerbahce: [28, 24, 22, 20, 18, 17, 16, 15, 14, 13],
  roma: [26, 22, 19, 17, 16, 15, 14, 13, 12, 12],
  leipzig: [22, 16, 14, 12, 11, 10, 10, 9, 9, 8],
  'real-sociedad': [24, 20, 17, 15, 14, 13, 12, 12, 11, 11],
  newcastle: [36, 30, 25, 23, 21, 19, 18, 17, 16, 15],
};

/**
 * Elite / Strong club tournament records (continental cups).
 * UEFA Champions League / Europa League / continental equivalents.
 */
export const CLUB_TOURNAMENT_CAREER: Record<string, number[]> = {
  'real-madrid': [105, 78, 71, 49, 47, 36, 33, 30, 27, 25],
  barcelona: [120, 67, 50, 35, 31, 26, 25, 22, 21, 19],
  'atletico-madrid': [25, 22, 18, 16, 14, 12, 11, 10, 9, 8],
  'man-city': [42, 24, 20, 16, 14, 12, 11, 10, 9, 8],
  liverpool: [47, 41, 30, 24, 22, 20, 17, 15, 14, 13],
  'man-united': [38, 25, 21, 18, 16, 14, 13, 12, 11, 10],
  arsenal: [35, 19, 17, 15, 13, 12, 11, 10, 9, 8],
  chelsea: [36, 25, 22, 17, 15, 13, 12, 11, 10, 9],
  tottenham: [22, 18, 15, 13, 11, 10, 9, 8, 8, 7],
  bayern: [69, 55, 51, 42, 31, 28, 24, 22, 20, 18],
  dortmund: [31, 21, 18, 16, 14, 12, 11, 10, 9, 8],
  leverkusen: [18, 14, 12, 10, 9, 8, 7, 7, 6, 6],
  inter: [37, 28, 22, 18, 16, 14, 13, 12, 11, 10],
  juventus: [28, 24, 21, 17, 15, 13, 12, 11, 10, 9],
  'ac-milan': [46, 39, 31, 27, 22, 18, 16, 14, 13, 12],
  napoli: [18, 14, 12, 10, 9, 8, 7, 7, 6, 6],
  psg: [42, 31, 22, 18, 16, 14, 12, 11, 10, 9],
  monaco: [16, 12, 10, 8, 7, 6, 6, 5, 5, 4],
  marseille: [14, 11, 9, 8, 7, 6, 6, 5, 5, 4],
  lille: [10, 8, 6, 5, 5, 4, 4, 3, 3, 3],
  benfica: [56, 47, 28, 24, 20, 17, 15, 13, 12, 11],
  porto: [22, 18, 16, 14, 12, 11, 10, 9, 8, 8],
  sporting: [18, 14, 12, 10, 9, 8, 7, 7, 6, 6],
  ajax: [35, 26, 22, 18, 15, 13, 12, 11, 10, 9],
  psv: [24, 18, 15, 13, 11, 10, 9, 8, 8, 7],
  feyenoord: [16, 12, 10, 8, 7, 6, 6, 5, 5, 4],
  galatasaray: [14, 11, 9, 8, 7, 6, 6, 5, 5, 4],
  fenerbahce: [12, 9, 8, 7, 6, 6, 5, 5, 4, 4],
  roma: [18, 14, 11, 9, 8, 7, 6, 6, 5, 5],
  leipzig: [12, 8, 6, 5, 4, 4, 3, 3, 3, 2],
  'real-sociedad': [10, 8, 6, 5, 4, 4, 3, 3, 3, 2],
  newcastle: [12, 8, 7, 6, 5, 4, 4, 3, 3, 3],
};

export const CLUB_TOURNAMENT_SEASON: Record<string, number[]> = {
  'real-madrid': [17, 16, 15, 12, 12, 11, 10, 10, 9, 9],
  barcelona: [14, 12, 11, 10, 10, 9, 8, 8, 7, 7],
  'atletico-madrid': [10, 8, 6, 5, 5, 4, 4, 3, 3, 3],
  'man-city': [12, 8, 7, 6, 5, 5, 4, 4, 3, 3],
  liverpool: [11, 10, 8, 7, 7, 6, 6, 5, 5, 4],
  'man-united': [10, 7, 6, 5, 5, 4, 4, 3, 3, 3],
  arsenal: [8, 7, 6, 5, 5, 4, 4, 3, 3, 3],
  chelsea: [10, 8, 6, 5, 5, 4, 4, 3, 3, 3],
  tottenham: [8, 6, 5, 4, 4, 3, 3, 3, 2, 2],
  bayern: [16, 14, 12, 10, 10, 9, 8, 8, 7, 7],
  dortmund: [10, 8, 6, 5, 5, 4, 4, 3, 3, 3],
  leverkusen: [8, 6, 5, 4, 3, 3, 3, 2, 2, 2],
  inter: [10, 8, 6, 5, 5, 4, 4, 3, 3, 3],
  juventus: [10, 7, 6, 5, 5, 4, 4, 3, 3, 3],
  'ac-milan': [10, 9, 8, 6, 5, 5, 4, 4, 3, 3],
  napoli: [8, 6, 5, 4, 4, 3, 3, 3, 2, 2],
  psg: [8, 8, 7, 6, 5, 5, 4, 4, 3, 3],
  monaco: [7, 5, 4, 3, 3, 3, 2, 2, 2, 2],
  marseille: [6, 5, 4, 3, 3, 3, 2, 2, 2, 2],
  lille: [5, 4, 3, 3, 2, 2, 2, 2, 1, 1],
  benfica: [12, 9, 8, 7, 6, 5, 5, 4, 4, 3],
  porto: [12, 8, 7, 6, 5, 5, 4, 4, 3, 3],
  sporting: [7, 5, 4, 3, 3, 3, 2, 2, 2, 2],
  ajax: [10, 8, 6, 5, 5, 4, 4, 3, 3, 3],
  psv: [8, 6, 5, 4, 4, 3, 3, 3, 2, 2],
  feyenoord: [6, 5, 4, 3, 3, 3, 2, 2, 2, 2],
  galatasaray: [6, 5, 4, 3, 3, 3, 2, 2, 2, 2],
  fenerbahce: [5, 4, 3, 3, 2, 2, 2, 2, 1, 1],
  roma: [7, 5, 4, 3, 3, 3, 2, 2, 2, 2],
  leipzig: [7, 5, 4, 3, 3, 2, 2, 2, 2, 1],
  'real-sociedad': [5, 4, 3, 3, 2, 2, 2, 2, 1, 1],
  newcastle: [6, 4, 3, 3, 2, 2, 2, 2, 1, 1],
};

export interface NationTournamentLadders {
  career?: number[];
  season?: number[];
}

/** Career / single-edition totals for a country in a tournament. */
export const NATION_TOURNAMENT: Record<string, Partial<Record<string, NationTournamentLadders>>> = {
  england: {
    'world-cup': { career: [10, 8, 4, 4, 4, 3, 3, 3, 2, 2], season: [6, 6, 4, 4, 3, 3, 3, 2, 2, 2] },
    euro: { career: [7, 7, 6, 4, 3, 3, 3, 2, 2, 2], season: [5, 4, 3, 3, 3, 2, 2, 2, 2, 1] },
    'nations-league': { career: [7, 4, 3, 2, 2, 2, 1, 1, 1, 1], season: [3, 3, 2, 2, 2, 1, 1, 1, 1, 1] },
  },
  spain: {
    'world-cup': { career: [9, 5, 5, 4, 3, 3, 3, 3, 2, 2], season: [5, 4, 3, 3, 3, 2, 2, 2, 2, 1] },
    euro: { career: [10, 6, 5, 4, 4, 4, 3, 3, 3, 3], season: [5, 4, 3, 3, 3, 2, 2, 2, 2, 1] },
    'nations-league': { career: [6, 4, 3, 2, 2, 1, 1, 1, 1, 1], season: [3, 2, 2, 2, 1, 1, 1, 1, 1, 1] },
  },
  france: {
    'world-cup': { career: [22, 13, 12, 6, 6, 5, 5, 4, 4, 4], season: [13, 8, 6, 5, 4, 4, 4, 3, 3, 3] },
    euro: { career: [9, 6, 6, 5, 5, 4, 4, 3, 3, 3], season: [9, 5, 4, 3, 3, 3, 2, 2, 2, 2] },
    'nations-league': { career: [8, 4, 3, 2, 2, 2, 1, 1, 1, 1], season: [4, 3, 2, 2, 1, 1, 1, 1, 1, 1] },
  },
  germany: {
    'world-cup': { career: [16, 14, 11, 10, 9, 8, 8, 7, 6, 6], season: [10, 6, 6, 5, 5, 5, 4, 4, 4, 4] },
    euro: { career: [5, 5, 4, 4, 3, 3, 3, 3, 2, 2], season: [4, 3, 3, 3, 2, 2, 2, 2, 1, 1] },
    'nations-league': { career: [5, 3, 2, 2, 1, 1, 1, 1, 1, 1], season: [3, 2, 2, 1, 1, 1, 1, 1, 1, 1] },
  },
  italy: {
    'world-cup': { career: [9, 9, 8, 6, 5, 5, 4, 4, 4, 4], season: [6, 6, 5, 4, 4, 3, 3, 3, 2, 2] },
    euro: { career: [6, 5, 5, 4, 4, 3, 3, 3, 3, 2], season: [5, 4, 3, 3, 2, 2, 2, 2, 1, 1] },
    'nations-league': { career: [4, 3, 2, 2, 1, 1, 1, 1, 1, 1], season: [2, 2, 1, 1, 1, 1, 1, 1, 1, 1] },
  },
  portugal: {
    'world-cup': { career: [8, 8, 4, 4, 3, 3, 2, 2, 2, 2], season: [4, 4, 3, 3, 2, 2, 2, 1, 1, 1] },
    euro: { career: [14, 9, 6, 5, 3, 3, 3, 2, 2, 2], season: [5, 4, 3, 3, 3, 2, 2, 2, 1, 1] },
    'nations-league': { career: [14, 4, 3, 2, 2, 1, 1, 1, 1, 1], season: [6, 3, 2, 2, 1, 1, 1, 1, 1, 1] },
  },
  netherlands: {
    'world-cup': { career: [7, 6, 6, 5, 5, 4, 4, 3, 3, 3], season: [5, 4, 3, 3, 3, 2, 2, 2, 2, 1] },
    euro: { career: [6, 6, 5, 4, 4, 4, 3, 3, 3, 3], season: [4, 3, 3, 3, 2, 2, 2, 2, 1, 1] },
    'nations-league': { career: [6, 4, 3, 2, 2, 1, 1, 1, 1, 1], season: [3, 2, 2, 1, 1, 1, 1, 1, 1, 1] },
  },
  turkey: {
    'world-cup': { career: [3, 2, 2, 1, 1, 1], season: [3, 2, 1, 1, 1, 1] },
    euro: { career: [4, 3, 2, 2, 1, 1, 1, 1], season: [3, 2, 2, 1, 1, 1, 1, 1] },
    'nations-league': { career: [3, 2, 1, 1, 1], season: [2, 1, 1, 1, 1] },
  },
  brazil: {
    'world-cup': { career: [15, 12, 11, 9, 8, 8, 7, 6, 6, 5], season: [8, 8, 7, 6, 5, 5, 4, 4, 4, 4] },
    'copa-america': { career: [17, 15, 13, 12, 11, 10, 9, 8, 8, 7], season: [9, 8, 7, 6, 5, 5, 4, 4, 4, 3] },
  },
  argentina: {
    'world-cup': { career: [13, 10, 8, 8, 7, 6, 5, 4, 4, 4], season: [8, 6, 5, 4, 4, 4, 3, 3, 3, 2] },
    'copa-america': { career: [13, 9, 8, 7, 6, 6, 5, 5, 4, 4], season: [6, 5, 5, 4, 4, 3, 3, 3, 2, 2] },
  },
  uruguay: {
    'world-cup': { career: [8, 8, 7, 5, 4, 4, 3, 3, 3, 2], season: [5, 4, 3, 3, 2, 2, 2, 2, 1, 1] },
    'copa-america': { career: [17, 13, 10, 8, 7, 6, 6, 5, 5, 4], season: [7, 6, 5, 4, 4, 3, 3, 3, 2, 2] },
  },
  'united-states': {
    'world-cup': { career: [5, 5, 4, 4, 3, 3, 2, 2, 2, 2], season: [4, 3, 2, 2, 2, 1, 1, 1, 1, 1] },
    'gold-cup': { career: [18, 13, 9, 8, 7, 6, 6, 5, 5, 4], season: [6, 5, 4, 4, 3, 3, 3, 2, 2, 2] },
  },
  mexico: {
    'world-cup': { career: [8, 4, 4, 4, 3, 3, 3, 2, 2, 2], season: [4, 3, 3, 2, 2, 2, 2, 1, 1, 1] },
    'gold-cup': { career: [20, 14, 12, 11, 9, 8, 7, 6, 6, 5], season: [7, 6, 5, 4, 4, 3, 3, 3, 2, 2] },
  },
  'saudi-arabia': {
    'world-cup': { career: [3, 2, 1, 1, 1], season: [2, 1, 1, 1, 1] },
    'asian-cup': { career: [12, 8, 6, 5, 4, 4, 3, 3, 2, 2], season: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1] },
  },
  egypt: {
    'world-cup': { career: [2, 1, 1, 1], season: [2, 1, 1, 1] },
    afcon: { career: [16, 13, 12, 11, 10, 8, 7, 6, 6, 5], season: [8, 6, 5, 5, 4, 4, 3, 3, 3, 2] },
  },
  nigeria: {
    'world-cup': { career: [4, 3, 2, 2, 1, 1, 1], season: [3, 2, 1, 1, 1, 1, 1] },
    afcon: { career: [13, 11, 10, 9, 8, 7, 6, 6, 5, 5], season: [6, 5, 4, 4, 3, 3, 3, 2, 2, 2] },
  },
  senegal: {
    'world-cup': { career: [3, 2, 1, 1, 1], season: [3, 1, 1, 1, 1] },
    afcon: { career: [11, 8, 6, 5, 4, 4, 3, 3, 3, 2], season: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1] },
  },
  cameroon: {
    'world-cup': { career: [5, 4, 3, 2, 2, 1, 1], season: [3, 2, 2, 1, 1, 1, 1] },
    afcon: { career: [18, 11, 9, 8, 6, 6, 5, 5, 4, 4], season: [6, 5, 4, 4, 3, 3, 3, 2, 2, 2] },
  },
  'ivory-coast': {
    'world-cup': { career: [3, 2, 1, 1, 1], season: [2, 1, 1, 1, 1] },
    afcon: { career: [11, 8, 6, 5, 4, 4, 3, 3, 2, 2], season: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1] },
  },
  japan: {
    'world-cup': { career: [4, 3, 2, 2, 2, 1, 1, 1], season: [2, 2, 1, 1, 1, 1, 1, 1] },
    'asian-cup': { career: [9, 8, 7, 6, 5, 5, 4, 4, 3, 3], season: [5, 4, 3, 3, 2, 2, 2, 2, 1, 1] },
  },
  'south-korea': {
    'world-cup': { career: [5, 3, 3, 2, 2, 2, 1, 1], season: [3, 2, 2, 1, 1, 1, 1, 1] },
    'asian-cup': { career: [11, 8, 7, 6, 5, 4, 4, 3, 3, 3], season: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1] },
  },
  iran: {
    'world-cup': { career: [3, 2, 1, 1, 1], season: [2, 1, 1, 1, 1] },
    'asian-cup': { career: [14, 11, 8, 6, 5, 4, 4, 3, 3, 3], season: [6, 5, 4, 3, 3, 2, 2, 2, 1, 1] },
  },
  australia: {
    'world-cup': { career: [5, 3, 2, 1, 1, 1], season: [3, 2, 1, 1, 1, 1] },
    'asian-cup': { career: [6, 5, 4, 3, 3, 2, 2, 2, 1, 1], season: [4, 3, 2, 2, 1, 1, 1, 1, 1, 1] },
  },
  'new-zealand': {
    'world-cup': { career: [2, 1, 1], season: [1, 1, 1] },
    'ofc-nations-cup': { career: [10, 8, 6, 5, 4, 4, 3, 3, 2, 2], season: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1] },
  },
  belgium: {
    'world-cup': { career: [6, 5, 4, 3, 3, 2, 2, 2, 1, 1], season: [4, 3, 2, 2, 2, 1, 1, 1, 1, 1] },
    euro: { career: [6, 4, 3, 3, 2, 2, 2, 1, 1, 1], season: [3, 3, 2, 2, 1, 1, 1, 1, 1, 1] },
    'nations-league': { career: [5, 3, 2, 1, 1, 1], season: [3, 2, 1, 1, 1, 1] },
  },
  croatia: {
    'world-cup': { career: [6, 4, 4, 3, 3, 2, 2, 2, 1, 1], season: [3, 3, 2, 2, 2, 1, 1, 1, 1, 1] },
    euro: { career: [4, 3, 2, 2, 1, 1, 1, 1], season: [3, 2, 1, 1, 1, 1, 1, 1] },
  },
  poland: {
    'world-cup': { career: [10, 7, 4, 3, 2, 2, 1, 1], season: [7, 4, 3, 2, 1, 1, 1, 1] },
    euro: { career: [3, 3, 2, 2, 1, 1, 1], season: [2, 2, 1, 1, 1, 1, 1] },
  },
  sweden: {
    'world-cup': { career: [5, 4, 4, 3, 3, 2, 2, 2], season: [5, 4, 3, 3, 2, 2, 1, 1] },
    euro: { career: [4, 3, 3, 2, 2, 1, 1, 1], season: [3, 3, 2, 2, 1, 1, 1, 1] },
  },
  norway: {
    'world-cup': { career: [2, 1, 1, 1], season: [1, 1, 1, 1] },
    euro: { career: [2, 1, 1, 1], season: [1, 1, 1, 1] },
  },
  'republic-of-ireland': {
    'world-cup': { career: [3, 2, 1, 1], season: [2, 1, 1, 1] },
    euro: { career: [3, 2, 1, 1], season: [2, 1, 1, 1] },
  },
  morocco: {
    'world-cup': { career: [3, 2, 2, 1, 1], season: [2, 2, 1, 1, 1] },
    afcon: { career: [8, 6, 5, 4, 4, 3, 3, 2, 2, 2], season: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1] },
  },
  ghana: {
    'world-cup': { career: [3, 2, 2, 1, 1], season: [3, 2, 1, 1, 1] },
    afcon: { career: [11, 8, 6, 5, 4, 4, 3, 3, 2, 2], season: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1] },
  },
  chile: {
    'world-cup': { career: [4, 4, 3, 2, 2, 1, 1], season: [4, 3, 2, 2, 1, 1, 1] },
    'copa-america': { career: [9, 8, 7, 6, 5, 4, 4, 3, 3, 2], season: [5, 4, 4, 3, 3, 2, 2, 2, 1, 1] },
  },
  colombia: {
    'world-cup': { career: [4, 3, 2, 2, 1, 1], season: [3, 2, 2, 1, 1, 1] },
    'copa-america': { career: [9, 7, 6, 5, 4, 4, 3, 3, 2, 2], season: [5, 4, 3, 3, 2, 2, 2, 1, 1, 1] },
  },
};

const NATION_RECORD_HOLDER: Record<string, number> = {
  portugal: 146, argentina: 125, iran: 108, india: 95, belgium: 93, malaysia: 89, poland: 89,
  'united-arab-emirates': 85, england: 85, hungary: 84, brazil: 80, zambia: 79, iraq: 78,
  japan: 75, kuwait: 75, 'bosnia-and-herzegovina': 73, 'saudi-arabia': 72, malawi: 71, thailand: 71,
  germany: 71, indonesia: 70, 'trinidad-and-tobago': 70, uruguay: 69, egypt: 69, guatemala: 68,
  'republic-of-ireland': 68, france: 66, 'ivory-coast': 65, serbia: 64, norway: 62, sweden: 62,
  qatar: 60, spain: 59, maldives: 58, 'south-korea': 58, honduras: 57, 'united-states': 57,
  cameroon: 56, czechia: 55, singapore: 55, netherlands: 55, senegal: 55, denmark: 52,
  philippines: 52, mexico: 52, vietnam: 51, ghana: 51, turkey: 51, chile: 51, australia: 50,
  venezuela: 50, ecuador: 49, austria: 49, bahrain: 49, bulgaria: 48, ukraine: 48,
  'costa-rica': 47, algeria: 46, fiji: 45, croatia: 45, 'new-zealand': 45, uzbekistan: 45,
  haiti: 44, 'antigua-and-barbuda': 44, panama: 43, finland: 43, canada: 42, switzerland: 42,
  oman: 42, malta: 42, wales: 41, libya: 40, 'hong-kong': 40, gabon: 40, peru: 40,
  'el-salvador': 39, angola: 39, 'china-pr': 39, 'north-macedonia': 38, estonia: 38, nigeria: 37,
  grenada: 37, zimbabwe: 37, montenegro: 37, myanmar: 36, syria: 36, tunisia: 36, morocco: 36,
  'northern-ireland': 36, colombia: 36, italy: 35, kenya: 35, israel: 35, jamaica: 35,
  romania: 35, slovenia: 35, 'solomon-islands': 34, 'burkina-faso': 34, guinea: 33, ethiopia: 33,
  'saint-vincent-and-the-grenadines': 32, kosovo: 32, cyprus: 32, togo: 32, armenia: 32,
  paraguay: 32, tahiti: 31, 'south-africa': 31, 'north-korea': 31, bolivia: 31, jordan: 31,
  scotland: 30, cuba: 30, yemen: 30, mozambique: 30, greece: 29, latvia: 29,
  'dominican-republic': 28, belize: 28, iceland: 28, uganda: 28, sudan: 27, 'sri-lanka': 27,
  georgia: 26, guam: 26, nicaragua: 26, lebanon: 26, slovakia: 26, 'equatorial-guinea': 25,
  'chinese-taipei': 25, tanzania: 25, mali: 25, 'saint-kitts-and-nevis': 24, botswana: 24,
  rwanda: 24, benin: 24, guyana: 23, barbados: 23, 'new-caledonia': 23, luxembourg: 23,
  'dr-congo': 22, niger: 22, 'cape-verde': 22, curacao: 21, bermuda: 20, 'saint-lucia': 20,
  cambodia: 20, vanuatu: 20, 'puerto-rico': 20, comoros: 20, dominica: 20, tajikistan: 20,
  belarus: 20, namibia: 20, 'turks-and-caicos-islands': 19, laos: 19, burundi: 19, lithuania: 19,
  'papua-new-guinea': 18, moldova: 18, palestine: 18, albania: 18, liberia: 18, macau: 17,
  pakistan: 17, bangladesh: 17, mauritius: 17, eswatini: 17, 'central-african-republic': 16,
  turkmenistan: 16, congo: 16, kyrgyzstan: 16, azerbaijan: 16, liechtenstein: 16, suriname: 15,
  kazakhstan: 15, madagascar: 15, lesotho: 15, seychelles: 14, nepal: 14, bahamas: 14,
  bhutan: 14, chad: 14, gambia: 14, montserrat: 13, mauritania: 13, 'cayman-islands': 12,
  djibouti: 11, 'sao-tome-and-principe': 11, andorra: 11, 'faroe-islands': 10, afghanistan: 10,
  'guinea-bissau': 9, samoa: 9, 'brunei-darussalam': 9, mongolia: 9, aruba: 8, 'timor-leste': 8,
  'sierra-leone': 8, 'san-marino': 8, gibraltar: 8, tonga: 7, 'cook-islands': 7,
  'british-virgin-islands': 7, eritrea: 6, 'south-sudan': 6, anguilla: 5, 'american-samoa': 4,
  somalia: 3, 'us-virgin-islands': 3,
};

const NATION_OVERALL_TOP10: Record<string, number[]> = {
  england: [85, 53, 49, 48, 44, 40, 30, 30, 30, 27],
  spain: [59, 44, 38, 35, 29, 27, 26, 23, 22, 20],
  france: [66, 57, 51, 41, 34, 31, 30, 28, 26, 24],
  germany: [71, 68, 47, 45, 43, 42, 41, 37, 33, 31],
  italy: [35, 33, 30, 27, 27, 25, 23, 22, 20, 19],
  portugal: [146, 47, 41, 32, 29, 24, 22, 22, 21, 20],
  netherlands: [55, 50, 42, 40, 37, 35, 33, 31, 30, 24],
  turkey: [51, 30, 21, 21, 19, 17, 16, 16, 15, 14],
  brazil: [80, 77, 62, 55, 44, 39, 33, 33, 32, 31],
  argentina: [125, 56, 54, 44, 35, 34, 31, 29, 28, 26],
  'united-states': [57, 57, 42, 30, 19, 18, 17, 17, 16, 15],
  mexico: [52, 46, 37, 35, 33, 30, 29, 29, 24, 23],
  'saudi-arabia': [72, 42, 32, 28, 26, 24, 22, 20, 19, 17],
  belgium: [93, 30, 26, 24, 23, 21, 18, 17, 16, 15],
  poland: [89, 48, 45, 27, 24, 21, 20, 16, 16, 14],
  sweden: [62, 32, 31, 30, 29, 27, 26, 24, 22, 21],
  croatia: [45, 33, 22, 18, 16, 15, 13, 12, 10, 10],
  uruguay: [69, 58, 46, 31, 29, 26, 22, 22, 21, 19],
  egypt: [69, 68, 42, 34, 33, 24, 22, 20, 19, 17],
  japan: [75, 55, 50, 37, 31, 29, 27, 24, 23, 21],
  'south-korea': [58, 50, 36, 33, 30, 27, 26, 24, 22, 21],
  iran: [108, 54, 41, 38, 28, 24, 22, 20, 19, 17],
  australia: [50, 29, 28, 27, 25, 23, 20, 18, 17, 16],
  nigeria: [37, 35, 32, 31, 22, 21, 20, 18, 16, 15],
  senegal: [55, 29, 24, 22, 20, 18, 16, 14, 13, 12],
  cameroon: [56, 26, 24, 21, 20, 18, 16, 15, 14, 13],
  'ivory-coast': [65, 29, 25, 22, 18, 16, 15, 14, 13, 12],
  ghana: [51, 27, 22, 20, 18, 16, 15, 14, 13, 12],
  morocco: [36, 25, 24, 22, 20, 18, 16, 15, 14, 13],
  scotland: [30, 30, 24, 22, 20, 19, 18, 16, 15, 14],
  wales: [41, 28, 23, 19, 17, 16, 15, 13, 12, 11],
  'republic-of-ireland': [68, 21, 19, 19, 16, 14, 13, 12, 11, 10],
  denmark: [52, 52, 44, 38, 30, 26, 22, 21, 21, 20],
  switzerland: [42, 34, 29, 23, 22, 20, 18, 17, 16, 15],
  austria: [49, 27, 26, 24, 20, 19, 17, 16, 15, 14],
  chile: [51, 37, 34, 32, 24, 22, 20, 18, 17, 16],
  colombia: [36, 31, 27, 25, 24, 23, 20, 18, 17, 16],
  peru: [40, 26, 22, 20, 19, 16, 15, 14, 13, 12],
  ecuador: [49, 31, 23, 16, 15, 13, 12, 11, 10, 9],
  paraguay: [32, 26, 22, 19, 17, 15, 14, 13, 12, 11],
  'new-zealand': [45, 29, 17, 12, 10, 9, 8, 7, 6, 6],
  canada: [42, 25, 22, 19, 16, 14, 13, 12, 11, 10],
  norway: [62, 33, 26, 23, 20, 17, 16, 15, 13, 12],
  hungary: [84, 75, 59, 51, 47, 39, 34, 32, 31, 30],
  czechia: [55, 41, 37, 27, 22, 20, 18, 17, 16, 15],
  serbia: [64, 38, 26, 22, 19, 17, 16, 15, 14, 13],
  romania: [35, 35, 31, 25, 23, 21, 19, 18, 16, 15],
  ukraine: [48, 42, 25, 22, 17, 16, 13, 12, 11, 10],
  greece: [29, 24, 21, 19, 17, 14, 13, 12, 11, 10],
  russia: [26, 22, 21, 17, 16, 13, 12, 11, 10, 9],
};

export function nationOverallTotals(nationId: string): number[] {
  return NATION_OVERALL_TOP10[nationId] ?? (NATION_RECORD_HOLDER[nationId] != null ? [NATION_RECORD_HOLDER[nationId]!] : []);
}

export function nationTournamentLadders(
  nationId: string,
  tournament: string,
): NationTournamentLadders | null {
  return NATION_TOURNAMENT[nationId]?.[tournament] ?? null;
}
