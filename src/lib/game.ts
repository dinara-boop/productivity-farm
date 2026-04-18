import { sanitizeChecklistItems } from "./checklist.js";
import { findFirstFreeFarmSlot, isFarmSlotOccupied, isValidFarmPlacement, type FarmPlacement } from "./farm-fields.js";
import { DEFAULT_THRESHOLDS, growthToStage, type TrackingState } from "./tracker.js";

export type ItemId = "green-hat" | "blue-glasses" | "legendary-crown" | "streak-ribbon";
export type TaskStatus = "active" | "paused" | "completed";
export type TaskOperationError =
  | "active-task-exists"
  | "task-not-found"
  | "task-completed"
  | "task-not-active"
  | "farm-full"
  | "task-slot-unavailable";

export type TaskOperationResult =
  | { ok: true; game: GameState; task: Task }
  | { ok: false; error: TaskOperationError };

export interface Task {
  id: string;
  title: string;
  microtasks: Array<{ text: string; done: boolean }>;
  status: TaskStatus;
  goodMs: number;
  badContinuousMs: number;
  growthUnits: number;
  activeElapsedMs: number;
  stage: 1 | 2 | 3 | 4;
  mood: "normal" | "sad" | "sick" | "dead";
  maxLevelRewardClaimed: boolean;
  fieldIndex: number;
  slotIndex: number;
}

export interface AchievementState {
  focus10Count: number;
  taskStreakRewardCount: number;
  maxLevelRewardCount: number;
}

export interface GameState {
  tasks: Task[];
  activeTaskId: string | null;
  points: number;
  inventory: ItemId[];
  completedStreak: number;
  achievements: AchievementState;
}

export interface RewardState {
  goodContinuousMs: number;
  rewardedFocus10Steps: number;
  rewardedFocus30Steps: number;
}

export const EMPTY_GAME_STATE: GameState = {
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

export const EMPTY_REWARD_STATE: RewardState = {
  goodContinuousMs: 0,
  rewardedFocus10Steps: 0,
  rewardedFocus30Steps: 0
};

export function createEmptyGameState(): GameState {
  return {
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
}

export function createEmptyRewardState(): RewardState {
  return {
    goodContinuousMs: 0,
    rewardedFocus10Steps: 0,
    rewardedFocus30Steps: 0
  };
}

export function isTaskCompleted(task: Task): boolean {
  return task.status === "completed";
}

export function isTaskActive(task: Task): boolean {
  return task.status === "active";
}

export function isTaskPaused(task: Task): boolean {
  return task.status === "paused";
}

export function derivePaused(
  manualPause: boolean,
  idleState: "active" | "idle" | "locked",
  focused: boolean,
  hasActiveTask: boolean
): boolean {
  return manualPause || idleState !== "active" || !focused || !hasActiveTask;
}

export function createTask(
  id: string,
  title: string,
  microtasks: string[],
  status: TaskStatus = "paused",
  placement: FarmPlacement = { fieldIndex: 0, slotIndex: 0 }
): Task {
  return {
    id,
    title,
    microtasks: sanitizeChecklistItems(microtasks).map((text) => ({ text, done: false })),
    status,
    goodMs: 0,
    badContinuousMs: 0,
    growthUnits: 0,
    activeElapsedMs: 0,
    stage: 1,
    mood: "normal",
    maxLevelRewardClaimed: false,
    fieldIndex: placement.fieldIndex,
    slotIndex: placement.slotIndex
  };
}

export function hasActiveTask(game: GameState): boolean {
  return game.activeTaskId !== null;
}

export function getActiveTask(game: GameState): Task | undefined {
  if (!game.activeTaskId) {
    return undefined;
  }

  return game.tasks.find((task) => task.id === game.activeTaskId && isTaskActive(task));
}

export function getResumableTasks(game: GameState): Task[] {
  return game.tasks.filter(isTaskPaused);
}

export function trackerStateFromTask(task: Task): TrackingState {
  return {
    goodMs: task.goodMs,
    badContinuousMs: task.badContinuousMs,
    growthUnits: task.growthUnits,
    activeElapsedMs: task.activeElapsedMs,
    mood: task.mood,
    paused: false
  };
}

function resolveTaskPlacement(
  game: GameState,
  preferredPlacement?: FarmPlacement | null
): FarmPlacement | { ok: false; error: TaskOperationError } {
  if (preferredPlacement) {
    if (!isValidFarmPlacement(preferredPlacement) || isFarmSlotOccupied(game.tasks, preferredPlacement)) {
      return { ok: false, error: "task-slot-unavailable" };
    }

    return preferredPlacement;
  }

  const placement = findFirstFreeFarmSlot(game.tasks);
  if (!placement) {
    return { ok: false, error: "farm-full" };
  }

  return placement;
}

export function createAndActivateTask(
  game: GameState,
  id: string,
  title: string,
  microtasks: string[],
  preferredPlacement?: FarmPlacement | null
): TaskOperationResult {
  if (hasActiveTask(game)) {
    return { ok: false, error: "active-task-exists" };
  }

  const placement = resolveTaskPlacement(game, preferredPlacement);
  if (!("fieldIndex" in placement)) {
    return placement;
  }

  const task = createTask(id, title, microtasks, "active", placement);

  return {
    ok: true,
    task,
    game: {
      ...game,
      tasks: [task, ...game.tasks],
      activeTaskId: task.id
    }
  };
}

export function activateTask(game: GameState, taskId: string): TaskOperationResult {
  const task = game.tasks.find((item) => item.id === taskId);

  if (!task) {
    return { ok: false, error: "task-not-found" };
  }

  if (isTaskCompleted(task)) {
    return { ok: false, error: "task-completed" };
  }

  if (game.activeTaskId && game.activeTaskId !== taskId) {
    return { ok: false, error: "active-task-exists" };
  }

  const tasks: Task[] = game.tasks.map((item) => {
    if (isTaskCompleted(item)) {
      return item;
    }

    return {
      ...item,
      status: item.id === taskId ? ("active" as const) : ("paused" as const)
    };
  });

  const activeTask = tasks.find((item) => item.id === taskId);
  if (!activeTask) {
    return { ok: false, error: "task-not-found" };
  }

  return {
    ok: true,
    task: activeTask,
    game: {
      ...game,
      tasks,
      activeTaskId: taskId
    }
  };
}

export function pauseTask(game: GameState, taskId: string): TaskOperationResult {
  const task = game.tasks.find((item) => item.id === taskId);

  if (!task) {
    return { ok: false, error: "task-not-found" };
  }

  if (isTaskCompleted(task)) {
    return { ok: false, error: "task-completed" };
  }

  if (game.activeTaskId !== taskId || !isTaskActive(task)) {
    return { ok: false, error: "task-not-active" };
  }

  const tasks = game.tasks.map((item) =>
    item.id === taskId
      ? {
          ...item,
          status: "paused" as const
        }
      : item
  );

  const pausedTask = tasks.find((item) => item.id === taskId);
  if (!pausedTask) {
    return { ok: false, error: "task-not-found" };
  }

  return {
    ok: true,
    task: pausedTask,
    game: {
      ...game,
      tasks,
      activeTaskId: null
    }
  };
}

export function pauseActiveTask(game: GameState): TaskOperationResult {
  const activeTask = getActiveTask(game);
  if (!activeTask) {
    return { ok: false, error: "task-not-active" };
  }

  return pauseTask(game, activeTask.id);
}

export function syncActiveTaskFromTracker(game: GameState, tracker: TrackingState): GameState {
  if (!game.activeTaskId) return game;

  const tasks = game.tasks.map((task) => {
    if (task.id !== game.activeTaskId || !isTaskActive(task)) return task;

    const synced = {
      ...task,
      goodMs: tracker.goodMs,
      badContinuousMs: tracker.badContinuousMs,
      growthUnits: tracker.growthUnits,
      activeElapsedMs: tracker.activeElapsedMs,
      stage: growthToStage(tracker.growthUnits),
      mood: tracker.mood
    };

    return synced;
  });

  const next: GameState = { ...game, tasks };
  const active = getActiveTask(next);

  if (active && active.stage === 4 && !active.maxLevelRewardClaimed) {
    active.maxLevelRewardClaimed = true;
    next.achievements.maxLevelRewardCount += 1;
    next.inventory.push("legendary-crown");
  }

  return next;
}

export function applyFocusRewards(game: GameState, rewards: RewardState, isGoodAndActive: boolean, deltaMs: number): { game: GameState; rewards: RewardState } {
  const nextGame: GameState = {
    ...game,
    achievements: { ...game.achievements }
  };
  const nextRewards = { ...rewards };

  if (!isGoodAndActive) {
    return {
      game: nextGame,
      rewards: { ...EMPTY_REWARD_STATE }
    };
  }

  nextRewards.goodContinuousMs += deltaMs;

  const next10Steps = Math.floor(nextRewards.goodContinuousMs / (10 * 60 * 1000));
  while (nextRewards.rewardedFocus10Steps < next10Steps) {
    nextRewards.rewardedFocus10Steps += 1;
    nextGame.achievements.focus10Count += 1;
    nextGame.points += 5;
  }

  const next30Steps = Math.floor(nextRewards.goodContinuousMs / (30 * 60 * 1000));
  while (nextRewards.rewardedFocus30Steps < next30Steps) {
    nextRewards.rewardedFocus30Steps += 1;
    nextGame.points += 10;
  }

  return { game: nextGame, rewards: nextRewards };
}

export function completeTask(game: GameState, taskId: string): GameState {
  const next: GameState = {
    ...game,
    tasks: game.tasks.map((task) => ({ ...task, microtasks: task.microtasks.map((item) => ({ ...item })) })),
    achievements: { ...game.achievements },
    inventory: [...game.inventory]
  };

  const task = next.tasks.find((item) => item.id === taskId);
  if (!task || isTaskCompleted(task)) return game;

  task.status = "completed";
  task.stage = 4;
  task.mood = "normal";

  next.points += 50;
  next.completedStreak += 1;

  if (next.completedStreak % 3 === 0) {
    next.achievements.taskStreakRewardCount += 1;
    next.inventory.push("streak-ribbon");
  }

  if (next.activeTaskId === taskId) {
    next.activeTaskId = null;
  }

  return next;
}

export function normalizeStoredTask(task: Partial<Task> & Pick<Task, "id" | "title">, activeTaskId: string | null): Task {
  const completed = task.status === "completed";
  const isActive = !completed && (task.status === "active" || task.id === activeTaskId);
  const growthUnits = task.growthUnits ?? 0;
  const activeElapsedMs = task.activeElapsedMs ?? task.goodMs ?? 0;
  const mood = task.mood ?? "normal";

  let badContinuousMs = task.badContinuousMs ?? 0;
  if (badContinuousMs === 0) {
    if (mood === "dead") {
      badContinuousMs = DEFAULT_THRESHOLDS.deadMs;
    } else if (mood === "sick") {
      badContinuousMs = DEFAULT_THRESHOLDS.sickMs;
    }
  }

  return {
    id: task.id,
    title: task.title,
    microtasks: (task.microtasks ?? []).map((item) => ({ text: item.text, done: Boolean(item.done) })),
    status: completed ? "completed" : isActive ? "active" : "paused",
    goodMs: task.goodMs ?? growthUnits * DEFAULT_THRESHOLDS.growthMs,
    badContinuousMs,
    growthUnits,
    activeElapsedMs,
    stage: completed ? 4 : growthToStage(growthUnits),
    mood: completed ? "normal" : mood,
    maxLevelRewardClaimed: task.maxLevelRewardClaimed ?? false,
    fieldIndex: task.fieldIndex ?? 0,
    slotIndex: task.slotIndex ?? 0
  };
}
