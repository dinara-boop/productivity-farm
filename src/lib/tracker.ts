export type DomainType = "good" | "bad" | "neutral";
export type MonsterMood = "normal" | "sad" | "sick" | "dead";

export interface TrackingState {
  goodMs: number;
  badContinuousMs: number;
  growthUnits: number;
  activeElapsedMs: number;
  mood: MonsterMood;
  paused: boolean;
}

export interface TrackerThresholds {
  growthMs: number;
  sickMs: number;
  deadMs: number;
}

export const DEFAULT_THRESHOLDS: TrackerThresholds = {
  growthMs: 2 * 60 * 1000, // TEST TIMINGS
  sickMs: 1 * 60 * 1000, // TEST TIMINGS
  deadMs: 2 * 60 * 1000 // TEST TIMINGS
};

export const INITIAL_STATE: TrackingState = {
  goodMs: 0,
  badContinuousMs: 0,
  growthUnits: 0,
  activeElapsedMs: 0,
  mood: "normal",
  paused: false
};

export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) return null;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeDomainList(entries: string[]): string[] {
  const unique = new Set<string>();

  for (const entry of entries) {
    const normalized = normalizeDomain(entry);
    if (normalized) {
      unique.add(normalized);
    }
  }

  return [...unique];
}

export function growthToStage(growthUnits: number): 1 | 2 | 3 | 4 {
  if (growthUnits >= 3) return 4;
  if (growthUnits === 2) return 3;
  if (growthUnits === 1) return 2;
  return 1;
}

export function applyTick(
  state: TrackingState,
  domainType: DomainType,
  deltaMs: number,
  thresholds: TrackerThresholds = DEFAULT_THRESHOLDS
): TrackingState {
  if (state.paused) {
    return state;
  }

  const next: TrackingState = { ...state };
  const elapsedMs = Math.max(0, deltaMs);
  next.activeElapsedMs += elapsedMs;

  if (domainType === "good") {
    next.goodMs += elapsedMs;
    next.badContinuousMs = 0;
    next.mood = "normal";
  } else if (domainType === "bad") {
    next.badContinuousMs += elapsedMs;
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
    growthUnits: 0,
    activeElapsedMs: 0
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

export function shouldPreserveTrackingForUrl(url: string): boolean {
  return (
    url.startsWith("chrome-extension://") ||
    url.startsWith("chrome://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  );
}

function matchesDomainRule(domain: string, entries: string[]): boolean {
  return entries.some((entry) => domain === entry || domain.endsWith(`.${entry}`));
}

export function classifyDomain(domain: string | null, lists: { good: string[]; bad: string[] }): DomainType {
  if (!domain) return "neutral";

  if (matchesDomainRule(domain, lists.good)) return "good";
  if (matchesDomainRule(domain, lists.bad)) return "bad";

  return "neutral";
}
