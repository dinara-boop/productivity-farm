export type DomainType = "good" | "bad" | "neutral";
export type MonsterMood = "normal" | "sad" | "sick" | "dead";

export interface TrackingState {
  goodMs: number;
  badContinuousMs: number;
  growthUnits: number;
  mood: MonsterMood;
  paused: boolean;
}

export interface TrackerThresholds {
  growthMs: number;
  sickMs: number;
  deadMs: number;
}

export const DEFAULT_THRESHOLDS: TrackerThresholds = {
  growthMs: 45 * 60 * 1000,
  sickMs: 20 * 60 * 1000,
  deadMs: 60 * 60 * 1000
};

export const INITIAL_STATE: TrackingState = {
  goodMs: 0,
  badContinuousMs: 0,
  growthUnits: 0,
  mood: "normal",
  paused: false
};

export function applyTick(
  state: TrackingState,
  domainType: DomainType,
  deltaMs: number,
  thresholds: TrackerThresholds = DEFAULT_THRESHOLDS
): TrackingState {
  if (state.paused || deltaMs <= 0) {
    return state;
  }

  const next: TrackingState = { ...state };

  if (domainType === "good") {
    next.goodMs += deltaMs;
    next.badContinuousMs = 0;
    next.mood = "normal";
  } else if (domainType === "bad") {
    next.badContinuousMs += deltaMs;
    next.mood = "sad";

    if (next.badContinuousMs >= thresholds.deadMs) {
      next.mood = "dead";
    } else if (next.badContinuousMs >= thresholds.sickMs) {
      next.mood = "sick";
    }
  } else {
    next.badContinuousMs = 0;
    if (next.mood !== "dead") {
      next.mood = "normal";
    }
  }

  const totalUnits = Math.floor(next.goodMs / thresholds.growthMs);
  if (totalUnits > next.growthUnits) {
    next.growthUnits = totalUnits;
  }

  return next;
}

export function resetDeadMonster(state: TrackingState): TrackingState {
  return {
    ...state,
    mood: "normal",
    goodMs: 0,
    badContinuousMs: 0,
    growthUnits: 0
  };
}

export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return null;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function classifyDomain(domain: string | null, lists: { good: string[]; bad: string[] }): DomainType {
  if (!domain) return "neutral";

  if (lists.good.includes(domain)) return "good";
  if (lists.bad.includes(domain)) return "bad";

  return "neutral";
}
