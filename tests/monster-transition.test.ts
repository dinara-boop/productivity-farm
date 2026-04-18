import { describe, expect, it } from "vitest";
import {
  resolveMonsterTransitionKind,
  resolveMonsterTransitionMode,
  type MonsterTransitionSnapshot
} from "../src/lib/monster-transition";

const stage1Normal: MonsterTransitionSnapshot = {
  stage: 1,
  mood: "normal",
  imageSrc: "./stage-1.png",
  alt: "Task"
};

describe("monster transition helper", () => {
  it("returns stage transition when the stage actually changes", () => {
    expect(
      resolveMonsterTransitionKind(stage1Normal, {
        ...stage1Normal,
        stage: 2,
        imageSrc: "./stage-2.png"
      })
    ).toBe("stage");
  });

  it("does not animate when the stage and image stay the same", () => {
    expect(resolveMonsterTransitionKind(stage1Normal, { ...stage1Normal })).toBe("none");
  });

  it("uses a short state fade when mood/image changes without a stage change", () => {
    expect(
      resolveMonsterTransitionKind(stage1Normal, {
        ...stage1Normal,
        mood: "sad",
        imageSrc: "./stage-1-sad.png"
      })
    ).toBe("state");
  });

  it("prioritizes dead-state fades over stage pop transitions", () => {
    expect(
      resolveMonsterTransitionKind(stage1Normal, {
        ...stage1Normal,
        stage: 2,
        mood: "dead",
        imageSrc: "./dead.png"
      })
    ).toBe("state");
  });

  it("switches to reduced mode when prefers-reduced-motion is enabled", () => {
    expect(resolveMonsterTransitionMode(true)).toBe("reduced");
    expect(resolveMonsterTransitionMode(false)).toBe("full");
  });
});
