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
  type RewardState,
  type Task
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

function normalizeTask(raw: Partial<Task>): Task {
  return {
    id: raw.id ?? crypto.randomUUID(),
    title: raw.title ?? "Без названия",
    microtasks: Array.isArray(raw.microtasks)
      ? raw.microtasks.map((item) => ({ text: item.text ?? "", done: Boolean(item.done) }))
      : [],
    completed: Boolean(raw.completed),
    growthUnits: Number(raw.growthUnits ?? 0),
    stage: (raw.stage as 1 | 2 | 3 | 4) ?? 1,
    mood: (raw.mood as Task["mood"]) ?? "normal",
    maxLevelRewardClaimed: Boolean(raw.maxLevelRewardClaimed)
  };
}

function normalizeGameState(raw: unknown): GameState {
  const parsed = (raw as Partial<GameState>) ?? {};
  return {
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks.map((item) => normalizeTask(item)) : [],
    activeTaskId: typeof parsed.activeTaskId === "string" ? parsed.activeTaskId : null,
    points: Number(parsed.points ?? 0),
    inventory: Array.isArray(parsed.inventory) ? parsed.inventory.filter(Boolean) as ItemId[] : [],
    completedStreak: Number(parsed.completedStreak ?? 0),
    achievements: {
      focus10Count: Number(parsed.achievements?.focus10Count ?? 0),
      taskStreakRewardCount: Number(parsed.achievements?.taskStreakRewardCount ?? 0),
      maxLevelRewardCount: Number(parsed.achievements?.maxLevelRewardCount ?? 0)
    }
  };
}

function normalizeRewardState(raw: unknown): RewardState {
  const parsed = (raw as Partial<RewardState>) ?? {};
  return {
    goodContinuousMs: Number(parsed.goodContinuousMs ?? 0),
    rewardedFocus10Steps: Number(parsed.rewardedFocus10Steps ?? 0),
    rewardedFocus30Steps: Number(parsed.rewardedFocus30Steps ?? 0)
  };
}

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
    rewardState: normalizeRewardState(storage[STORAGE_KEYS.rewardState]),
    gameState: normalizeGameState(storage[STORAGE_KEYS.gameState])
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

async function saveDomainLists(lists: DomainLists): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.goodDomains]: lists.good,
    [STORAGE_KEYS.badDomains]: lists.bad
  });
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
    void getDomainLists().then((lists) => {
      sendResponse({
        trackerState: state.trackerState,
        currentDomain: state.currentDomain,
        currentDomainType: state.currentDomainType,
        gameState: state.gameState,
        shop: SHOP_ITEMS,
        domainLists: lists
      });
    });
    return true;
  }

  if (message?.type === "saveDomainLists") {
    const payload = message.payload as DomainLists;
    const cleaned: DomainLists = {
      good: (payload.good ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean),
      bad: (payload.bad ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean)
    };
    void saveDomainLists(cleaned).then(() => sendResponse({ ok: true }));
    return true;
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
    const title = payload.title?.trim();
    if (!title) {
      sendResponse({ ok: false, error: "Заполните название задачи" });
      return;
    }

    const task = createTask(crypto.randomUUID(), title, payload.microtasks ?? []);
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
