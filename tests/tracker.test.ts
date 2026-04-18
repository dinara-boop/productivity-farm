import { describe, expect, it } from "vitest";
import {
  INITIAL_STATE,
  applyTick,
  classifyDomain,
  extractDomain,
  growthToStage,
  resetDeadMonster,
  shouldPreserveTrackingForUrl
} from "../src/lib/tracker";

describe("tracker domain helpers", () => {
  it("extracts domain from valid url", () => {
    expect(extractDomain("https://docs.google.com/document/d/123")).toBe("docs.google.com");
  });

  it("returns null for invalid url", () => {
    expect(extractDomain("chrome://extensions")).toBeNull();
  });

  it("keeps tracking context on extension and browser internal pages", () => {
    expect(shouldPreserveTrackingForUrl("chrome-extension://abc123/farm.html")).toBe(true);
    expect(shouldPreserveTrackingForUrl("chrome://extensions")).toBe(true);
    expect(shouldPreserveTrackingForUrl("edge://extensions")).toBe(true);
    expect(shouldPreserveTrackingForUrl("about:blank")).toBe(true);
    expect(shouldPreserveTrackingForUrl("https://example.com")).toBe(false);
  });

  it("classifies domain as good, bad or neutral", () => {
    const lists = { good: ["docs.google.com"], bad: ["youtube.com"] };
    expect(classifyDomain("docs.google.com", lists)).toBe("good");
    expect(classifyDomain("youtube.com", lists)).toBe("bad");
    expect(classifyDomain("www.youtube.com", lists)).toBe("bad");
    expect(classifyDomain("example.com", lists)).toBe("neutral");
  });
});

describe("tracker state machine", () => {
  it("adds growth unit every 2 minutes on good domain", () => {
    const next = applyTick(INITIAL_STATE, "good", 2 * 60 * 1000);
    expect(next.growthUnits).toBe(1);
    expect(next.activeElapsedMs).toBe(2 * 60 * 1000);
    expect(next.mood).toBe("normal");
  });

  it("becomes sad immediately, sick after 1 min and dead after 2 min of continuous bad domain", () => {
    const sad = applyTick(INITIAL_STATE, "bad", 0);
    expect(sad.mood).toBe("sad");

    const sick = applyTick(INITIAL_STATE, "bad", 1 * 60 * 1000);
    expect(sick.mood).toBe("sick");

    const dead = applyTick(INITIAL_STATE, "bad", 2 * 60 * 1000);
    expect(dead.mood).toBe("dead");
  });

  it("returns to normal mood immediately on non-bad domain unless already dead", () => {
    const sick = applyTick(INITIAL_STATE, "bad", 1 * 60 * 1000);
    const recovered = applyTick(sick, "good", 0);
    const dead = applyTick(INITIAL_STATE, "bad", 2 * 60 * 1000);
    const deadOnNeutral = applyTick(dead, "neutral", 0);

    expect(recovered.mood).toBe("normal");
    expect(recovered.badContinuousMs).toBe(0);
    expect(deadOnNeutral.mood).toBe("dead");
  });

  it("accumulates continuous bad time across multiple ticks", () => {
    const sad = applyTick(INITIAL_STATE, "bad", 10 * 1000);
    expect(sad.mood).toBe("sad");

    const sick = applyTick(sad, "bad", 50 * 1000);
    expect(sick.badContinuousMs).toBe(60 * 1000);
    expect(sick.mood).toBe("sick");

    const dead = applyTick(sick, "bad", 60 * 1000);
    expect(dead.badContinuousMs).toBe(2 * 60 * 1000);
    expect(dead.mood).toBe("dead");
  });

  it("resets dead monster to initial progression", () => {
    const dead = applyTick(INITIAL_STATE, "bad", 2 * 60 * 1000);
    const revived = resetDeadMonster(dead);
    expect(revived.mood).toBe("normal");
    expect(revived.growthUnits).toBe(0);
    expect(revived.goodMs).toBe(0);
    expect(revived.activeElapsedMs).toBe(0);
  });

  it("does not progress while paused", () => {
    const paused = { ...INITIAL_STATE, paused: true };
    const next = applyTick(paused, "good", 2 * 60 * 1000);
    expect(next.growthUnits).toBe(0);
    expect(next.goodMs).toBe(0);
    expect(next.activeElapsedMs).toBe(0);
  });

  it("maps growth units to 4 monster stages", () => {
    expect(growthToStage(0)).toBe(1);
    expect(growthToStage(1)).toBe(2);
    expect(growthToStage(2)).toBe(3);
    expect(growthToStage(3)).toBe(4);
    expect(growthToStage(7)).toBe(4);
  });
});
