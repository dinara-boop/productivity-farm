import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EMPTY_GAME_STATE, activateTask, createAndActivateTask, pauseActiveTask } from "../src/lib/game";
import { MONSTER_HATCH_MS, MONSTER_IMAGE_MAP } from "../src/lib/monster";
import { getPopupViewModel, type PopupStatusResponse } from "../src/lib/popup";

function createStatus(status: PopupStatusResponse): PopupStatusResponse {
  return status;
}

describe("popup view model", () => {
  it('without active task and last focused task shows only "Перейти в ферму"', () => {
    const view = getPopupViewModel(
      createStatus({
        gameState: {
          activeTaskId: null,
          tasks: []
        },
        popupContext: {
          lastFocusedTaskId: null,
          elapsedMsByTaskId: {},
          activeStartedAt: null
        }
      })
    );

    expect(view.mode).toBe("empty");
    expect(view.popupTitle).toBe("Ферма продуктивности");
    expect(view.showTaskCard).toBe(false);
    expect(view.openFarmButtonText).toBe("Перейти в ферму");
    expect(view.taskActionButtonText).toBeNull();
    expect(view.taskTitle).toBeNull();
    expect(view.monsterImageSrc).toBeNull();
    expect(view.monsterVisualStage).toBeNull();
    expect(view.monsterMood).toBeNull();
    expect(view.elapsedText).toBeNull();
  });

  it("with active task shows the egg sprite, title, state, timer and pause button", () => {
    const created = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Активная задача", []);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const view = getPopupViewModel(
      createStatus({
        gameState: {
          activeTaskId: created.game.activeTaskId,
          tasks: created.game.tasks
        },
        popupContext: {
          lastFocusedTaskId: "t1",
          elapsedMsByTaskId: { t1: 90_000 },
          activeStartedAt: 10_000
        }
      }),
      70_000
    );

    expect(view.mode).toBe("active");
    expect(view.showTaskCard).toBe(true);
    expect(view.taskTitle).toBe("Активная задача");
    expect(view.taskActionButtonText).toBe("Поставить на паузу");
    expect(view.monsterImageSrc).toBe(MONSTER_IMAGE_MAP.normal[0]);
    expect(view.monsterVisualStage).toBe(0);
    expect(view.monsterMood).toBe("normal");
    expect(view.monsterStateText).toBe("Состояние монстрика: Нормальное");
    expect(view.elapsedText).toBe("Прошло: 00:02:30");
  });

  it("after 10 seconds of active time uses the stage 1 sprite", () => {
    const created = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Задача", []);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    created.game.tasks[0].activeElapsedMs = MONSTER_HATCH_MS;

    const view = getPopupViewModel(
      createStatus({
        gameState: {
          activeTaskId: created.game.activeTaskId,
          tasks: created.game.tasks
        },
        popupContext: {
          lastFocusedTaskId: "t1",
          elapsedMsByTaskId: { t1: MONSTER_HATCH_MS },
          activeStartedAt: null
        }
      }),
      MONSTER_HATCH_MS
    );

    expect(view.mode).toBe("active");
    expect(view.monsterImageSrc).toBe(MONSTER_IMAGE_MAP.normal[1]);
    expect(view.monsterVisualStage).toBe(1);
  });

  it("after pause keeps the task card visible and freezes the timer", () => {
    const created = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Задача", []);
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

    const view = getPopupViewModel(
      createStatus({
        gameState: {
          activeTaskId: paused.game.activeTaskId,
          tasks: paused.game.tasks
        },
        popupContext: {
          lastFocusedTaskId: "t1",
          elapsedMsByTaskId: { t1: 150_000 },
          activeStartedAt: null
        }
      }),
      999_000
    );

    expect(view.mode).toBe("paused");
    expect(view.showTaskCard).toBe(true);
    expect(view.taskTitle).toBe("Задача");
    expect(view.taskActionButtonText).toBe("Возобновить задачу");
    expect(view.monsterImageSrc).toBe(MONSTER_IMAGE_MAP.normal[0]);
    expect(view.elapsedText).toBe("Прошло: 00:02:30");
  });

  it("after resume makes the same task active again and continues the timer", () => {
    const created = createAndActivateTask(EMPTY_GAME_STATE, "t1", "Задача", []);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const paused = pauseActiveTask(created.game);
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

    const view = getPopupViewModel(
      createStatus({
        gameState: {
          activeTaskId: resumed.game.activeTaskId,
          tasks: resumed.game.tasks
        },
        popupContext: {
          lastFocusedTaskId: "t1",
          elapsedMsByTaskId: { t1: 150_000 },
          activeStartedAt: 100_000
        }
      }),
      190_000
    );

    expect(view.mode).toBe("active");
    expect(view.taskActionButtonText).toBe("Поставить на паузу");
    expect(view.elapsedText).toBe("Прошло: 00:04:00");
  });

  it('popup title is "Ферма продуктивности" and popup.html renders an animated host instead of emoji', () => {
    const html = readFileSync(new URL("../src/popup.html", import.meta.url), "utf8");
    const view = getPopupViewModel(createStatus({}));

    expect(view.popupTitle).toBe("Ферма продуктивности");
    expect(html).toContain("<title>Ферма продуктивности</title>");
    expect(html).not.toContain("Активная задача");
    expect(html).toContain('id="monsterImageHost"');
    expect(html).toContain(".monster-transition__layer--stage-enter");
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).not.toContain('id="monsterEmoji"');
    expect(html).not.toContain("monster-emoji");
  });
});
