import {
  INITIAL_STATE,
  applyTick,
  classifyDomain,
  extractDomain,
  resetDeadMonster,
  type DomainType,
  type TrackingState
} from "./lib/tracker";
import {
  EMPTY_GAME_STATE,
  EMPTY_REWARD_STATE,
  applyFocusRewards,
  completeTask,
  createTask,
  derivePaused,
  syncActiveTaskFromTracker,
  type GameState,
  type ItemId,
  type RewardState
} from "./lib/game";

type DomainLists = { good: string[]; bad: string[] };

interface ShopItem {
  id: ItemId;
  title: string;
  price: number;
}

type PersistentState = {
  trackerState: TrackingState;
  trackingPausedManually: boolean;
  currentDomain: string | null;
  currentDomainType: DomainType;
  rewardState: RewardState;
  gameState: GameState;
};

const SHOP_ITEMS: ShopItem[] = [
  { id: "green-hat", title: "Зелёная шляпа", price: 30 },
  { id: "blue-glasses", title: "Синие очки", price: 40 },
  { id: "legendary-crown", title: "Легендарная корона", price: 0 },
  { id: "streak-ribbon", title: "Лента серии задач", price: 0 }
];

const STORAGE_KEYS = {
  tracker: "trackerState",
  paused: "trackingPausedManually",
  goodDomains: "goodDomains",
  badDomains: "badDomains",
  currentDomain: "currentDomain",
  currentDomainType: "currentDomainType",
  rewardState: "rewardState",
  gameState: "gameState"
} as const;

let state: PersistentState = {
  trackerState: INITIAL_STATE,
  trackingPausedManually: false,
  currentDomain: null,
  currentDomainType: "neutral",
  rewardState: EMPTY_REWARD_STATE,
  gameState: EMPTY_GAME_STATE
};

let lastTick = Date.now();

function hasItem(itemId: ItemId): boolean {
  return state.gameState.inventory.includes(itemId);
}

function resetTrackerProgress(): void {
  state.trackerState = { ...INITIAL_STATE };
  state.rewardState = { ...EMPTY_REWARD_STATE };
}

async function loadState(): Promise<void> {
  const storage = (await chrome.storage.local.get(Object.values(STORAGE_KEYS))) as Record<string, unknown>;

  state = {
    trackerState: (storage[STORAGE_KEYS.tracker] as TrackingState | undefined) ?? INITIAL_STATE,
    trackingPausedManually: (storage[STORAGE_KEYS.paused] as boolean | undefined) ?? false,
    currentDomain: (storage[STORAGE_KEYS.currentDomain] as string | null | undefined) ?? null,
    currentDomainType: (storage[STORAGE_KEYS.currentDomainType] as DomainType | undefined) ?? "neutral",
    rewardState: (storage[STORAGE_KEYS.rewardState] as RewardState | undefined) ?? EMPTY_REWARD_STATE,
    gameState: (storage[STORAGE_KEYS.gameState] as GameState | undefined) ?? EMPTY_GAME_STATE
  };
}

async function saveState(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.tracker]: state.trackerState,
    [STORAGE_KEYS.paused]: state.trackingPausedManually,
    [STORAGE_KEYS.currentDomain]: state.currentDomain,
    [STORAGE_KEYS.currentDomainType]: state.currentDomainType,
    [STORAGE_KEYS.rewardState]: state.rewardState,
    [STORAGE_KEYS.gameState]: state.gameState
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

  state.trackerState.paused = derivePaused(state.trackingPausedManually, idle, focused);

  await updateCurrentDomainType();

  state.trackerState = applyTick(state.trackerState, state.currentDomainType, deltaMs);

  const rewardsResult = applyFocusRewards(
    state.gameState,
    state.rewardState,
    state.currentDomainType === "good" && !state.trackerState.paused,
    deltaMs
  );
  state.gameState = rewardsResult.game;
  state.rewardState = rewardsResult.rewards;

  state.gameState = syncActiveTaskFromTracker(state.gameState, state.trackerState);

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

  if (message?.type === "getGameState") {
    sendResponse({
      trackerState: state.trackerState,
      currentDomain: state.currentDomain,
      currentDomainType: state.currentDomainType,
      gameState: state.gameState,
      shop: SHOP_ITEMS
    });
    return;
  }

  if (message?.type === "togglePause") {
    state.trackingPausedManually = !state.trackingPausedManually;
    state.trackerState.paused = state.trackingPausedManually;
    void saveState().then(() => {
      sendResponse({ paused: state.trackingPausedManually });
    });
    return true;
  }

  if (message?.type === "createTask") {
    const payload = message.payload as { title: string; microtasks: string[] };
    const task = createTask(crypto.randomUUID(), payload.title, payload.microtasks);
    state.gameState.tasks.unshift(task);

    if (!state.gameState.activeTaskId) {
      state.gameState.activeTaskId = task.id;
      resetTrackerProgress();
    }

    void saveState().then(() => sendResponse({ ok: true, task }));
    return true;
  }

  if (message?.type === "activateTask") {
    const payload = message.payload as { taskId: string };
    const task = state.gameState.tasks.find((item) => item.id === payload.taskId && !item.completed);

    if (!task) {
      sendResponse({ ok: false, error: "Task not found" });
      return;
    }

    state.gameState.activeTaskId = task.id;
    resetTrackerProgress();
    state.gameState = syncActiveTaskFromTracker(state.gameState, state.trackerState);
    void saveState().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "toggleMicrotask") {
    const payload = message.payload as { taskId: string; index: number };
    const task = state.gameState.tasks.find((item) => item.id === payload.taskId);
    if (!task) {
      sendResponse({ ok: false, error: "Task not found" });
      return;
    }

    const microtask = task.microtasks[payload.index];
    if (!microtask) {
      sendResponse({ ok: false, error: "Microtask not found" });
      return;
    }

    const nextValue = !microtask.done;
    microtask.done = nextValue;

    if (nextValue) {
      state.gameState.points += 3;
    }

    const allDone = task.microtasks.length > 0 && task.microtasks.every((item) => item.done);
    if (allDone) {
      state.gameState = completeTask(state.gameState, task.id);
      if (state.gameState.activeTaskId === null) {
        resetTrackerProgress();
      }
    }

    void saveState().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "completeTask") {
    const payload = message.payload as { taskId: string };
    const prevActive = state.gameState.activeTaskId;
    state.gameState = completeTask(state.gameState, payload.taskId);
    if (prevActive && state.gameState.activeTaskId === null) {
      resetTrackerProgress();
    }
    void saveState().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "buyItem") {
    const payload = message.payload as { itemId: ItemId };
    const item = SHOP_ITEMS.find((current) => current.id === payload.itemId);

    if (!item) {
      sendResponse({ ok: false, error: "Item not found" });
      return;
    }

    if (hasItem(item.id)) {
      sendResponse({ ok: false, error: "Item already owned" });
      return;
    }

    if (state.gameState.points < item.price) {
      sendResponse({ ok: false, error: "Not enough points" });
      return;
    }

    state.gameState.points -= item.price;
    state.gameState.inventory.push(item.id);

    void saveState().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "reviveMonster") {
    state.trackerState = resetDeadMonster(state.trackerState);
    state.gameState = syncActiveTaskFromTracker(state.gameState, state.trackerState);
    void saveState().then(() => sendResponse({ ok: true }));
    return true;
  }
});
