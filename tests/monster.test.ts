import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MONSTER_HATCH_MS,
  MONSTER_IMAGE_FALLBACK,
  MONSTER_IMAGE_MAP,
  resolveMonsterImage,
  resolveMonsterStage
} from "../src/lib/monster";

describe("monster image mapping", () => {
  it("maps each normal growth stage to its own PNG", () => {
    expect(resolveMonsterImage({ stage: 0, mood: "normal", activeElapsedMs: 0 })).toBe(MONSTER_IMAGE_MAP.normal[0]);
    expect(resolveMonsterImage({ stage: 1, mood: "normal", activeElapsedMs: MONSTER_HATCH_MS })).toBe(
      MONSTER_IMAGE_MAP.normal[1]
    );
    expect(resolveMonsterImage({ stage: 2, mood: "normal", activeElapsedMs: MONSTER_HATCH_MS })).toBe(
      MONSTER_IMAGE_MAP.normal[2]
    );
    expect(resolveMonsterImage({ stage: 3, mood: "normal", activeElapsedMs: MONSTER_HATCH_MS })).toBe(
      MONSTER_IMAGE_MAP.normal[3]
    );
    expect(resolveMonsterImage({ stage: 4, mood: "normal", activeElapsedMs: MONSTER_HATCH_MS })).toBe(
      MONSTER_IMAGE_MAP.normal[4]
    );
  });

  it("keeps the egg only during the first 10 seconds after launch", () => {
    expect(resolveMonsterStage({ stage: 1, mood: "normal", activeElapsedMs: 0 })).toBe(0);
    expect(resolveMonsterImage({ stage: 1, mood: "normal", activeElapsedMs: 0 })).toBe(MONSTER_IMAGE_MAP.normal[0]);
    expect(resolveMonsterStage({ stage: 1, mood: "normal", activeElapsedMs: MONSTER_HATCH_MS })).toBe(1);
    expect(resolveMonsterImage({ stage: 1, mood: "normal", activeElapsedMs: MONSTER_HATCH_MS })).toBe(
      MONSTER_IMAGE_MAP.normal[1]
    );
  });

  it("uses stage-based sad PNGs for sad and sick moods", () => {
    expect(resolveMonsterImage({ stage: 1, mood: "sad", activeElapsedMs: MONSTER_HATCH_MS })).toBe(
      MONSTER_IMAGE_MAP.sad[1]
    );
    expect(resolveMonsterImage({ stage: 3, mood: "sad", activeElapsedMs: MONSTER_HATCH_MS })).toBe(
      MONSTER_IMAGE_MAP.sad[3]
    );
    expect(resolveMonsterImage({ stage: 4, mood: "sick", activeElapsedMs: MONSTER_HATCH_MS })).toBe(
      MONSTER_IMAGE_MAP.sad[4]
    );
  });

  it("always prioritizes the dead PNG over stage and mood", () => {
    expect(resolveMonsterImage({ stage: 4, mood: "dead", activeElapsedMs: MONSTER_HATCH_MS })).toBe(
      MONSTER_IMAGE_MAP.dead
    );
    expect(resolveMonsterImage({ stage: 1, mood: "dead", activeElapsedMs: 0 })).toBe(MONSTER_IMAGE_MAP.dead);
  });

  it("falls back to a safe normal sprite for unsupported input", () => {
    expect(resolveMonsterImage({ stage: Number.NaN, mood: "unknown", activeElapsedMs: Number.NaN })).toBe(
      MONSTER_IMAGE_FALLBACK
    );
  });

  it("farm and popup import the same resolver", () => {
    const farmTs = readFileSync(new URL("../src/farm.ts", import.meta.url), "utf8");
    const popupLibTs = readFileSync(new URL("../src/lib/popup.ts", import.meta.url), "utf8");
    const popupTs = readFileSync(new URL("../src/popup.ts", import.meta.url), "utf8");
    const transitionTs = readFileSync(new URL("../src/lib/monster-transition.ts", import.meta.url), "utf8");

    expect(farmTs).toContain('resolveMonsterImage, resolveMonsterStage } from "./lib/monster.js"');
    expect(farmTs).toContain("renderMonsterTransition({");
    expect(farmTs).not.toContain("getMonsterEmoji");
    expect(popupLibTs).toContain('resolveMonsterImage, resolveMonsterStage } from "./monster.js"');
    expect(popupLibTs).toContain("monsterImageSrc: resolveMonsterImage(task)");
    expect(popupTs).toContain("renderMonsterTransition({");
    expect(popupTs).toContain('document.getElementById("monsterImageHost")');
    expect(popupTs).not.toContain('document.getElementById("monsterEmoji")');
    expect(transitionTs).toContain('export function resolveMonsterTransitionKind');
  });
});
