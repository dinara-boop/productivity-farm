import {
  INITIAL_STATE,
  applyTick,
  classifyDomain,
  extractDomain,
  type DomainType,
  type TrackingState
} from "./lib/tracker";

type DomainLists = { good: string[]; bad: string[] };

type PersistentState = {
  trackerState: TrackingState;
  trackingPausedManually: boolean;
  currentDomain: string | null;
  currentDomainType: DomainType;
};

const STORAGE_KEYS = {
  tracker: "trackerState",
  paused: "trackingPausedManually",
  goodDomains: "goodDomains",
  badDomains: "badDomains",
  currentDomain: "currentDomain",
  currentDomainType: "currentDomainType"
} as const;

let state: PersistentState = {
  trackerState: INITIAL_STATE,
  trackingPausedManually: false,
  currentDomain: null,
  currentDomainType: "neutral"
};

let lastTick = Date.now();

async function loadState(): Promise<void> {
  const storage = (await chrome.storage.local.get([
    STORAGE_KEYS.tracker,
    STORAGE_KEYS.paused,
    STORAGE_KEYS.currentDomain,
    STORAGE_KEYS.currentDomainType
  ])) as Record<string, unknown>;

  state = {
    trackerState: (storage[STORAGE_KEYS.tracker] as TrackingState | undefined) ?? INITIAL_STATE,
    trackingPausedManually: (storage[STORAGE_KEYS.paused] as boolean | undefined) ?? false,
    currentDomain: (storage[STORAGE_KEYS.currentDomain] as string | null | undefined) ?? null,
    currentDomainType: (storage[STORAGE_KEYS.currentDomainType] as DomainType | undefined) ?? "neutral"
  };
}

async function saveState(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.tracker]: state.trackerState,
    [STORAGE_KEYS.paused]: state.trackingPausedManually,
    [STORAGE_KEYS.currentDomain]: state.currentDomain,
    [STORAGE_KEYS.currentDomainType]: state.currentDomainType
  });
}

async function getDomainLists(): Promise<DomainLists> {
  const storage = (await chrome.storage.local.get([
    STORAGE_KEYS.goodDomains,
    STORAGE_KEYS.badDomains
  ])) as Record<string, unknown>;

  return {
    good: (storage[STORAGE_KEYS.goodDomains] as string[] | undefined) ?? [],
    bad: (storage[STORAGE_KEYS.badDomains] as string[] | undefined) ?? []
  };
}

async function isChromeWindowFocused(): Promise<boolean> {
  const lastFocused = await chrome.windows.getLastFocused();
  return lastFocused.focused;
}

async function updateCurrentDomainType(): Promise<void> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = extractDomain(activeTab?.url ?? "");
  const lists = await getDomainLists();

  state.currentDomain = domain;
  state.currentDomainType = classifyDomain(domain, lists);
}

async function tick(): Promise<void> {
  const now = Date.now();
  const deltaMs = now - lastTick;
  lastTick = now;

  const idle = await chrome.idle.queryState(300);
  const focused = await isChromeWindowFocused();

  state.trackerState.paused = state.trackingPausedManually || idle !== "active" || !focused;

  await updateCurrentDomainType();

  state.trackerState = applyTick(state.trackerState, state.currentDomainType, deltaMs);
  await saveState();
}

async function bootstrap(): Promise<void> {
  await loadState();
  await chrome.alarms.create("trackerTick", { periodInMinutes: 1 / 6 });
}

chrome.runtime.onInstalled.addListener(() => {
  void bootstrap();
});

chrome.runtime.onStartup.addListener(() => {
  void bootstrap();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "trackerTick") return;
  void tick();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "getStatus") {
    sendResponse({
      trackerState: state.trackerState,
      currentDomain: state.currentDomain,
      currentDomainType: state.currentDomainType
    });
    return;
  }

  if (message?.type === "togglePause") {
    state.trackingPausedManually = !state.trackingPausedManually;
    void saveState().then(() => {
      sendResponse({ paused: state.trackingPausedManually });
    });
    return true;
  }
});
