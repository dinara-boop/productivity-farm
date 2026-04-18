import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SLOT_LAYOUT } from "../src/lib/farm-fields";

const farmHtml = readFileSync(new URL("../src/farm.html", import.meta.url), "utf8");
const farmTs = readFileSync(new URL("../src/farm.ts", import.meta.url), "utf8");

describe("farm toolbar layout", () => {
  it("renders a single full-screen farm toolbar", () => {
    expect(farmHtml.match(/data-role="farm-toolbar"/g) ?? []).toHaveLength(1);
    expect(farmHtml.match(/<button[^>]+data-action="open-shop"/g) ?? []).toHaveLength(1);
    expect(farmHtml.match(/<button[^>]+data-action="open-achievements"/g) ?? []).toHaveLength(1);
    expect(farmHtml.match(/<span[^>]+data-role="farm-points"/g) ?? []).toHaveLength(1);
  });

  it("uses the redesigned toolbar skin with the bonus icon asset", () => {
    expect(farmHtml).toContain(".farm-toolbar-shell::before");
    expect(farmHtml).toContain('url("./assets/bonus-icon.svg")');
    expect(existsSync(new URL("../src/assets/bonus-icon.svg", import.meta.url))).toBe(true);
  });

  it("does not render global task action buttons on the farm screen", () => {
    expect(farmHtml).not.toContain('id="openCreateTaskBtn"');
    expect(farmHtml).not.toContain('id="openResumeTaskBtn"');
    expect(farmHtml).not.toContain('id="openActiveTaskBtn"');
    expect(farmHtml).not.toContain('data-action="open-create-task"');
    expect(farmHtml).not.toContain('data-action="open-resume-task"');
    expect(farmHtml).not.toContain('data-action="open-active-task"');
    expect(farmHtml).not.toContain(">Создать задачу</button>");
    expect(farmHtml).not.toContain(">Продолжить задачу</button>");
  });

  it("does not keep legacy modal trigger buttons", () => {
    expect(farmHtml).not.toContain('id="openShopModalBtn"');
    expect(farmHtml).not.toContain('id="openAchievementsModalBtn"');
  });

  it("uses the farm background scene and renders one farm surface", () => {
    expect(farmHtml).toContain('url("./assets/farm-bg.png")');
    expect(farmHtml).toContain("center / cover no-repeat");
    expect(farmHtml.match(/class="farm-field"/g) ?? []).toHaveLength(1);
  });

  it("keeps the shared field rendering but swaps in dedicated backgrounds for themed fields", () => {
    expect(farmHtml).toContain("--field-bg-image: var(--farm-bg-image);");
    expect(farmTs).toContain('const FIELD_BACKGROUND_IMAGES: Record<number, string> = {');
    expect(farmTs).toContain('1: "./assets/north-meadow-bg.png"');
    expect(farmTs).toContain('2: "./assets/crystal-field-bg.png"');
    expect(farmTs).toContain('container.style.setProperty("--field-bg-image"');
    expect(existsSync(new URL("../src/assets/north-meadow-bg.png", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../src/assets/crystal-field-bg.png", import.meta.url))).toBe(true);
  });

  it("keeps create task action inside empty slot rendering only", () => {
    expect(farmTs).toContain('card.classList.add("empty-slot")');
    expect(farmTs).toContain('createButton.className = "farm-card-create-button"');
    expect(farmTs).toContain("createButton.textContent = UI.labels.createTaskInSlot");
    expect(farmTs).toContain("enterCreateMode({ fieldIndex: slot.fieldIndex, slotIndex: slot.slotIndex })");
    expect(farmTs).not.toContain("title.textContent = UI.labels.freeSlot");
    expect(farmTs).not.toContain("subtitle.textContent = UI.labels.freeSlotHint");
  });

  it("renders each slot as a pen image with overlay content", () => {
    expect(farmTs).toContain('const FARM_PEN_IMAGE = "./assets/farm-pen.png"');
    expect(farmTs).toContain('penImage.className = "farm-card-pen"');
    expect(farmTs).toContain('content.className = "farm-card-content"');
    expect(farmHtml).toContain(".farm-card-pen");
    expect(farmHtml).toContain(".farm-card-content");
    expect(existsSync(new URL("../src/assets/farm-pen.png", import.meta.url))).toBe(true);
  });

  it("keeps the shared slot layout but swaps in a dedicated pen image for north meadow only", () => {
    expect(farmTs).toContain('const FIELD_PEN_IMAGES: Record<number, string> = {');
    expect(farmTs).toContain('1: "./assets/north-meadow-pen.png"');
    expect(farmTs).toContain('2: "./assets/crystal-field-pen.png"');
    expect(farmTs).toContain('penImage.src = FIELD_PEN_IMAGES[slot.fieldIndex] ?? FARM_PEN_IMAGE');
    expect(existsSync(new URL("../src/assets/north-meadow-pen.png", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../src/assets/crystal-field-pen.png", import.meta.url))).toBe(true);
  });

  it("renders occupied pens with transparent monster content instead of a task card", () => {
    expect(farmTs).toContain('taskButton.className = "farm-card-task"');
    expect(farmTs).toContain("renderMonsterTransition({");
    expect(farmTs).toContain("farm-slot:${task.id}");
    expect(farmTs).toContain('title.className = "farm-card-task-title"');
    expect(farmTs).toContain('status.className = "farm-card-task-status"');
    expect(farmTs).toContain("status.textContent = getFarmTaskBadge(task)");
    expect(farmHtml).toContain(".farm-card-task-monster");
    expect(farmHtml).toContain(".farm-card-task-monster-shell { width: 300px; height: 300px; transform: translate(-30px, -190px); margin-bottom: -190px; margin-left: -30px; }");
    expect(farmHtml).toContain(
      ".farm-card-task-monster { width: 100%; height: 100%; object-fit: contain; }"
    );
    expect(farmHtml).toContain(".task-monster-shell { width: 300px; height: 300px; transform: translate(-30px, -190px); margin-bottom: -190px; margin-left: -30px; }");
    expect(farmHtml).toContain(
      ".task-monster { width: 100%; height: 100%; object-fit: contain; }"
    );
    expect(farmHtml).toContain(".farm-card-task { width: 100%; min-height: 100%; padding: 0; border: 0;");
    expect(farmHtml).toContain("background: transparent; box-shadow: none;");
    expect(farmHtml).toContain(".farm-card.completed .farm-card-task { opacity: 1; }");
    expect(farmHtml).toContain(".monster-transition__layer--stage-enter");
    expect(farmHtml).toContain("prefers-reduced-motion: reduce");
    expect(farmHtml).not.toContain("border: 1px solid rgba(185, 207, 225, 0.92); border-radius: 18px;");
    expect(farmHtml).not.toContain(".farm-card-task-emoji");
    expect(farmHtml).toContain('id="createTaskMonsterImage"');
    expect(farmHtml).not.toContain('id="createTaskMonsterEmoji"');
  });

  it("does not render the old farm headings in the top-left corner", () => {
    expect(farmHtml).not.toContain("<h1>Ферма продуктивности</h1>");
    expect(farmHtml).not.toContain("<h2>Ферма</h2>");
  });

  it("locks page scrolling at the farm screen level", () => {
    expect(farmHtml).toContain("html { width: 100%; height: 100%; overflow: hidden; }");
    expect(farmHtml).toContain("body { margin: 0; min-height: 100vh; min-height: 100dvh;");
    expect(farmHtml).toContain("main { height: 100vh; height: 100dvh;");
  });

  it("constrains the farm scene to the remaining viewport height", () => {
    expect(farmHtml).toContain("grid-template-rows: auto minmax(0, 1fr) auto");
    expect(farmHtml).toContain("grid-template-rows: minmax(0, 1fr) auto");
    expect(farmHtml).toContain(".farm-field { position: relative; width: 100%; height: calc(100% + 4px);");
  });

  it("renders the redesigned lower field navigation with text title and arrow buttons", () => {
    expect(farmHtml).toContain(".farm-navigation-shell::before");
    expect(farmHtml).toContain('aria-label="Предыдущее поле"');
    expect(farmHtml).toContain('aria-label="Следующее поле"');
    expect(farmHtml).toContain('id="homeFarmFieldName" class="farm-field-name"');
    expect(farmHtml).not.toContain('class="ghost-button farm-nav-button"');
  });

  it("uses the provided svg assets for lower navigation arrows", () => {
    expect(farmHtml).toContain('src="./assets/nav-left.svg"');
    expect(farmHtml).toContain('src="./assets/nav-right.svg"');
    expect(existsSync(new URL("../src/assets/nav-left.svg", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../src/assets/nav-right.svg", import.meta.url))).toBe(true);
  });

  it("renders sign images for all themed fields with the shared bottom-pinned style", () => {
    expect(farmTs).toContain("const FIELD_SIGN_IMAGES: Record<number, string> = {");
    expect(farmTs).toContain('0: "./assets/flower-garden-sign.png"');
    expect(farmTs).toContain('1: "./assets/north-meadow-sign.png"');
    expect(farmTs).toContain('2: "./assets/crystal-field-sign.png"');
    expect(farmTs).toContain('title.classList.toggle("farm-field-sign", useSign)');
    expect(farmTs).toContain('signImage.className = "farm-field-sign-image"');
    expect(farmHtml).toContain(".farm-field-name.farm-field-sign");
    expect(existsSync(new URL("../src/assets/flower-garden-sign.png", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../src/assets/north-meadow-sign.png", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../src/assets/crystal-field-sign.png", import.meta.url))).toBe(true);
  });

  it("renders task flows through modal shells instead of split-screen panels", () => {
    expect(farmHtml).toContain('id="taskModal"');
    expect(farmHtml).toContain('id="createTaskModalContent"');
    expect(farmHtml).toContain('id="activeTaskModalContent"');
    expect(farmHtml).not.toContain('id="workspaceScreen"');
    expect(farmHtml).not.toContain('class="workspace"');
    expect(farmHtml).not.toContain('id="sidePanelTitle"');
    expect(farmHtml).not.toContain('id="goHomeBtn"');
    expect(farmHtml).not.toContain('id="createPanel"');
    expect(farmHtml).not.toContain('id="selectTaskPanel"');
    expect(farmHtml).not.toContain('id="activePanel"');
  });

  it("does not render an intermediate paused-task list", () => {
    expect(farmHtml).not.toContain('id="resumeTaskModalContent"');
    expect(farmHtml).not.toContain('id="selectTaskList"');
    expect(farmHtml).not.toContain('id="selectTaskNotice"');
    expect(farmTs).not.toContain("renderResumeTaskModalContent");
    expect(farmTs).not.toContain("getPausedTasks");
  });
});

describe("farm slot layout", () => {
  it("defines four stable slot anchor points for the background", () => {
    expect(SLOT_LAYOUT).toEqual([
      { x: 24, y: 30 },
      { x: 68, y: 30 },
      { x: 31, y: 71 },
      { x: 73, y: 66 }
    ]);
  });
});
