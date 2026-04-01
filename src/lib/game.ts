import { growthToStage, type TrackingState } from "./tracker";

export type ItemId = "green-hat" | "blue-glasses" | "legendary-crown" | "streak-ribbon";

export interface Task {
  id: string;
  title: string;
  microtasks: Array<{ text: string; done: boolean }>;
  completed: boolean;
  growthUnits: number;
  stage: 1 | 2 | 3 | 4;
  mood: "normal" | "sad" | "sick" | "dead";
  maxLevelRewardClaimed: boolean;
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

export function derivePaused(manualPause: boolean, idleState: "active" | "idle" | "locked", focused: boolean): boolean {
  return manualPause || idleState !== "active" || !focused;
}

export function createTask(id: string, title: string, microtasks: string[]): Task {
  return {
    id,
    title,
    microtasks: microtasks.map((text) => ({ text, done: false })),
    completed: false,
    growthUnits: 0,
    stage: 1,
    mood: "normal",
    maxLevelRewardClaimed: false
  };
}

export function syncActiveTaskFromTracker(game: GameState, tracker: TrackingState): GameState {
  if (!game.activeTaskId) return game;

  const tasks = game.tasks.map((task) => {
    if (task.id !== game.activeTaskId || task.completed) return task;

    const synced = {
      ...task,
      growthUnits: tracker.growthUnits,
      stage: growthToStage(tracker.growthUnits),
      mood: tracker.mood
    };

    return synced;
  });

  const next: GameState = { ...game, tasks };
  const active = next.tasks.find((task) => task.id === next.activeTaskId && !task.completed);

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
  if (!task || task.completed) return game;

  task.completed = true;
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
