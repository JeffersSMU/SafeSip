// Drink presets (DESIGN §5.4). Standard drinks are hardcoded.

export interface DrinkPreset {
  key: string;
  name: string;
  size: string;
  std: number;
  emoji: string;
}

export const DRINK_PRESETS: DrinkPreset[] = [
  { key: 'beer', name: 'Beer', size: '330 ml', std: 1.3, emoji: '🍺' },
  { key: 'wine', name: 'Wine', size: '150 ml', std: 1.5, emoji: '🍷' },
  { key: 'shot', name: 'Shot', size: '30 ml', std: 1, emoji: '🥃' },
  { key: 'cocktail', name: 'Cocktail', size: '1 glass', std: 1.5, emoji: '🍹' },
  { key: 'cider', name: 'Cider', size: '330 ml', std: 1.3, emoji: '🍏' },
  { key: 'water', name: 'Water', size: '1 glass', std: 0, emoji: '💧' },
];

export const MARTINI = { name: 'Martini', size: '90 ml', abv: 30, std: 2, emoji: '🍸' };

/** Standard drinks for a custom "Other" drink: ml × ABV% × 0.789 g/ml ÷ 10 g (Singapore standard drink). */
export const customStd = (ml: number, abv: number) => Math.round(((ml * (abv / 100) * 0.789) / 10) * 10) / 10;

export type Pace = 'LOW' | 'MED' | 'HIGH';

/** Pace from standard drinks per hour: LOW < 1, MED 1–2, HIGH > 2. */
export function paceOf(stdTotal: number, hours: number): Pace {
  const rate = hours > 0 ? stdTotal / hours : 0;
  if (rate > 2) return 'HIGH';
  if (rate >= 1) return 'MED';
  return 'LOW';
}
