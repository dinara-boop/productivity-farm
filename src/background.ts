import {
  INITIAL_STATE,
  applyTick,
  classifyDomain,
  extractDomain,
  growthToStage,
  resetDeadMonster,
  type DomainType,
  type TrackingState
} from "./lib/tracker";

type DomainLists = { good: string[]; bad: string[] };

type ItemId = "green-hat" | "blue-glasses" | "legendary-crown" | "streak-ribbon";

interface ShopItem {
  id: ItemId;
  title: string;
  price: number;
}

interface Task {
  id: string;
  title: string;
  microtasks: Array<{ text: string; done: boolean }>;
  completed: boolean;
  growthUnits: number;
  stage: 1 | 2 | 3 | 4;
  mood: "normal" | "sad" | "sick" | "dead";
  maxLevelRewardClaimed: boolean;
}

interface AchievementState {
  focus10Count: number;
  taskStreakRewardCount: number;
  maxLevelRewardCount: number;
}

interface GameState {
  tasks: Task[];
  activeTaskId: string | null;
  points: number;
  inventory: ItemId[];
  completedStreak: number;
  achievements: AchievementState;
}

type PersistentState = {
  trackerState: TrackingState;
  trackingPausedManually: boolean;
  currentDomain: string | null;
  currentDomainType: DomainType;
  goodContinuousMs: number;
  rewardedFocus10Steps: number;
  rewardedFocus30Steps: number;
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
  goodContinuousMs: "goodContinuousMs",
  focus10steps: "rewardedFocus10Steps",
  focus30steps: "rewardedFocus30Steps",
  gameState: "gameState"
} as const;

const EMPTY_GAME_STATE: GameState = {
  tasks: [],
  activeTaskId: null,
  points: 0,
  inventory: [],
  completedStreak: 0,
  achievements: {
    focus10Count: 0,
    taskStreakRewardCount: 0,
    maxLevelRewardCount: 0
  }
};

let state: PersistentState = {
  trackerState: INITIAL_STATE,
  trackingPausedManually: false,
  currentDomain: null,
  currentDomainType: "neutral",
  goodContinuousMs: 0,
  rewardedFocus10Steps: 0,
  rewardedFocus30Steps: 0,
  gameState: EMPTY_GAME_STATE
};

let lastTick = Date.now();

function createTask(title: string, microtasks: string[]): Task {
  return {
    id: crypto.randomUUID(),
    title,
    microtasks: microtasks.map((text) => ({ text, done: false })),
    completed: false,
    growthUnits: 0,
    stage: 1,
    mood: "normal",
    maxLevelRewardClaimed: false
  };
}

function awardItem(itemId: ItemId): void {
  state.gameState.inventory.push(itemId);
}

function hasItem(itemId: ItemId): boolean {
  return state.gameState.inventory.includes(itemId);
}

function resetTrackerProgress(): void {
  state.trackerState = { ...INITIAL_STATE };
  state.goodContinuousMs = 0;
  state.rewardedFocus10Steps = 0;
  state.rewardedFocus30Steps = 0;
}

function getActiveTask(): Task | undefined {
  if (!state.gameState.activeTaskId) return undefined;
  return state.gameState.tasks.find((task) => task.id === state.gameState.activeTaskId && !task.completed);
}

function updateActiveTaskFromTracker(): void {
  const activeTask = getActiveTask();
  if (!activeTask) return;

  activeTask.growthUnits = state.trackerState.growthUnits;
  activeTask.stage = growthToStage(activeTask.growthUnits);
  activeTask.mood = state.trackerState.mood;

  if (activeTask.stage === 4 && !activeTask.maxLevelRewardClaimed) {
    activeTask.maxLevelRewardClaimed = true;
    state.gameState.achievements.maxLevelRewardCount += 1;
    awardItem("legendary-crown");
  }
}

function completeTask(taskId: string): boolean {
  const task = state.gameState.tasks.find((item) => item.id === taskId);
  if (!task || task.completed) return false;

  task.completed = true;
  task.stage = 4;
  task.mood = "normal";

  state.gameState.points += 50;
  state.gameState.completedStreak += 1;

  if (state.gameState.completedStreak % 3 === 0) {
    state.gameState.achievements.taskStreakRewardCount += 1;
    awardItem("streak-ribbon");
  }

  if (state.gameState.activeTaskId === task.id) {
    state.gameState.activeTaskId = null;
    resetTrackerProgress();
  }

  return true;
}

async function loadState(): Promise<void> {
  const storage = (await chrome.storage.local.get(Object.values(STORAGE_KEYS))) as Record<string, unknown>;

  state = {
    trackerState: (storage[STORAGE_KEYS.tracker] as TrackingState | undefined) ?? INITIAL_STATE,
    trackingPausedManually: (storage[STORAGE_KEYS.paused] as boolean | undefined) ?? false,
    currentDomain: (storage[STORAGE_KEYS.currentDomain] as string | null | undefined) ?? null,
    currentDomainType: (storage[STORAGE_KEYS.currentDomainType] as DomainType | undefined) ?? "neutral",
    goodContinuousMs: (storage[STORAGE_KEYS.goodContinuousMs] as number | undefined) ?? 0,
    rewardedFocus10Steps: (storage[STORAGE_KEYS.focus10steps] as number | undefined) ?? 0,
    rewardedFocus30Steps: (storage[STORAGE_KEYS.focus30steps] as number | undefined) ?? 0,
    gameState: (storage[STORAGE_KEYS.gameState] as GameState | undefined) ?? EMPTY_GAME_STATE
  };
}

async function saveState(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.tracker]: state.trackerState,
    [STORAGE_KEYS.paused]: state.trackingPausedManually,
    [STORAGE_KEYS.currentDomain]: state.currentDomain,
    [STORAGE_KEYS.currentDomainType]: state.currentDomainType,
    [STORAGE_KEYS.goodContinuousMs]: state.goodContinuousMs,
    [STORAGE_KEYS.focus10steps]: state.rewardedFocus10Steps,
    [STORAGE_KEYS.focus30steps]: state.rewardedFocus30Steps,
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

function applyFocusRewards(deltaMs: number): void {
  if (state.currentDomainType === "good" && !state.trackerState.paused) {
    state.goodContinuousMs += deltaMs;
  } else {
    state.goodContinuousMs = 0;
    state.rewardedFocus10Steps = 0;
    state.rewardedFocus30Steps = 0;
    return;
  }

  const next10Steps = Math.floor(state.goodContinuousMs / (10 * 60 * 1000));
  while (state.rewardedFocus10Steps < next10Steps) {
    state.rewardedFocus10Steps += 1;
    state.gameState.achievements.focus10Count += 1;
    state.gameState.points += 5;
  }

  const next30Steps = Math.floor(state.goodContinuousMs / (30 * 60 * 1000));
  while (state.rewardedFocus30Steps < next30Steps) {
    state.rewardedFocus30Steps += 1;
    state.gameState.points += 10;
  }
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
  applyFocusRewards(deltaMs);
  updateActiveTaskFromTracker();

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
    const task = createTask(payload.title, payload.microtasks);
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
    updateActiveTaskFromTracker();
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
      completeTask(task.id);
    }

    void saveState().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "completeTask") {
    const payload = message.payload as { taskId: string };
    const success = completeTask(payload.taskId);
    void saveState().then(() => sendResponse({ ok: success }));
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
    awardItem(item.id);

    void saveState().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message?.type === "reviveMonster") {
    state.trackerState = resetDeadMonster(state.trackerState);
    updateActiveTaskFromTracker();
    void saveState().then(() => sendResponse({ ok: true }));
    return true;
  }
});
