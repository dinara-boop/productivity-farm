export const STORAGE_KEYS = {
  tracker: "trackerState",
  lastTick: "lastTickMs",
  paused: "trackingPausedManually",
  goodDomains: "goodDomains",
  badDomains: "badDomains",
  currentDomain: "currentDomain",
  currentDomainType: "currentDomainType",
  rewardState: "rewardState",
  gameState: "gameState",
  popupContext: "popupContext"
} as const;

export interface DomainLists {
  good: string[];
  bad: string[];
}

export function createEmptyDomainLists(): DomainLists {
  return {
    good: [],
    bad: []
  };
}
