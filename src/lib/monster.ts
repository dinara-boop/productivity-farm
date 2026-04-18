export const MONSTER_HATCH_MS = 10_000;

export const MONSTER_IMAGE_MAP = {
  normal: {
    0: "./assets/monsters/normal_stage_0_egg.png.png",
    1: "./assets/monsters/normal_stage_1_hatch.png.png",
    2: "./assets/monsters/normal_stage_2_baby.png.png",
    3: "./assets/monsters/normal_stage_3_mid.png.png",
    4: "./assets/monsters/normal_stage_4_adult.png.png"
  },
  sad: {
    1: "./assets/monsters/sad_stage_1.png.png",
    2: "./assets/monsters/sad_stage_2.png.png",
    3: "./assets/monsters/sad_stage_3.png.png",
    4: "./assets/monsters/sad_stage_4.png.png"
  },
  dead: "./assets/monsters/dead.png.png"
} as const;

export const MONSTER_IMAGE_FALLBACK = MONSTER_IMAGE_MAP.normal[1];

export type MonsterVisualMood = "normal" | "sad" | "sick" | "dead" | string;

export type MonsterVisualState = {
  stage?: number | null;
  mood?: MonsterVisualMood | null;
  activeElapsedMs?: number | null;
};

function clampStage(stage: number): 0 | 1 | 2 | 3 | 4 {
  if (stage <= 0) {
    return 0;
  }

  if (stage === 1) {
    return 1;
  }

  if (stage === 2) {
    return 2;
  }

  if (stage === 3) {
    return 3;
  }

  return 4;
}

export function resolveMonsterStage(state: MonsterVisualState): 0 | 1 | 2 | 3 | 4 {
  const normalizedStage = Number.isFinite(state.stage) ? Math.trunc(state.stage ?? 1) : 1;
  const clampedStage = clampStage(normalizedStage);
  const activeElapsedMs = Number.isFinite(state.activeElapsedMs)
    ? Math.max(0, Math.trunc(state.activeElapsedMs ?? 0))
    : MONSTER_HATCH_MS;

  if (clampedStage <= 1 && activeElapsedMs < MONSTER_HATCH_MS) {
    return 0;
  }

  if (clampedStage === 0) {
    return 1;
  }

  return clampedStage;
}

function resolveSadStage(stage: 0 | 1 | 2 | 3 | 4): 1 | 2 | 3 | 4 {
  if (stage <= 1) {
    return 1;
  }

  if (stage === 2) {
    return 2;
  }

  if (stage === 3) {
    return 3;
  }

  return 4;
}

export function resolveMonsterImage(state: MonsterVisualState): string {
  if (state.mood === "dead") {
    return MONSTER_IMAGE_MAP.dead;
  }

  const stage = resolveMonsterStage(state);

  if (state.mood === "sad" || state.mood === "sick") {
    return MONSTER_IMAGE_MAP.sad[resolveSadStage(stage)] ?? MONSTER_IMAGE_FALLBACK;
  }

  return MONSTER_IMAGE_MAP.normal[stage] ?? MONSTER_IMAGE_FALLBACK;
}
