/**
 * Seed default PlatformConfig values.
 * Safe to run multiple times — uses upsert (only creates if key doesn't exist yet).
 * Run: npx tsx scripts/seed-config.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const defaults: Array<{
  key: string; value: number; defaultValue: number;
  minValue?: number; maxValue?: number;
  label: string; description: string; group: string; unit?: string;
}> = [
  // ── Analyst thresholds ──────────────────────────────────────────────────────
  {
    key: 'analyst_min_event_matches', value: 10, defaultValue: 10, minValue: 3, maxValue: 50,
    label: 'Partidas mínimas de equipo', unit: 'partidas',
    description: 'Número mínimo de partidas con event stream completo que el equipo debe tener para activar las reglas de análisis macro (objetivos, visión, throws).',
    group: 'analyst',
  },
  {
    key: 'analyst_min_player_matches', value: 30, defaultValue: 30, minValue: 5, maxValue: 100,
    label: 'Partidas mínimas por jugador', unit: 'partidas',
    description: 'Historial mínimo de partidas individuales por jugador para activar reglas de rendimiento (slump, KDA, GPM, DPM, draft dependency).',
    group: 'analyst',
  },
  {
    key: 'analyst_min_obj_opportunities', value: 15, defaultValue: 15, minValue: 5, maxValue: 40,
    label: 'Objetivos mínimos analizados', unit: 'objetivos',
    description: 'Número mínimo de objetivos mayores (Fangtooth, Prime, Shaper) disputados para activar reglas de visión y conversión.',
    group: 'analyst',
  },
  {
    key: 'analyst_min_chain_occ', value: 5, defaultValue: 5, minValue: 2, maxValue: 20,
    label: 'Ocurrencias mínimas (reglas de cadena)', unit: 'ocurrencias',
    description: 'Número mínimo de veces que debe ocurrir una cadena (muerte → objetivo) para que se genere el insight.',
    group: 'analyst',
  },
  {
    key: 'analyst_death_window_secs', value: 60, defaultValue: 60, minValue: 30, maxValue: 120,
    label: 'Ventana pre-objetivo (muertes)', unit: 's',
    description: 'Segundos antes de un objetivo mayor en los que una muerte se considera crítica.',
    group: 'analyst',
  },
  {
    key: 'analyst_vision_window_secs', value: 90, defaultValue: 90, minValue: 60, maxValue: 180,
    label: 'Ventana pre-objetivo (visión)', unit: 's',
    description: 'Segundos antes de un objetivo mayor en los que se evalúa el setup de visión.',
    group: 'analyst',
  },
  {
    key: 'analyst_throw_gold_lead', value: 3000, defaultValue: 3000, minValue: 1000, maxValue: 6000,
    label: 'Ventaja de oro para "throw"', unit: 'oro',
    description: 'Ventaja de oro mínima que debe haber tenido el equipo (en una partida perdida) para detectar el patrón de throw.',
    group: 'analyst',
  },
  // Ward baselines por rol (wards/min)
  {
    key: 'analyst_ward_baseline_support', value: 1.0, defaultValue: 1.0, minValue: 0.3, maxValue: 2.5,
    label: 'Wards/min — Support', unit: 'wards/min',
    description: 'Referencia de wards por minuto para el rol Support. Se dispara el insight si el jugador está por debajo del 65% de este valor.',
    group: 'analyst',
  },
  {
    key: 'analyst_ward_baseline_jungle', value: 0.5, defaultValue: 0.5, minValue: 0.1, maxValue: 1.5,
    label: 'Wards/min — Jungle', unit: 'wards/min',
    description: 'Referencia de wards por minuto para el rol Jungle.',
    group: 'analyst',
  },
  {
    key: 'analyst_ward_baseline_midlane', value: 0.35, defaultValue: 0.35, minValue: 0.1, maxValue: 1.0,
    label: 'Wards/min — Midlane', unit: 'wards/min',
    description: 'Referencia de wards por minuto para el rol Midlane.',
    group: 'analyst',
  },
  {
    key: 'analyst_ward_baseline_offlane', value: 0.30, defaultValue: 0.30, minValue: 0.1, maxValue: 1.0,
    label: 'Wards/min — Offlane', unit: 'wards/min',
    description: 'Referencia de wards por minuto para el rol Offlane.',
    group: 'analyst',
  },
  {
    key: 'analyst_ward_baseline_carry', value: 0.25, defaultValue: 0.25, minValue: 0.05, maxValue: 0.8,
    label: 'Wards/min — Carry', unit: 'wards/min',
    description: 'Referencia de wards por minuto para el rol Carry.',
    group: 'analyst',
  },

  // ── Display rules ───────────────────────────────────────────────────────────
  {
    key: 'display_pocket_pick_wr', value: 65, defaultValue: 65, minValue: 50, maxValue: 85,
    label: 'Pocket pick — WR mínimo', unit: '%',
    description: 'Winrate mínimo que debe tener un héroe (con pocas partidas) para mostrar el badge de Pocket Pick.',
    group: 'display',
  },
  {
    key: 'display_pocket_pick_max_games', value: 10, defaultValue: 10, minValue: 3, maxValue: 25,
    label: 'Pocket pick — máximo de partidas', unit: 'partidas',
    description: 'Un héroe se considera Pocket Pick solo si el jugador tiene menos de N partidas con él (muestra pequeña + WR alto).',
    group: 'display',
  },
  {
    key: 'display_one_trick_threshold', value: 50, defaultValue: 50, minValue: 30, maxValue: 80,
    label: 'One-trick alert — umbral', unit: '%',
    description: 'Porcentaje mínimo de partidas en un solo héroe para mostrar la alerta de one-trick en rivales.',
    group: 'display',
  },
  {
    key: 'display_draft_dep_concentration', value: 65, defaultValue: 65, minValue: 50, maxValue: 90,
    label: 'Dependencia de draft — concentración', unit: '%',
    description: 'Porcentaje de partidas en los 2 héroes principales que activa el insight de dependencia de draft.',
    group: 'display',
  },
  {
    key: 'display_hero_pool_narrow_depth', value: 2, defaultValue: 2, minValue: 1, maxValue: 4,
    label: 'Pool de héroes — profundidad baja', unit: 'héroes',
    description: 'Si un jugador tiene N héroes o menos distintos jugados, se muestra el aviso de "narrow pool".',
    group: 'display',
  },
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const cfg of defaults) {
    const existing = await db.platformConfig.findUnique({ where: { key: cfg.key } });
    if (existing) { skipped++; continue; }
    await db.platformConfig.create({ data: cfg });
    created++;
  }
  console.log(`Config seed: ${created} created, ${skipped} already existed.`);
}

main().catch(console.error).finally(() => db.$disconnect());
