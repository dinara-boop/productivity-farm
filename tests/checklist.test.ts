import { describe, expect, it } from "vitest";
import {
  createChecklistDraft,
  insertChecklistRowAfter,
  removeChecklistRow,
  sanitizeChecklistItems,
  updateChecklistDraftRow
} from "../src/lib/checklist";

function createIdFactory(): () => string {
  let counter = 0;
  return () => `row-${counter++}`;
}

describe("checklist helpers", () => {
  it("sanitizes empty checklist items before save", () => {
    expect(sanitizeChecklistItems(["  РџРµСЂРІС‹Р№  ", "", "   ", "Р’С‚РѕСЂРѕР№"])).toEqual([
      "РџРµСЂРІС‹Р№",
      "Р’С‚РѕСЂРѕР№"
    ]);
  });

  it("creates draft rows with trailing empty row", () => {
    const createId = createIdFactory();

    expect(createChecklistDraft([" РџРµСЂРІС‹Р№ ", "", "Р’С‚РѕСЂРѕР№"], createId)).toEqual([
      { id: "row-0", text: "РџРµСЂРІС‹Р№" },
      { id: "row-1", text: "Р’С‚РѕСЂРѕР№" },
      { id: "row-2", text: "" }
    ]);
  });

  it("adds a new empty row after a filled row on enter", () => {
    const createId = createIdFactory();
    const rows = [{ id: "row-0", text: "First" }];
    createId();

    expect(insertChecklistRowAfter(rows, "row-0", createId)).toEqual([
      { id: "row-0", text: "First" },
      { id: "row-1", text: "" }
    ]);
  });

  it("does not add duplicate empty row on enter", () => {
    const createId = createIdFactory();
    const rows = createChecklistDraft(["РџРµСЂРІС‹Р№"], createId);

    expect(insertChecklistRowAfter(rows, "row-0", createId)).toEqual(rows);
  });

  it("removes empty row and preserves one blank line", () => {
    const createId = createIdFactory();
    const rows = [
      { id: "row-0", text: "РџРµСЂРІС‹Р№" },
      { id: "row-1", text: "" }
    ];
    createId();
    createId();

    expect(removeChecklistRow(rows, "row-1", createId)).toEqual([
      { id: "row-0", text: "РџРµСЂРІС‹Р№" },
      { id: "row-2", text: "" }
    ]);
  });

  it("updates draft row text without altering others", () => {
    expect(
      updateChecklistDraftRow(
        [
          { id: "row-0", text: "РџРµСЂРІС‹Р№" },
          { id: "row-1", text: "" }
        ],
        "row-1",
        "Р’С‚РѕСЂРѕР№"
      )
    ).toEqual([
      { id: "row-0", text: "РџРµСЂРІС‹Р№" },
      { id: "row-1", text: "Р’С‚РѕСЂРѕР№" }
    ]);
  });
});
