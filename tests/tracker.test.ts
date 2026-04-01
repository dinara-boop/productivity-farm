import { describe, expect, it } from "vitest";
import {
  INITIAL_STATE,
  applyTick,
  classifyDomain,
  extractDomain,
  growthToStage,
  resetDeadMonster
} from "../src/lib/tracker";

describe("tracker domain helpers", () => {
  it("extracts domain from valid url", () => {
    expect(extractDomain("https://docs.google.com/document/d/123")).toBe("docs.google.com");
  });

  it("returns null for invalid url", () => {
    expect(extractDomain("chrome://extensions")).toBeNull();
  });

  it("classifies domain as good, bad or neutral", () => {
    const lists = { good: ["docs.google.com"], bad: ["youtube.com"] };
    expect(classifyDomain("docs.google.com", lists)).toBe("good");
    expect(classifyDomain("youtube.com", lists)).toBe("bad");
    expect(classifyDomain("example.com", lists)).toBe("neutral");
  });
});

describe("tracker state machine", () => {
  it("adds growth unit every 45 minutes on good domain", () => {
    const next = applyTick(INITIAL_STATE, "good", 45 * 60 * 1000);
    expect(next.growthUnits).toBe(1);
    expect(next.mood).toBe("normal");
  });

  it("becomes sick after 20 min and dead after 60 min of continuous bad domain", () => {
    const sick = applyTick(INITIAL_STATE, "bad", 20 * 60 * 1000);
    expect(sick.mood).toBe("sick");

    const dead = applyTick(INITIAL_STATE, "bad", 60 * 60 * 1000);
    expect(dead.mood).toBe("dead");
  });

  it("resets dead monster to initial progression", () => {
    const dead = applyTick(INITIAL_STATE, "bad", 60 * 60 * 1000);
    const revived = resetDeadMonster(dead);
    expect(revived.mood).toBe("normal");
    expect(revived.growthUnits).toBe(0);
    expect(revived.goodMs).toBe(0);
  });

  it("does not progress while paused", () => {
    const paused = { ...INITIAL_STATE, paused: true };
    const next = applyTick(paused, "good", 45 * 60 * 1000);
    expect(next.growthUnits).toBe(0);
    expect(next.goodMs).toBe(0);
  });

  it("maps growth units to 4 monster stages", () => {
    expect(growthToStage(0)).toBe(1);
    expect(growthToStage(1)).toBe(2);
    expect(growthToStage(2)).toBe(3);
    expect(growthToStage(3)).toBe(4);
    expect(growthToStage(7)).toBe(4);
  });
});
