import { describe, expect, it } from "vitest";
import { createFarmFieldSlots } from "../src/lib/farm-fields";
import { applyTick, INITIAL_STATE } from "../src/lib/tracker";
import {
  EMPTY_GAME_STATE,
  EMPTY_REWARD_STATE,
  activateTask,
  applyFocusRewards,
  completeTask,
  createAndActivateTask,
  createTask,
  derivePaused,
  getResumableTasks,
  pauseActiveTask,
  pauseTask,
  syncActiveTaskFromTracker
} from "../src/lib/game";

describe("critical path integration", () => {
  it("good site grows only the active monster", () => {
    const created = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Подготовить презентацию", []);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    let game = created.game;
    const tracker = applyTick(INITIAL_STATE, "good", 2 * 60 * 1000);
    game = syncActiveTaskFromTracker(game, tracker);

    expect(game.tasks[0].growthUnits).toBe(1);
    expect(game.tasks[0].stage).toBe(2);
    expect(game.tasks[0].status).toBe("active");
  });

  it("bad site worsens active monster mood", () => {
    const created = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Task", []);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    let game = created.game;
    const tracker = applyTick(INITIAL_STATE, "bad", 1 * 60 * 1000);
    game = syncActiveTaskFromTracker(game, tracker);

    expect(game.tasks[0].mood).toBe("sick");
  });

  it("create + save makes the task active", () => {
    const result = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Task", ["a"]);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.game.activeTaskId).toBe("t1");
    expect(result.task.status).toBe("active");
  });

  it("create + save can place the task into the selected empty slot", () => {
    const result = createAndActivateTask(
      EMPTY_GAME_STATE,
      "t1",
      "Task",
      ["a"],
      { fieldIndex: 2, slotIndex: 3 }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.game.activeTaskId).toBe("t1");
    expect(result.task.fieldIndex).toBe(2);
    expect(result.task.slotIndex).toBe(3);
  });

  it("saved task is rendered in the same chosen slot", () => {
    const result = createAndActivateTask(
      EMPTY_GAME_STATE,
      "t1",
      "Task",
      [],
      { fieldIndex: 1, slotIndex: 2 }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const slots = createFarmFieldSlots(result.game.tasks, 1);

    expect(slots[2].task?.id).toBe("t1");
    expect(slots.filter((slot) => slot.task !== null)).toHaveLength(1);
  });

  it("does not reallocate a task when the chosen slot is already occupied", () => {
    const first = createAndActivateTask(
      EMPTY_GAME_STATE,
      "t1",
      "Task",
      [],
      { fieldIndex: 1, slotIndex: 2 }
    );
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const paused = pauseActiveTask(first.game);
    expect(paused.ok).toBe(true);
    if (!paused.ok) {
      return;
    }

    const second = createAndActivateTask(
      paused.game,
      "t2",
      "Task 2",
      [],
      { fieldIndex: 1, slotIndex: 2 }
    );

    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }

    expect(second.error).toBe("task-slot-unavailable");
  });

  it("pause active task clears activeTaskId", () => {
    const created = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Task", []);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const paused = pauseTask(created.game, "t1");

    expect(paused.ok).toBe(true);
    if (!paused.ok) {
      return;
    }

    expect(paused.game.activeTaskId).toBeNull();
    expect(paused.task.status).toBe("paused");
  });

  it('active task + "go home" pauses the task and clears activeTaskId', () => {
    const created = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Task", []);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const paused = pauseActiveTask(created.game);

    expect(paused.ok).toBe(true);
    if (!paused.ok) {
      return;
    }

    expect(paused.game.activeTaskId).toBeNull();
    expect(paused.task.status).toBe("paused");
  });

  it("resume paused task makes it active again", () => {
    const created = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Task", []);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const paused = pauseTask(created.game, "t1");
    expect(paused.ok).toBe(true);
    if (!paused.ok) {
      return;
    }

    const resumed = activateTask(paused.game, "t1");

    expect(resumed.ok).toBe(true);
    if (!resumed.ok) {
      return;
    }

    expect(resumed.game.activeTaskId).toBe("t1");
    expect(resumed.task.status).toBe("active");
  });

  it("cannot activate a second task while another one is active", () => {
    const first = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Task A", []);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const secondTask = createTask("t2", "Task B", []);
    const gameWithSecondTask = {
      ...first.game,
      tasks: [...first.game.tasks, secondTask]
    };

    const result = activateTask(gameWithSecondTask, "t2");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toBe("active-task-exists");
  });

  it("cannot create a second active task even when a target slot is provided", () => {
    const first = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Task A", []);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = createAndActivateTask(
      first.game,
      "t2",
      "Task B",
      [],
      { fieldIndex: 0, slotIndex: 1 }
    );

    expect(second.ok).toBe(false);
    if (second.ok) {
      return;
    }

    expect(second.error).toBe("active-task-exists");
  });

  it("completed task does not appear in continue list", () => {
    const pausedTask = createTask("paused-1", "Paused task", [], "paused");
    const active = createAndActivateTask(
      {
        ...EMPTY_GAME_STATE,
        tasks: [pausedTask]
      },
      "active-1",
      "Active task",
      []
    );
    expect(active.ok).toBe(true);
    if (!active.ok) {
      return;
    }

    const completed = completeTask(active.game, "active-1");

    expect(getResumableTasks(completed).map((task) => task.id)).toEqual(["paused-1"]);

    const activation = activateTask(completed, "active-1");
    expect(activation.ok).toBe(false);
    if (activation.ok) {
      return;
    }

    expect(activation.error).toBe("task-completed");
  });

  it("idle or missing active task pauses tracking", () => {
    expect(derivePaused(false, "idle", true, true)).toBe(true);
    expect(derivePaused(false, "active", true, false)).toBe(true);
    expect(derivePaused(false, "active", true, true)).toBe(false);
  });

  it("task can be completed correctly", () => {
    const created = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Task", ["a", "b"]);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    let game = created.game;
    game.tasks[0].microtasks[0].done = true;
    game.tasks[0].microtasks[1].done = true;
    game = completeTask(game, "t1");

    expect(game.tasks[0].status).toBe("completed");
    expect(game.tasks[0].stage).toBe(4);
    expect(game.points).toBe(50);
    expect(game.activeTaskId).toBeNull();
  });

  it("achievement is awarded for 10 minutes uninterrupted focus", () => {
    const game = { ...EMPTY_GAME_STATE, points: 0 };
    const rewards = { ...EMPTY_REWARD_STATE };

    const result = applyFocusRewards(game, rewards, true, 10 * 60 * 1000);

    expect(result.game.achievements.focus10Count).toBe(1);
    expect(result.game.points).toBe(5);
  });
});
