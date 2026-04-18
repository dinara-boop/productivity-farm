import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MonsterOverlayScheduler,
  OVERLAY_DISPLAY_MS,
  OVERLAY_MESSAGES,
  OVERLAY_REPEAT_MS
} from "../src/lib/overlay-scheduler";

describe("monster overlay scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a negative notification immediately and repeats every minute on bad sites", () => {
    const show = vi.fn();
    const hide = vi.fn();
    const scheduler = new MonsterOverlayScheduler({ show, hide });

    scheduler.updateContext("youtube.com", "bad");

    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenLastCalledWith({
      kind: "negative",
      message: OVERLAY_MESSAGES.negative
    });

    vi.advanceTimersByTime(OVERLAY_DISPLAY_MS);
    expect(hide).toHaveBeenCalled();

    vi.advanceTimersByTime(OVERLAY_REPEAT_MS - OVERLAY_DISPLAY_MS);
    expect(show).toHaveBeenCalledTimes(2);
    expect(show).toHaveBeenLastCalledWith({
      kind: "negative",
      message: OVERLAY_MESSAGES.negative
    });

    scheduler.dispose();
  });

  it("waits one minute before the first positive notification and keeps repeating", () => {
    const show = vi.fn();
    const scheduler = new MonsterOverlayScheduler({
      show,
      hide: vi.fn()
    });

    scheduler.updateContext("docs.google.com", "good");

    vi.advanceTimersByTime(OVERLAY_REPEAT_MS - 1);
    expect(show).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenLastCalledWith({
      kind: "positive",
      message: OVERLAY_MESSAGES.positive
    });

    vi.advanceTimersByTime(OVERLAY_REPEAT_MS);
    expect(show).toHaveBeenCalledTimes(2);

    scheduler.dispose();
  });

  it("resets pending good timers on site changes and gives negative notifications priority", () => {
    const show = vi.fn();
    const scheduler = new MonsterOverlayScheduler({
      show,
      hide: vi.fn()
    });

    scheduler.updateContext("docs.google.com", "good");
    vi.advanceTimersByTime(OVERLAY_REPEAT_MS);
    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenLastCalledWith({
      kind: "positive",
      message: OVERLAY_MESSAGES.positive
    });

    scheduler.updateContext("youtube.com", "bad");
    expect(show).toHaveBeenCalledTimes(2);
    expect(show).toHaveBeenLastCalledWith({
      kind: "negative",
      message: OVERLAY_MESSAGES.negative
    });

    vi.advanceTimersByTime(OVERLAY_REPEAT_MS);
    expect(show).toHaveBeenCalledTimes(3);
    expect(show.mock.calls.every(([notification]) => notification.kind !== undefined)).toBe(true);

    scheduler.dispose();
  });

  it("cancels scheduled notifications when the overlay context becomes neutral", () => {
    const show = vi.fn();
    const scheduler = new MonsterOverlayScheduler({
      show,
      hide: vi.fn()
    });

    scheduler.updateContext("docs.google.com", "good");
    vi.advanceTimersByTime(30_000);
    scheduler.updateContext(null, "neutral");
    vi.advanceTimersByTime(OVERLAY_REPEAT_MS);

    expect(show).not.toHaveBeenCalled();

    scheduler.dispose();
  });
});
