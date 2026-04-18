import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const farmHtml = readFileSync(new URL("../src/farm.html", import.meta.url), "utf8");
const farmTs = readFileSync(new URL("../src/farm.ts", import.meta.url), "utf8");

describe("create task checklist modal", () => {
  it("does not render the removed checklist add button or preview block", () => {
    expect(farmHtml).not.toContain('id="addChecklistRowBtn"');
    expect(farmHtml).not.toContain('id="taskChecklistPreview"');
    expect(farmHtml).not.toContain('id="taskChecklistPreviewList"');
    expect(farmHtml).not.toContain("\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u0442\u0440\u043e\u043a\u0443");
    expect(farmHtml).not.toContain(
      "\u041f\u0440\u0435\u0434\u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0447\u0435\u043a-\u043b\u0438\u0441\u0442\u0430"
    );
  });

  it("keeps checklist editing driven by draft input rows", () => {
    expect(farmHtml).toContain('id="checklistDraftRows"');
    expect(farmTs).toContain('checkbox.disabled = true');
    expect(farmTs).toContain('if (event.key === "Enter")');
    expect(farmTs).toContain('event.key === "Backspace" || event.key === "Delete"');
    expect(farmTs).toContain("handleChecklistEnter(row.id)");
    expect(farmTs).toContain("handleChecklistRowDelete(row.id)");
  });

  it("saves checklist items from the draft rows without preview rendering", () => {
    expect(farmTs).toContain("microtasks: getChecklistItemsFromDraft()");
    expect(farmTs).not.toContain("renderChecklistPreview");
    expect(farmTs).not.toContain("taskChecklistPreview");
    expect(farmTs).not.toContain("addChecklistDraftRow");
    expect(farmTs).not.toContain("setupChecklistEditor");
  });
});
