import { resolveMonsterImage, resolveMonsterStage } from "./monster.js";

export type PopupTask = {
  id: string;
  title: string;
  stage: 1 | 2 | 3 | 4;
  activeElapsedMs: number;
  mood: "normal" | "sad" | "sick" | "dead";
  status: "active" | "paused" | "completed";
};

export type PopupContextResponse = {
  lastFocusedTaskId: string | null;
  elapsedMsByTaskId: Record<string, number>;
  activeStartedAt: number | null;
};

export type PopupStatusResponse = {
  gameState?: {
    tasks: PopupTask[];
    activeTaskId: string | null;
  };
  popupContext?: PopupContextResponse;
};

export type PopupViewModel =
  | {
      mode: "empty";
      popupTitle: string;
      openFarmButtonText: string;
      showTaskCard: false;
      taskActionButtonText: null;
      taskAction: null;
      taskId: null;
      taskTitle: null;
      monsterImageSrc: null;
      monsterVisualStage: null;
      monsterMood: null;
      monsterStateText: null;
      elapsedText: null;
    }
  | {
      mode: "active";
      popupTitle: string;
      openFarmButtonText: string;
      showTaskCard: true;
      taskActionButtonText: string;
      taskAction: "pause";
      taskId: string;
      taskTitle: string;
      monsterImageSrc: string;
      monsterVisualStage: number;
      monsterMood: PopupTask["mood"];
      monsterStateText: string;
      elapsedText: string;
    }
  | {
      mode: "paused";
      popupTitle: string;
      openFarmButtonText: string;
      showTaskCard: true;
      taskActionButtonText: string;
      taskAction: "resume";
      taskId: string;
      taskTitle: string;
      monsterImageSrc: string;
      monsterVisualStage: number;
      monsterMood: PopupTask["mood"];
      monsterStateText: string;
      elapsedText: string;
    };

const LABELS = {
  popupTitle: "Ферма продуктивности",
  openFarm: "Перейти в ферму",
  pauseTask: "Поставить на паузу",
  resumeTask: "Возобновить задачу",
  state: "Состояние монстрика",
  elapsed: "Прошло",
  moods: {
    normal: "Нормальное",
    sad: "Грустное",
    sick: "Болеет",
    dead: "Мертв"
  }
} as const;

function getTaskById(status: PopupStatusResponse, taskId: string | null | undefined): PopupTask | undefined {
  if (!taskId) {
    return undefined;
  }

  return status.gameState?.tasks.find((task) => task.id === taskId);
}

export function getPopupVisibleTask(status: PopupStatusResponse): PopupTask | undefined {
  const activeTask = getTaskById(status, status.gameState?.activeTaskId);
  if (activeTask?.status === "active") {
    return activeTask;
  }

  const lastFocusedTask = getTaskById(status, status.popupContext?.lastFocusedTaskId);
  if (lastFocusedTask?.status === "paused") {
    return lastFocusedTask;
  }

  return undefined;
}

export function getPopupElapsedMs(status: PopupStatusResponse, now = Date.now()): number {
  const task = getPopupVisibleTask(status);
  if (!task) {
    return 0;
  }

  const storedElapsed = status.popupContext?.elapsedMsByTaskId?.[task.id] ?? 0;
  const isActive = status.gameState?.activeTaskId === task.id && task.status === "active";
  const activeStartedAt = status.popupContext?.activeStartedAt ?? null;

  if (!isActive || activeStartedAt === null) {
    return storedElapsed;
  }

  return storedElapsed + Math.max(0, now - activeStartedAt);
}

export function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [hours, minutes, seconds].map((value) => String(value).padStart(2, "0"));
  return parts.join(":");
}

function getMoodText(mood: PopupTask["mood"]): string {
  return LABELS.moods[mood];
}

export function getPopupViewModel(status: PopupStatusResponse, now = Date.now()): PopupViewModel {
  const task = getPopupVisibleTask(status);

  if (!task) {
    return {
      mode: "empty",
      popupTitle: LABELS.popupTitle,
      openFarmButtonText: LABELS.openFarm,
      showTaskCard: false,
      taskActionButtonText: null,
      taskAction: null,
      taskId: null,
      taskTitle: null,
      monsterImageSrc: null,
      monsterVisualStage: null,
      monsterMood: null,
      monsterStateText: null,
      elapsedText: null
    };
  }

  const shared = {
    popupTitle: LABELS.popupTitle,
    openFarmButtonText: LABELS.openFarm,
    showTaskCard: true as const,
    taskId: task.id,
    taskTitle: task.title,
    monsterImageSrc: resolveMonsterImage(task),
    monsterVisualStage: resolveMonsterStage(task),
    monsterMood: task.mood,
    monsterStateText: `${LABELS.state}: ${getMoodText(task.mood)}`,
    elapsedText: `${LABELS.elapsed}: ${formatElapsedTime(getPopupElapsedMs(status, now))}`
  };

  if (task.status === "active") {
    return {
      mode: "active",
      taskActionButtonText: LABELS.pauseTask,
      taskAction: "pause",
      ...shared
    };
  }

  return {
    mode: "paused",
    taskActionButtonText: LABELS.resumeTask,
    taskAction: "resume",
    ...shared
  };
}
