import { describe, expect, it } from "vitest";
import {
  MAX_FIELDS,
  SLOTS_PER_FIELD,
  createFarmFieldSlots,
  getFarmFieldName,
  getFarmNavigationState,
  getFarmStatusLabel
} from "../src/lib/farm-fields";

describe("farm field slots", () => {
  it("always renders exactly 4 slots for a field", () => {
    const slots = createFarmFieldSlots([], 0);

    expect(slots).toHaveLength(SLOTS_PER_FIELD);
    expect(slots.every((slot) => slot.fieldIndex === 0)).toBe(true);
  });

  it("with 0 tasks shows 4 empty slots", () => {
    const slots = createFarmFieldSlots([], 0);

    expect(slots.every((slot) => slot.task === null)).toBe(true);
  });

  it("with 1-3 tasks leaves the rest of slots empty", () => {
    const slots = createFarmFieldSlots(
      [
        { id: "t1", status: "active" as const, fieldIndex: 0, slotIndex: 0 },
        { id: "t2", status: "paused" as const, fieldIndex: 0, slotIndex: 2 }
      ],
      0
    );

    expect(slots.map((slot) => slot.task?.id ?? null)).toEqual(["t1", null, "t2", null]);
  });

  it("with 4 tasks fills the whole field", () => {
    const slots = createFarmFieldSlots(
      Array.from({ length: 4 }, (_, slotIndex) => ({
        id: `t${slotIndex + 1}`,
        status: "paused" as const,
        fieldIndex: 0,
        slotIndex
      })),
      0
    );

    expect(slots.every((slot) => slot.task !== null)).toBe(true);
  });

  it("maps task statuses to visible russian labels", () => {
    expect(getFarmStatusLabel("active")).toBe("активная");
    expect(getFarmStatusLabel("paused")).toBe("на паузе");
    expect(getFarmStatusLabel("completed")).toBe("завершена");
  });

  it("uses exactly three named farm fields in the requested order", () => {
    expect(MAX_FIELDS).toBe(3);
    expect([0, 1, 2].map((fieldIndex) => getFarmFieldName(fieldIndex))).toEqual([
      "Цветочный сад",
      "Северный луг",
      "Кристалльное поле"
    ]);
  });

  it("navigation is disabled on field boundaries", () => {
    expect(getFarmNavigationState(0)).toEqual({ canGoPrev: false, canGoNext: true });
    expect(getFarmNavigationState(MAX_FIELDS - 1)).toEqual({ canGoPrev: true, canGoNext: false });
    expect(getFarmNavigationState(1)).toEqual({ canGoPrev: true, canGoNext: true });
  });
});
