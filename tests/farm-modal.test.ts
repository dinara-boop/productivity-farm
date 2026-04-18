import { describe, expect, it } from "vitest";
import {
  activateTask,
  completeTask,
  createAndActivateTask,
  createTask,
  pauseTask,
  type GameState
} from "../src/lib/game";
import {
  closeFarmModal,
  createFarmModalState,
  openActiveTaskModal,
  openCreateTaskModal,
  openResumeTaskModal
} from "../src/lib/farm-modal";

function createGameWithPausedTask(): GameState {
  return {
    tasks: [createTask("t1", "Paused task", ["step"], "paused", { fieldIndex: 1, slotIndex: 2 })],
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

describe("farm modal flow", () => {
  it("creates and activates a task through the create modal state", () => {
    const modal = openCreateTaskModal({ fieldIndex: 2, slotIndex: 1 });
    const created = createAndActivateTask(createGameWithPausedTask(), "t2", "New task", ["first"], modal.selectedEmptySlotForCreate);

    expect(modal.modal).toBe("createTask");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const activeModal = openActiveTaskModal(created.task.id);
    expect(activeModal.modal).toBe("activeTask");
    expect(created.game.activeTaskId).toBe("t2");
    expect(created.task.fieldIndex).toBe(2);
    expect(created.task.slotIndex).toBe(1);
    expect(created.game.tasks.filter((task) => task.status === "active")).toHaveLength(1);
  });

  it("resumes the selected paused task from its direct task modal", () => {
    const game = createGameWithPausedTask();
    const modal = openResumeTaskModal("t1");
    const resumed = activateTask(game, modal.selectedTaskIdForModal ?? "");

    expect(modal.modal).toBe("resumeTask");
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) {
      return;
    }

    expect(openActiveTaskModal(resumed.task.id).modal).toBe("activeTask");
    expect(resumed.game.activeTaskId).toBe("t1");
    expect(resumed.task.status).toBe("active");
  });

  it("does not resume a completed task from a selected task modal", () => {
    const game = createGameWithPausedTask();
    const completedGame = completeTask(game, "t1");
    const modal = openResumeTaskModal("t1");
    const resumed = activateTask(completedGame, modal.selectedTaskIdForModal ?? "");

    expect(modal).toMatchObject({ modal: "resumeTask", selectedTaskIdForModal: "t1" });
    expect(resumed.ok).toBe(false);
    if (resumed.ok) {
      return;
    }

    expect(resumed.error).toBe("task-completed");
    expect(completedGame.activeTaskId).toBeNull();
  });

  it("manages active task pause, resume, and complete through the active modal state", () => {
    const created = createAndActivateTask(createGameWithPausedTask(), "t2", "New task", []);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const activeModal = openActiveTaskModal(created.task.id);
    const paused = pauseTask(created.game, activeModal.selectedTaskIdForModal ?? "");
    expect(paused.ok).toBe(true);
    if (!paused.ok) {
      return;
    }

    expect(paused.game.activeTaskId).toBeNull();
    expect(paused.task.status).toBe("paused");

    const resumed = activateTask(paused.game, activeModal.selectedTaskIdForModal ?? "");
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) {
      return;
    }

    const completed = completeTask(resumed.game, activeModal.selectedTaskIdForModal ?? "");
    expect(completed.activeTaskId).toBeNull();
    expect(completed.tasks.find((task) => task.id === activeModal.selectedTaskIdForModal)?.status).toBe("completed");
    expect(closeFarmModal()).toEqual(createFarmModalState());
  });

  it("keeps the single active task invariant when another task is resumed", () => {
    const created = createAndActivateTask(createGameWithPausedTask(), "t2", "New task", []);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const blocked = activateTask(created.game, "t1");
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      return;
    }

    expect(blocked.error).toBe("active-task-exists");
    expect(created.game.activeTaskId).toBe("t2");
    expect(created.game.tasks.filter((task) => task.status === "active")).toHaveLength(1);
  });
});
