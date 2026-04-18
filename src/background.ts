import {
  INITIAL_STATE,
  classifyDomain,
  extractDomain,
  normalizeDomainList,
  resetDeadMonster,
  shouldPreserveTrackingForUrl,
  type DomainType,
  type TrackingState
} from "./lib/tracker.js";
import { normalizeFarmTaskPlacements } from "./lib/farm-fields.js";
import {
  activateTask,
  completeTask,
  createAndActivateTask,
  createEmptyGameState,
  createEmptyRewardState,
  derivePaused,
  normalizeStoredTask,
  pauseActiveTask,
  pauseTask,
  syncActiveTaskFromTracker,
  type GameState,
  type ItemId,
  type TaskOperationError,
  type RewardState
} from "./lib/game.js";
import { sanitizeChecklistItems } from "./lib/checklist.js";
import { advanceLiveState } from "./lib/live-state.js";
import { STORAGE_KEYS, type DomainLists } from "./lib/storage.js";

interface ShopItem {
  id: ItemId;
  title: string;
  price: number;
}

type PopupContext = {
  lastFocusedTaskId: string | null;
  elapsedMsByTaskId: Record<string, number>;
  activeStartedAt: number | null;
};

type PersistentState = {
  trackerState: TrackingState;
  trackingPausedManually: boolean;
  currentDomain: string | null;
  currentDomainType: DomainType;
  rewardState: RewardState;
  gameState: GameState;
  popupContext: PopupContext;
};

const TEXT = {
  shop: {
    greenHat: "\u0417\u0435\u043b\u0435\u043d\u0430\u044f \u0448\u043b\u044f\u043f\u0430",
    blueGlasses: "\u0421\u0438\u043d\u0438\u0435 \u043e\u0447\u043a\u0438",
    legendaryCrown: "\u041b\u0435\u0433\u0435\u043d\u0434\u0430\u0440\u043d\u0430\u044f \u043a\u043e\u0440\u043e\u043d\u0430",
    streakRibbon: "\u041b\u0435\u043d\u0442\u0430 \u0441\u0435\u0440\u0438\u0438 \u0437\u0430\u0434\u0430\u0447"
  },
  errors: {
    taskTitleRequired: "\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438.",
    taskNotFound: "\u0417\u0430\u0434\u0430\u0447\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430.",
    taskAlreadyCompleted: "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043d\u043d\u0443\u044e \u0437\u0430\u0434\u0430\u0447\u0443 \u043d\u0435\u043b\u044c\u0437\u044f \u0430\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c.",
    taskNotActive: "\u0417\u0430\u0434\u0430\u0447\u0430 \u0443\u0436\u0435 \u043d\u0435 \u0430\u043a\u0442\u0438\u0432\u043d\u0430.",
    activeTaskExists: "\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043f\u043e\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0442\u0435\u043a\u0443\u0449\u0443\u044e \u0437\u0430\u0434\u0430\u0447\u0443 \u043d\u0430 \u043f\u0430\u0443\u0437\u0443.",
    farmFull: "\u0414\u043e\u0441\u0442\u0438\u0433\u043d\u0443\u0442 \u043b\u0438\u043c\u0438\u0442 \u0437\u0430\u0434\u0430\u0447 \u043d\u0430 \u0444\u0435\u0440\u043c\u0435 (16).",
    taskSlotUnavailable: "\u0412\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0439 \u0441\u043b\u043e\u0442 \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442. \u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u043e\u0439 \u043f\u0443\u0441\u0442\u043e\u0439 \u0441\u043b\u043e\u0442.",
    microtaskNotFound: "\u041c\u0438\u043a\u0440\u043e\u0437\u0430\u0434\u0430\u0447\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430.",
    itemNotFound: "\u041f\u0440\u0435\u0434\u043c\u0435\u0442 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.",
    itemAlreadyOwned: "\u041f\u0440\u0435\u0434\u043c\u0435\u0442 \u0443\u0436\u0435 \u043a\u0443\u043f\u043b\u0435\u043d.",
    notEnoughPoints: "\u041d\u0435 \u0445\u0432\u0430\u0442\u0430\u0435\u0442 \u043e\u0447\u043a\u043e\u0432.",
    unknownMessageType: "\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439 \u0442\u0438\u043f \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u044f.",
    unknownError: "\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430."
  }
} as const;

const SHOP_ITEMS: ShopItem[] = [
  { id: "green-hat", title: TEXT.shop.greenHat, price: 30 },
  { id: "blue-glasses", title: TEXT.shop.blueGlasses, price: 40 },
  { id: "legendary-crown", title: TEXT.shop.legendaryCrown, price: 0 },
  { id: "streak-ribbon", title: TEXT.shop.streakRibbon, price: 0 }
];

let state: PersistentState = {
  trackerState: { ...INITIAL_STATE },
  trackingPausedManually: false,
  currentDomain: null,
  currentDomainType: "neutral",
  rewardState: createEmptyRewardState(),
  gameState: createEmptyGameState(),
  popupContext: {
    lastFocusedTaskId: null,
    elapsedMsByTaskId: {},
    activeStartedAt: null
  }
};

let lastTick = Date.now();
let initializationPromise: Promise<void> | null = null;

function hasItem(itemId: ItemId): boolean {
  return state.gameState.inventory.includes(itemId);
}

function createEmptyPopupContext(): PopupContext {
  return {
    lastFocusedTaskId: null,
    elapsedMsByTaskId: {},
    activeStartedAt: null
  };
}

function normalizeStoredPopupContext(popupContext: PopupContext | undefined, gameState: GameState): PopupContext {
  const next = createEmptyPopupContext();
  const incompleteTaskIds = new Set(gameState.tasks.filter((task) => task.status !== "completed").map((task) => task.id));

  gameState.tasks.forEach((task) => {
    if (task.status === "completed") {
      return;
    }

    next.elapsedMsByTaskId[task.id] = popupContext?.elapsedMsByTaskId?.[task.id] ?? task.activeElapsedMs ?? 0;
  });

  if (gameState.activeTaskId && incompleteTaskIds.has(gameState.activeTaskId)) {
    next.lastFocusedTaskId = gameState.activeTaskId;
    next.activeStartedAt =
      typeof popupContext?.activeStartedAt === "number" ? popupContext.activeStartedAt : Date.now();
    return next;
  }

  const storedLastFocusedTaskId = popupContext?.lastFocusedTaskId ?? null;
  if (storedLastFocusedTaskId && incompleteTaskIds.has(storedLastFocusedTaskId)) {
    next.lastFocusedTaskId = storedLastFocusedTaskId;
  }

  return next;
}

function ensurePopupElapsedTask(taskId: string): void {
  if (state.popupContext.elapsedMsByTaskId[taskId] === undefined) {
    const task = state.gameState.tasks.find((item) => item.id === taskId);
    state.popupContext.elapsedMsByTaskId[taskId] = task?.activeElapsedMs ?? 0;
  }
}

function startPopupTaskTimer(taskId: string): void {
  ensurePopupElapsedTask(taskId);
  state.popupContext.lastFocusedTaskId = taskId;
  state.popupContext.activeStartedAt = Date.now();
}

function stopPopupTaskTimer(taskId: string): void {
  ensurePopupElapsedTask(taskId);

  if (state.popupContext.activeStartedAt !== null) {
    state.popupContext.elapsedMsByTaskId[taskId] += Math.max(0, Date.now() - state.popupContext.activeStartedAt);
  }

  state.popupContext.lastFocusedTaskId = taskId;
  state.popupContext.activeStartedAt = null;
}

function clearPopupTask(taskId: string): void {
  delete state.popupContext.elapsedMsByTaskId[taskId];

  if (state.popupContext.lastFocusedTaskId === taskId) {
    state.popupContext.lastFocusedTaskId = state.gameState.activeTaskId;
  }

  if (state.gameState.activeTaskId === null) {
    state.popupContext.activeStartedAt = null;
  }
}

function resetTrackerProgress(): void {
  state.trackerState = { ...INITIAL_STATE };
  state.rewardState = createEmptyRewardState();
}

function loadTrackerFromTask(taskId: string): void {
  const task = state.gameState.tasks.find((item) => item.id === taskId);
  if (!task) {
    resetTrackerProgress();
    return;
  }

  state.trackerState = {
    goodMs: task.goodMs,
    badContinuousMs: task.badContinuousMs,
    growthUnits: task.growthUnits,
    activeElapsedMs: task.activeElapsedMs,
    mood: task.mood,
    paused: state.trackingPausedManually
  };
  state.rewardState = createEmptyRewardState();
}

function syncAndResetTrackerForNoActiveTask(): void {
  resetTrackerProgress();
  state.trackerState.paused = true;
}

function mapTaskOperationError(error: TaskOperationError): string {
  switch (error) {
    case "active-task-exists":
      return TEXT.errors.activeTaskExists;
    case "farm-full":
      return TEXT.errors.farmFull;
    case "task-slot-unavailable":
      return TEXT.errors.taskSlotUnavailable;
    case "task-completed":
      return TEXT.errors.taskAlreadyCompleted;
    case "task-not-active":
      return TEXT.errors.taskNotActive;
    case "task-not-found":
    default:
      return TEXT.errors.taskNotFound;
  }
}

async function pauseCurrentActiveTask(): Promise<{ ok: boolean; error?: string }> {
  state.gameState = syncActiveTaskFromTracker(state.gameState, state.trackerState);
  const activeTaskId = state.gameState.activeTaskId;

  const result = pauseActiveTask(state.gameState);
  if (!result.ok) {
    if (result.error === "task-not-active") {
      return { ok: true };
    }

    return { ok: false, error: mapTaskOperationError(result.error) };
  }

  state.gameState = result.game;
  if (activeTaskId) {
    stopPopupTaskTimer(activeTaskId);
  }
  syncAndResetTrackerForNoActiveTask();
  await saveState();
  return { ok: true };
}

function normalizeStoredGameState(gameState: GameState | undefined): GameState {
  if (!gameState) {
    return createEmptyGameState();
  }

  const tasks = normalizeFarmTaskPlacements(
    (gameState.tasks ?? []).map((task) => normalizeStoredTask(task, gameState.activeTaskId ?? null))
  );
  let activeTaskId: string | null = null;
  const normalizedTasks = tasks.map((task) => {
    if (task.status !== "active") {
      return task;
    }

    if (activeTaskId === null) {
      activeTaskId = task.id;
      return task;
    }

    return {
      ...task,
      status: "paused" as const
    };
  });

  return {
    tasks: normalizedTasks,
    activeTaskId,
    points: gameState.points ?? 0,
    inventory: gameState.inventory ?? [],
    completedStreak: gameState.completedStreak ?? 0,
    achievements: {
      focus10Count: gameState.achievements?.focus10Count ?? 0,
      taskStreakRewardCount: gameState.achievements?.taskStreakRewardCount ?? 0,
      maxLevelRewardCount: gameState.achievements?.maxLevelRewardCount ?? 0
    }
  };
}

function normalizeStoredRewardState(rewardState: RewardState | undefined): RewardState {
  if (!rewardState) {
    return createEmptyRewardState();
  }

  return {
    goodContinuousMs: rewardState.goodContinuousMs ?? 0,
    rewardedFocus10Steps: rewardState.rewardedFocus10Steps ?? 0,
    rewardedFocus30Steps: rewardState.rewardedFocus30Steps ?? 0
  };
}

async function loadState(): Promise<void> {
  const storage = (await chrome.storage.local.get(Object.values(STORAGE_KEYS))) as Record<string, unknown>;

  state = {
    trackerState: (storage[STORAGE_KEYS.tracker] as TrackingState | undefined) ?? { ...INITIAL_STATE },
    trackingPausedManually: (storage[STORAGE_KEYS.paused] as boolean | undefined) ?? false,
    currentDomain: (storage[STORAGE_KEYS.currentDomain] as string | null | undefined) ?? null,
    currentDomainType: (storage[STORAGE_KEYS.currentDomainType] as DomainType | undefined) ?? "neutral",
    rewardState: normalizeStoredRewardState(storage[STORAGE_KEYS.rewardState] as RewardState | undefined),
    gameState: normalizeStoredGameState(storage[STORAGE_KEYS.gameState] as GameState | undefined),
    popupContext: createEmptyPopupContext()
  };
  state.popupContext = normalizeStoredPopupContext(storage[STORAGE_KEYS.popupContext] as PopupContext | undefined, state.gameState);
  lastTick = (storage[STORAGE_KEYS.lastTick] as number | undefined) ?? Date.now();
}

async function saveState(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.tracker]: state.trackerState,
    [STORAGE_KEYS.lastTick]: lastTick,
    [STORAGE_KEYS.paused]: state.trackingPausedManually,
    [STORAGE_KEYS.currentDomain]: state.currentDomain,
    [STORAGE_KEYS.currentDomainType]: state.currentDomainType,
    [STORAGE_KEYS.rewardState]: state.rewardState,
    [STORAGE_KEYS.gameState]: state.gameState,
    [STORAGE_KEYS.popupContext]: state.popupContext
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

async function saveDomainLists(lists: DomainLists): Promise<DomainLists> {
  const normalized = {
    good: normalizeDomainList(lists.good),
    bad: normalizeDomainList(lists.bad)
  };

  await chrome.storage.local.set({
    [STORAGE_KEYS.goodDomains]: normalized.good,
    [STORAGE_KEYS.badDomains]: normalized.bad
  });

  return normalized;
}

async function ensureInitialized(forceReload = false): Promise<void> {
  if (!initializationPromise || forceReload) {
    initializationPromise = (async () => {
      await loadState();
    })();
  }

  await initializationPromise;
}

async function resetTickBaseline(): Promise<void> {
  lastTick = Date.now();
  await saveState();
}

async function isChromeWindowFocused(): Promise<boolean> {
  const lastFocused = await chrome.windows.getLastFocused();
  return lastFocused.focused;
}

async function updateCurrentDomainType(): Promise<void> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeUrl = activeTab?.url ?? "";
  if (shouldPreserveTrackingForUrl(activeUrl)) {
    return;
  }

  const domain = extractDomain(activeUrl);
  const lists = await getDomainLists();

  state.currentDomain = domain;
  state.currentDomainType = classifyDomain(domain, lists);
}

async function tick(): Promise<void> {
  await advanceStateToNow();
  await saveState();
}

async function advanceStateToNow(now = Date.now()): Promise<void> {
  await ensureInitialized();

  const deltaMs = Math.max(0, now - lastTick);
  lastTick = now;

  const idle = await chrome.idle.queryState(300);
  const focused = await isChromeWindowFocused();

  state.trackerState.paused = derivePaused(
    state.trackingPausedManually,
    idle,
    focused,
    state.gameState.activeTaskId !== null
  );

  await updateCurrentDomainType();

  const next = advanceLiveState(
    state.gameState,
    state.trackerState,
    state.rewardState,
    state.currentDomainType,
    deltaMs
  );
  state.trackerState = next.trackerState;
  state.rewardState = next.rewardState;
  state.gameState = next.gameState;
}

async function bootstrap(): Promise<void> {
  await ensureInitialized(true);
  await chrome.alarms.create("trackerTick", { periodInMinutes: 1 / 6 });
}

async function handleMessage(message: unknown): Promise<unknown> {
  await ensureInitialized();

  const typedMessage = message as { type?: string; payload?: unknown };

  if (typedMessage?.type === "getStatus") {
    await advanceStateToNow();
    return {
      trackerState: state.trackerState,
      trackingPausedManually: state.trackingPausedManually,
      currentDomain: state.currentDomain,
      currentDomainType: state.currentDomainType
    };
  }

  if (typedMessage?.type === "getGameState") {
    await advanceStateToNow();
    return {
      trackerState: state.trackerState,
      trackingPausedManually: state.trackingPausedManually,
      currentDomain: state.currentDomain,
      currentDomainType: state.currentDomainType,
      gameState: state.gameState,
      popupContext: state.popupContext,
      shop: SHOP_ITEMS
    };
  }

  if (typedMessage?.type === "getDomainLists") {
    return getDomainLists();
  }

  if (typedMessage?.type === "saveDomainLists") {
    const payload = typedMessage.payload as DomainLists;
    const lists = await saveDomainLists(payload);
    state.currentDomainType = classifyDomain(state.currentDomain, lists);
    await saveState();
    return { ok: true, lists };
  }

  if (typedMessage?.type === "togglePause") {
    state.trackingPausedManually = !state.trackingPausedManually;
    state.trackerState.paused = state.trackingPausedManually || state.gameState.activeTaskId === null;
    lastTick = Date.now();
    await saveState();
    return { paused: state.trackingPausedManually };
  }

  if (typedMessage?.type === "createTask") {
    const payload = typedMessage.payload as {
      title: string;
      microtasks: string[];
      fieldIndex?: number;
      slotIndex?: number;
    };
    const title = payload.title.trim();
    const microtasks = sanitizeChecklistItems(payload.microtasks ?? []);
    const preferredPlacement =
      typeof payload.fieldIndex === "number" && typeof payload.slotIndex === "number"
        ? { fieldIndex: payload.fieldIndex, slotIndex: payload.slotIndex }
        : null;

    if (!title) {
      return { ok: false, error: TEXT.errors.taskTitleRequired };
    }

    const result = createAndActivateTask(state.gameState, crypto.randomUUID(), title, microtasks, preferredPlacement);
    if (!result.ok) {
      return { ok: false, error: mapTaskOperationError(result.error) };
    }

    state.gameState = result.game;
    loadTrackerFromTask(result.task.id);
    startPopupTaskTimer(result.task.id);
    lastTick = Date.now();
    await saveState();
    return { ok: true, task: result.task };
  }

  if (typedMessage?.type === "activateTask") {
    const payload = typedMessage.payload as { taskId: string };
    const result = activateTask(state.gameState, payload.taskId);
    if (!result.ok) {
      return { ok: false, error: mapTaskOperationError(result.error) };
    }

    state.gameState = result.game;
    loadTrackerFromTask(result.task.id);
    state.gameState = syncActiveTaskFromTracker(state.gameState, state.trackerState);
    startPopupTaskTimer(result.task.id);
    lastTick = Date.now();
    await saveState();
    return { ok: true };
  }

  if (typedMessage?.type === "pauseTask") {
    const payload = typedMessage.payload as { taskId: string };
    state.gameState = syncActiveTaskFromTracker(state.gameState, state.trackerState);

    const result = pauseTask(state.gameState, payload.taskId);
    if (!result.ok) {
      return { ok: false, error: mapTaskOperationError(result.error) };
    }

    state.gameState = result.game;
    stopPopupTaskTimer(payload.taskId);
    syncAndResetTrackerForNoActiveTask();
    lastTick = Date.now();
    await saveState();
    return { ok: true };
  }

  if (typedMessage?.type === "pauseActiveTask") {
    return pauseCurrentActiveTask();
  }

  if (typedMessage?.type === "toggleMicrotask") {
    const payload = typedMessage.payload as { taskId: string; index: number };
    const task = state.gameState.tasks.find((item) => item.id === payload.taskId);
    if (!task) {
      return { ok: false, error: TEXT.errors.taskNotFound };
    }

    const microtask = task.microtasks[payload.index];
    if (!microtask) {
      return { ok: false, error: TEXT.errors.microtaskNotFound };
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
        syncAndResetTrackerForNoActiveTask();
      }
    }

    await saveState();
    return { ok: true };
  }

  if (typedMessage?.type === "completeTask") {
    const payload = typedMessage.payload as { taskId: string };
    const prevActive = state.gameState.activeTaskId;
    state.gameState = syncActiveTaskFromTracker(state.gameState, state.trackerState);
    if (prevActive === payload.taskId) {
      stopPopupTaskTimer(payload.taskId);
    }
    state.gameState = completeTask(state.gameState, payload.taskId);
    clearPopupTask(payload.taskId);
    if (prevActive && state.gameState.activeTaskId === null) {
      syncAndResetTrackerForNoActiveTask();
    }
    await saveState();
    return { ok: true };
  }

  if (typedMessage?.type === "buyItem") {
    const payload = typedMessage.payload as { itemId: ItemId };
    const item = SHOP_ITEMS.find((current) => current.id === payload.itemId);

    if (!item) {
      return { ok: false, error: TEXT.errors.itemNotFound };
    }

    if (hasItem(item.id)) {
      return { ok: false, error: TEXT.errors.itemAlreadyOwned };
    }

    if (state.gameState.points < item.price) {
      return { ok: false, error: TEXT.errors.notEnoughPoints };
    }

    state.gameState.points -= item.price;
    state.gameState.inventory.push(item.id);

    await saveState();
    return { ok: true };
  }

  if (typedMessage?.type === "reviveMonster") {
    state.trackerState = resetDeadMonster(state.trackerState);
    state.gameState = syncActiveTaskFromTracker(state.gameState, state.trackerState);
    await saveState();
    return { ok: true };
  }

  return { ok: false, error: TEXT.errors.unknownMessageType };
}

void bootstrap();

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
  void handleMessage(message)
    .then((response) => {
      sendResponse(response);
    })
    .catch((error: unknown) => {
      const messageText = error instanceof Error ? error.message : TEXT.errors.unknownError;
      sendResponse({ ok: false, error: messageText });
    });
  return true;
});
