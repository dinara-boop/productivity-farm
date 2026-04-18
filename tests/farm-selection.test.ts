import { describe, expect, it } from "vitest";
import { EMPTY_GAME_STATE, activateTask, completeTask, createAndActivateTask, createTask, pauseTask } from "../src/lib/game";
import { createFarmFieldSlots } from "../src/lib/farm-fields";
import { openCreateTaskModal, openResumeTaskModal } from "../src/lib/farm-modal";
import { resolveFarmTaskSelection } from "../src/lib/farm-selection";

describe("farm task selection", () => {
  it("empty slot opens create modal with the selected placement", () => {
    const slots = createFarmFieldSlots([], 0);
    const emptySlot = slots[0];
    expect(emptySlot.task).toBeNull();

    const modal = openCreateTaskModal({ fieldIndex: emptySlot.fieldIndex, slotIndex: emptySlot.slotIndex });
    expect(modal).toMatchObject({
      modal: "createTask",
      selectedEmptySlotForCreate: { fieldIndex: 0, slotIndex: 0 }
    });
  });

  it("clicking paused task without active opens that task modal directly", () => {
    const pausedTask = createTask("t1", "Task", [], "paused");
    const result = resolveFarmTaskSelection(
      {
        ...EMPTY_GAME_STATE,
        tasks: [pausedTask]
      },
      "t1"
    );

    expect(result.type).toBe("activate");
    if (result.type !== "activate") {
      return;
    }

    const modal = openResumeTaskModal(result.task.id);
    expect(modal).toMatchObject({ modal: "resumeTask", selectedTaskIdForModal: "t1" });
  });

  it("clicking another paused task opens its modal instead of a previous selection", () => {
    const firstTask = createTask("t1", "Task A", [], "paused", { fieldIndex: 0, slotIndex: 0 });
    const secondTask = createTask("t2", "Task B", [], "paused", { fieldIndex: 0, slotIndex: 1 });
    const firstResult = resolveFarmTaskSelection({ ...EMPTY_GAME_STATE, tasks: [firstTask, secondTask] }, "t1");
    const secondResult = resolveFarmTaskSelection({ ...EMPTY_GAME_STATE, tasks: [firstTask, secondTask] }, "t2");

    expect(firstResult.type).toBe("activate");
    expect(secondResult.type).toBe("activate");
    if (firstResult.type !== "activate" || secondResult.type !== "activate") {
      return;
    }

    expect(openResumeTaskModal(firstResult.task.id).selectedTaskIdForModal).toBe("t1");
    expect(openResumeTaskModal(secondResult.task.id).selectedTaskIdForModal).toBe("t2");
  });

  it("clicking completed task does not activate it", () => {
    const completedTask = completeTask(
      {
        ...EMPTY_GAME_STATE,
        tasks: [createTask("t1", "Task", [], "paused")]
      },
      "t1"
    ).tasks[0];

    const result = resolveFarmTaskSelection(
      {
        ...EMPTY_GAME_STATE,
        tasks: [completedTask]
      },
      "t1"
    );

    expect(result.type).toBe("completed");
    const activation = activateTask({ ...EMPTY_GAME_STATE, tasks: [completedTask] }, "t1");
    expect(activation.ok).toBe(false);
  });

  it("clicking another monster while one is active is blocked", () => {
    const first = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Task A", []);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const secondTask = createTask("t2", "Task B", [], "paused");
    const result = resolveFarmTaskSelection(
      {
        ...first.game,
        tasks: [...first.game.tasks, secondTask]
      },
      "t2"
    );

    expect(result.type).toBe("blocked");
    if (result.type !== "blocked") {
      return;
    }

    expect(result.error).toBe("active-task-exists");
  });

  it("after pausing active task click on another monster can switch task", () => {
    const first = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Task A", []);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const secondTask = createTask("t2", "Task B", [], "paused");
    const pausedFirst = pauseTask(
      {
        ...first.game,
        tasks: [...first.game.tasks, secondTask]
      },
      "t1"
    );
    expect(pausedFirst.ok).toBe(true);
    if (!pausedFirst.ok) {
      return;
    }

    const result = resolveFarmTaskSelection(pausedFirst.game, "t2");
    expect(result.type).toBe("activate");
    if (result.type !== "activate") {
      return;
    }

    const activated = activateTask(pausedFirst.game, result.task.id);
    expect(activated.ok).toBe(true);
    if (!activated.ok) {
      return;
    }

    expect(activated.game.activeTaskId).toBe("t2");
  });

  it("activeTaskId remains single when opening an already active monster", () => {
    const first = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Task A", []);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const result = resolveFarmTaskSelection(first.game, "t1");
    expect(result.type).toBe("open-active");
    expect(first.game.activeTaskId).toBe("t1");
  });
});
