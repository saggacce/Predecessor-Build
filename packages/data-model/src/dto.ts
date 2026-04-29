// Raw shapes returned by omeda.city REST endpoints.
// Arrays with 18 entries are per-level (index 0 = level 1).
// Arrays with 1 entry are level-invariant constants (e.g. attack_range).

export interface OmedaAbility {
  display_name: string;
  image: string;
  game_description: string;
  menu_description: string;
  cooldown: number[];
  cost: number[];
  /** "Passive" | "LMB" | "RMB" | "Q" | "E" | "R" */
  key: string;
}

export type OmedaHeroBaseStats = {
  [stat: string]: number[];
};

export interface OmedaHero {
  id: number;
  name: string;
  display_name: string;
  slug: string;
  image: string;
  /** [attack, durability, ability, difficulty] 1–10 ratings */
  stats: number[];
  classes: string[];
  /** e.g. ["Offlane", "Jungle"] — heroes can occupy multiple roles */
  roles: string[];
  abilities: OmedaAbility[];
  base_stats: OmedaHeroBaseStats;
}

export interface OmedaItemEffect {
  name: string;
  active: boolean;
  condition: string;
  menu_description: string;
}

export interface OmedaItem {
  id: number;
  name: string;
  display_name: string;
  slug: string;
  image: string;
  cost: number;
  tier: number;
  /** Flat key→value stat bonuses granted by equipping the item */
  stats: Record<string, number>;
  effects: OmedaItemEffect[];
  /** Slugs of required predecessor items in the build path */
  requirements: string[];
  build_paths: string[];
}
