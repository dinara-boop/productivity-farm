import { describe, expect, it } from "vitest";
import {
  MONSTER_OVERLAY_ROOT_ID,
  MONSTER_OVERLAY_STYLE_TEXT,
  createOverlayMarkup
} from "../src/lib/overlay-renderer";

describe("monster overlay renderer", () => {
  it("renders positive markup with the monster asset and friendly animation classes", () => {
    const markup = createOverlayMarkup(
      {
        kind: "positive",
        message: "Ты такой молодец!"
      },
      "chrome-extension://test/assets/monster-overlay.png"
    );

    expect(markup).toContain('monster-overlay-notification--positive');
    expect(markup).toContain('monster-overlay-monster--positive');
    expect(markup).toContain('monster-overlay-sparkles');
    expect(markup).toContain('assets/monster-overlay.png');
  });

  it("renders negative markup with the sad tone and keeps the shared root id stable", () => {
    const markup = createOverlayMarkup(
      {
        kind: "negative",
        message: "Мне тут не нравится🥺"
      },
      "chrome-extension://test/assets/monster-overlay.png"
    );

    expect(MONSTER_OVERLAY_ROOT_ID).toBe("monster-overlay-root");
    expect(markup).toContain('monster-overlay-notification--negative');
    expect(markup).toContain('monster-overlay-monster--negative');
    expect(markup).not.toContain('monster-overlay-sparkles');
  });

  it("includes sway animation, bottom-center origin, reduced-motion fallback, and fixed overlay positioning", () => {
    expect(MONSTER_OVERLAY_STYLE_TEXT).toContain("@keyframes monster-overlay-sway");
    expect(MONSTER_OVERLAY_STYLE_TEXT).toContain("transform-origin: 50% 100%");
    expect(MONSTER_OVERLAY_STYLE_TEXT).toContain("prefers-reduced-motion: reduce");
    expect(MONSTER_OVERLAY_STYLE_TEXT).toContain("position: fixed");
    expect(MONSTER_OVERLAY_STYLE_TEXT).toContain("pointer-events: none");
    expect(MONSTER_OVERLAY_STYLE_TEXT).toContain("z-index: 999999");
  });
});
