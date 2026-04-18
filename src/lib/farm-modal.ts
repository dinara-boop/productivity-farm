import type { FarmPlacement } from "./farm-fields.js";

export type FarmModalName = "none" | "createTask" | "resumeTask" | "activeTask" | "shop" | "achievements";

export type FarmModalState = {
  modal: FarmModalName;
  selectedTaskIdForModal: string | null;
  selectedEmptySlotForCreate: FarmPlacement | null;
};

export function createFarmModalState(): FarmModalState {
  return {
    modal: "none",
    selectedTaskIdForModal: null,
    selectedEmptySlotForCreate: null
  };
}

export function closeFarmModal(): FarmModalState {
  return createFarmModalState();
}

export function openCreateTaskModal(slot?: FarmPlacement | null): FarmModalState {
  return {
    modal: "createTask",
    selectedTaskIdForModal: null,
    selectedEmptySlotForCreate: slot ?? null
  };
}

export function openResumeTaskModal(taskId?: string | null): FarmModalState {
  return {
    modal: "resumeTask",
    selectedTaskIdForModal: taskId ?? null,
    selectedEmptySlotForCreate: null
  };
}

export function openActiveTaskModal(taskId: string): FarmModalState {
  return {
    modal: "activeTask",
    selectedTaskIdForModal: taskId,
    selectedEmptySlotForCreate: null
  };
}

export function openShopModal(): FarmModalState {
  return {
    modal: "shop",
    selectedTaskIdForModal: null,
    selectedEmptySlotForCreate: null
  };
}

export function openAchievementsModal(): FarmModalState {
  return {
    modal: "achievements",
    selectedTaskIdForModal: null,
    selectedEmptySlotForCreate: null
  };
}
