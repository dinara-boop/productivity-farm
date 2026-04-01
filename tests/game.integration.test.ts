import { describe, expect, it } from "vitest";
import { applyTick, INITIAL_STATE } from "../src/lib/tracker";
import {
  EMPTY_GAME_STATE,
  EMPTY_REWARD_STATE,
  applyFocusRewards,
  completeTask,
  createTask,
  derivePaused,
  syncActiveTaskFromTracker
} from "../src/lib/game";

describe("critical path integration", () => {
  it("good site grows monster", () => {
    const task = createTask("t1", "Подготовить презентацию", []);
    let game = { ...EMPTY_GAME_STATE, tasks: [task], activeTaskId: task.id };

    const tracker = applyTick(INITIAL_STATE, "good", 45 * 60 * 1000);
    game = syncActiveTaskFromTracker(game, tracker);

    expect(game.tasks[0].growthUnits).toBe(1);
    expect(game.tasks[0].stage).toBe(2);
  });

  it("bad site worsens monster mood", () => {
    const task = createTask("t1", "Task", []);
    let game = { ...EMPTY_GAME_STATE, tasks: [task], activeTaskId: task.id };

    const tracker = applyTick(INITIAL_STATE, "bad", 20 * 60 * 1000);
    game = syncActiveTaskFromTracker(game, tracker);

    expect(game.tasks[0].mood).toBe("sick");
  });

  it("idle sets paused state", () => {
    expect(derivePaused(false, "idle", true)).toBe(true);
    expect(derivePaused(false, "active", true)).toBe(false);
  });

  it("task can be completed correctly", () => {
    const task = createTask("t1", "Task", ["a", "b"]);
    let game = { ...EMPTY_GAME_STATE, tasks: [task], activeTaskId: task.id };

    game.tasks[0].microtasks[0].done = true;
    game.tasks[0].microtasks[1].done = true;
    game = completeTask(game, task.id);

    expect(game.tasks[0].completed).toBe(true);
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
