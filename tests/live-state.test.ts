import { describe, expect, it } from "vitest";
import { advanceLiveState } from "../src/lib/live-state";
import { EMPTY_GAME_STATE, EMPTY_REWARD_STATE, createAndActivateTask } from "../src/lib/game";
import { MONSTER_HATCH_MS, MONSTER_IMAGE_MAP, resolveMonsterImage } from "../src/lib/monster";
import { INITIAL_STATE } from "../src/lib/tracker";

function createActiveTaskSnapshot() {
  const created = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Task", []);
  expect(created.ok).toBe(true);
  if (!created.ok) {
    throw new Error("Expected active task to be created");
  }

  return {
    gameState: created.game,
    trackerState: { ...INITIAL_STATE, paused: false },
    rewardState: { ...EMPTY_REWARD_STATE }
  };
}

describe("live state advancement", () => {
  it("shows the egg image immediately after creation", () => {
    const snapshot = createActiveTaskSnapshot();
    const task = snapshot.gameState.tasks[0];

    expect(task.activeElapsedMs).toBe(0);
    expect(resolveMonsterImage(task)).toBe(MONSTER_IMAGE_MAP.normal[0]);
  });

  it("after 10 seconds of active time switches from egg to stage 1", () => {
    const snapshot = createActiveTaskSnapshot();

    const next = advanceLiveState(snapshot.gameState, snapshot.trackerState, snapshot.rewardState, "neutral", MONSTER_HATCH_MS);
    const task = next.gameState.tasks[0];

    expect(task.activeElapsedMs).toBe(MONSTER_HATCH_MS);
    expect(task.stage).toBe(1);
    expect(resolveMonsterImage(task)).toBe(MONSTER_IMAGE_MAP.normal[1]);
  });

  it("good 2 minutes advances stage and changes the normal PNG", () => {
    const snapshot = createActiveTaskSnapshot();
    const beforeTask = snapshot.gameState.tasks[0];
    const beforeImage = resolveMonsterImage(beforeTask);

    const next = advanceLiveState(
      snapshot.gameState,
      snapshot.trackerState,
      snapshot.rewardState,
      "good",
      2 * 60 * 1000
    );

    const task = next.gameState.tasks[0];
    expect(task.growthUnits).toBe(1);
    expect(task.stage).toBe(2);
    expect(resolveMonsterImage(task)).toBe(MONSTER_IMAGE_MAP.normal[2]);
    expect(resolveMonsterImage(task)).not.toBe(beforeImage);
  });

  it("bad domain applies the sad image immediately for visual updates", () => {
    const snapshot = createActiveTaskSnapshot();

    const next = advanceLiveState(snapshot.gameState, snapshot.trackerState, snapshot.rewardState, "bad", MONSTER_HATCH_MS);
    const task = next.gameState.tasks[0];

    expect(task.mood).toBe("sad");
    expect(resolveMonsterImage(task)).toBe(MONSTER_IMAGE_MAP.sad[1]);
  });

  it("bad 1 minute keeps the sick gameplay state but uses the sad stage sprite", () => {
    const snapshot = createActiveTaskSnapshot();

    const next = advanceLiveState(
      snapshot.gameState,
      snapshot.trackerState,
      snapshot.rewardState,
      "bad",
      1 * 60 * 1000
    );
    const task = next.gameState.tasks[0];

    expect(task.mood).toBe("sick");
    expect(resolveMonsterImage(task)).toBe(MONSTER_IMAGE_MAP.sad[1]);
  });

  it("bad 2 minutes shows the dead sprite", () => {
    const snapshot = createActiveTaskSnapshot();

    const next = advanceLiveState(
      snapshot.gameState,
      snapshot.trackerState,
      snapshot.rewardState,
      "bad",
      2 * 60 * 1000
    );
    const task = next.gameState.tasks[0];

    expect(task.mood).toBe("dead");
    expect(resolveMonsterImage(task)).toBe(MONSTER_IMAGE_MAP.dead);
  });

  it("switching back to good restores the normal stage sprite from sick state", () => {
    const snapshot = createActiveTaskSnapshot();

    const grown = advanceLiveState(
      snapshot.gameState,
      snapshot.trackerState,
      snapshot.rewardState,
      "good",
      2 * 60 * 1000
    );
    const sick = advanceLiveState(grown.gameState, grown.trackerState, grown.rewardState, "bad", 1 * 60 * 1000);
    const recovered = advanceLiveState(sick.gameState, sick.trackerState, sick.rewardState, "good", 0);
    const task = recovered.gameState.tasks[0];

    expect(task.stage).toBe(2);
    expect(task.mood).toBe("normal");
    expect(resolveMonsterImage(task)).toBe(MONSTER_IMAGE_MAP.normal[2]);
  });

  it("returns a fresh snapshot on every polling step without manual refresh semantics", () => {
    const snapshot = createActiveTaskSnapshot();

    const afterGrowth = advanceLiveState(
      snapshot.gameState,
      snapshot.trackerState,
      snapshot.rewardState,
      "good",
      2 * 60 * 1000
    );
    const afterBad = advanceLiveState(afterGrowth.gameState, afterGrowth.trackerState, afterGrowth.rewardState, "bad", 0);

    expect(afterGrowth.gameState.tasks[0].stage).toBe(2);
    expect(resolveMonsterImage(afterGrowth.gameState.tasks[0])).toBe(MONSTER_IMAGE_MAP.normal[2]);
    expect(afterBad.gameState.tasks[0].mood).toBe("sad");
    expect(resolveMonsterImage(afterBad.gameState.tasks[0])).toBe(MONSTER_IMAGE_MAP.sad[2]);
  });
});
