/** A flat map of stat name → numeric value at a specific level. */
export type StatBlock = Record<string, number>;

export interface AbilitySnapshot {
  key: string;
  display_name: string;
  cooldown: number[];
  cost: number[];
  menu_description: string;
}

export interface HeroSnapshot {
  id: number;
  slug: string;
  name: string;
  roles: string[];
  stats: StatBlock;
  abilities: AbilitySnapshot[];
}

export interface ItemSnapshot {
  slug: string;
  name: string;
  stats: StatBlock;
}

export interface BuildSnapshot {
  hero: HeroSnapshot;
  items: ItemSnapshot[];
  level: number;
  totalStats: StatBlock;
}
