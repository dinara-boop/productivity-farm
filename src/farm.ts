import {
  createChecklistDraft,
  insertChecklistRowAfter,
  removeChecklistRow,
  sanitizeChecklistItems,
  updateChecklistDraftRow,
  type ChecklistDraftRow
} from "./lib/checklist.js";
import {
  MAX_FIELDS,
  SLOT_LAYOUT,
  createFarmFieldSlots,
  getFarmFieldName,
  getFarmNavigationState,
  getFarmStatusLabel,
  type FarmFieldSlot,
  type FarmPlacement
} from "./lib/farm-fields.js";
import {
  closeFarmModal,
  createFarmModalState,
  openAchievementsModal,
  openActiveTaskModal,
  openCreateTaskModal,
  openResumeTaskModal,
  openShopModal,
  type FarmModalState
} from "./lib/farm-modal.js";
import { resolveFarmTaskSelection } from "./lib/farm-selection.js";
import { MONSTER_IMAGE_FALLBACK, resolveMonsterImage, resolveMonsterStage } from "./lib/monster.js";
import { renderMonsterTransition, type MonsterTransitionSnapshot } from "./lib/monster-transition.js";
import { normalizeDomainList } from "./lib/tracker.js";

type Microtask = { text: string; done: boolean };
type TaskStatus = "active" | "paused" | "completed";
type Task = {
  id: string;
  title: string;
  microtasks: Microtask[];
  status: TaskStatus;
  growthUnits: number;
  activeElapsedMs: number;
  stage: 1 | 2 | 3 | 4;
  mood: "normal" | "sad" | "sick" | "dead";
  fieldIndex: number;
  slotIndex: number;
};

type GameState = {
  tasks: Task[];
  activeTaskId: string | null;
  points: number;
  inventory: string[];
  achievements: {
    focus10Count: number;
    taskStreakRewardCount: number;
    maxLevelRewardCount: number;
  };
};

type FarmResponse = {
  trackerState: { mood: "normal" | "sad" | "sick" | "dead"; growthUnits: number; paused: boolean };
  trackingPausedManually: boolean;
  currentDomain: string | null;
  currentDomainType: string;
  gameState: GameState;
  popupContext?: {
    lastFocusedTaskId: string | null;
    elapsedMsByTaskId: Record<string, number>;
    activeStartedAt: number | null;
  };
  shop: Array<{ id: string; title: string; price: number }>;
};

type MessageResponse = {
  ok?: boolean;
  error?: string;
};

type CreateTaskResponse = MessageResponse & {
  task?: Task;
};

type DomainListsResponse = {
  good: string[];
  bad: string[];
};

type SaveDomainListsResponse = MessageResponse & {
  lists?: DomainListsResponse;
};

type UIState = FarmModalState;

type FocusTarget = {
  rowId: string;
  caret?: "end";
};

const UI = {
  labels: {
    points: "Бонусы",
    completedTask: "завершенная задача",
    inProgressTask: "в процессе",
    taskCreated: "Задача создана.",
    taskNameRequired: "Укажите название задачи.",
    taskCreateFailed: "Не удалось создать задачу.",
    taskCompleteFailed: "Не удалось завершить задачу.",
    noActiveTask: "Активная задача не найдена.",
    checklistTitle: "Чек-лист",
    stage: "Стадия",
    mood: "Настроение",
    pause: "Поставить на паузу",
    resume: "Продолжить",
    finishTask: "Завершить задачу",
    activeModeTitle: "Активная задача",
    createModeTitle: "Создание задачи",
    selectModeTitle: "Продолжить задачу",
    completed: "Выполнено",
    notCompleted: "Не выполнено",
    shopOwned: "Куплено",
    shopBuy: "Купить",
    achievementsTitle: "Достижения",
    focusAchievement: "10 минут без отвлечений",
    streakAchievement: "3 задачи подряд",
    maxLevelAchievement: "Максимальный уровень монстра",
    domainSaveFailed: "Не удалось сохранить списки сайтов.",
    domainsSaved: "Списки сайтов сохранены.",
    createMonster: "Монстрик новой задачи",
    freeSlot: "Свободный слот",
    freeSlotHint: "Задача еще не создана.",
    createTaskInSlot: "Создать задачу",
    prevField: "◀",
    nextField: "▶"
  }
} as const;

const mutableUiLabels = UI.labels as Record<string, string>;
mutableUiLabels.activeTaskBadge = "активная";
mutableUiLabels.pausedTaskBadge = "на паузе";
mutableUiLabels.completedTaskBadge = "завершена";
mutableUiLabels.taskSwitchBlocked = "Сначала поставьте текущую задачу на паузу.";
mutableUiLabels.pausedTask = "на паузе";
mutableUiLabels.taskPauseFailed = "Не удалось поставить задачу на паузу.";
mutableUiLabels.pause = "Поставить на паузу";
mutableUiLabels.resume = "Возобновить задачу";
const labels = UI.labels as typeof UI.labels & {
  pausedTask: string;
  taskPauseFailed: string;
  activeTaskBadge: string;
  pausedTaskBadge: string;
  completedTaskBadge: string;
  taskSwitchBlocked: string;
};

const STAGE_EMOJIS: Record<Task["stage"], string> = {
  1: "🥚",
  2: "🐣",
  3: "🐥",
  4: "🐲"
};
const FARM_PEN_IMAGE = "./assets/farm-pen.png";
const FIELD_PEN_IMAGES: Record<number, string> = {
  1: "./assets/north-meadow-pen.png",
  2: "./assets/crystal-field-pen.png"
};
const FIELD_SIGN_IMAGES: Record<number, string> = {
  0: "./assets/flower-garden-sign.png",
  1: "./assets/north-meadow-sign.png",
  2: "./assets/crystal-field-sign.png"
};
const FIELD_BACKGROUND_IMAGES: Record<number, string> = {
  1: "./assets/north-meadow-bg.png",
  2: "./assets/crystal-field-bg.png"
};

let uiState: UIState = createFarmModalState();
let currentFarmFieldIndex = 0;
let currentDomainLists: DomainListsResponse = { good: [], bad: [] };
let latestResponse: FarmResponse | null = null;
let checklistDraftRows: ChecklistDraftRow[] = createChecklistDraft([], createChecklistRowId);
let previousFarmMonsterSnapshots = new Map<string, MonsterTransitionSnapshot>();

function createChecklistRowId(): string {
  return crypto.randomUUID();
}

function splitDomainTextarea(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createMonsterSnapshot(task: Task): MonsterTransitionSnapshot {
  return {
    stage: resolveMonsterStage(task),
    mood: task.mood,
    imageSrc: resolveMonsterImage(task),
    alt: task.title
  };
}

function createMonsterNode(
  snapshotKey: string,
  task: Task,
  shellClassName: string,
  imageClassName: string
): HTMLDivElement {
  const host = document.createElement("div");
  host.className = shellClassName;
  const nextSnapshot = createMonsterSnapshot(task);
  renderMonsterTransition({
    host,
    imageClassName,
    next: nextSnapshot,
    previous: previousFarmMonsterSnapshots.get(snapshotKey) ?? null
  });
  previousFarmMonsterSnapshots.set(snapshotKey, nextSnapshot);
  return host;
}

function pruneMonsterSnapshots(activeKeys: Set<string>): void {
  previousFarmMonsterSnapshots.forEach((_value, key) => {
    if (!activeKeys.has(key)) {
      previousFarmMonsterSnapshots.delete(key);
    }
  });
}

function setNotice(elementId: string, message: string, isError = false): void {
  const element = document.getElementById(elementId);
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle("error", isError);
}

function clearNotice(elementId: string): void {
  setNotice(elementId, "", false);
}

function setFarmNotice(message: string, isError = false): void {
  setNotice("homeFarmNotice", message, isError);
}

function clearFarmNotice(): void {
  setFarmNotice("", false);
}

function getSelectedTask(response: FarmResponse): Task | undefined {
  const preferredTaskId = uiState.selectedTaskIdForModal ?? response.gameState.activeTaskId;
  if (!preferredTaskId) {
    return undefined;
  }

  return response.gameState.tasks.find((task) => task.id === preferredTaskId);
}

function syncUiStateWithData(response: FarmResponse): void {
  if (uiState.modal === "activeTask" || uiState.modal === "resumeTask") {
    const task = getSelectedTask(response);
    if (!task) {
      uiState = closeFarmModal();
    }
  }
}

function closeCurrentModal(): void {
  uiState = closeFarmModal();
  renderUI();
}

function getChecklistItemsFromDraft(): string[] {
  return sanitizeChecklistItems(checklistDraftRows.map((row) => row.text));
}

function renderChecklistDraft(focusTarget?: FocusTarget): void {
  const container = document.getElementById("checklistDraftRows");
  if (!container) {
    return;
  }

  container.innerHTML = "";

  checklistDraftRows.forEach((row) => {
    const line = document.createElement("label");
    line.className = "checklist-editor-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.disabled = true;

    const input = document.createElement("input");
    input.type = "text";
    input.value = row.text;
    input.placeholder = "Новая микрозадача";
    input.dataset.rowId = row.id;

    input.addEventListener("input", () => {
      checklistDraftRows = updateChecklistDraftRow(checklistDraftRows, row.id, input.value);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleChecklistEnter(row.id);
        return;
      }

      if (
        (event.key === "Backspace" || event.key === "Delete") &&
        input.value.length === 0 &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        handleChecklistRowDelete(row.id);
      }
    });

    line.append(checkbox, input);
    container.appendChild(line);
  });

  if (focusTarget) {
    const targetInput = container.querySelector<HTMLInputElement>(`input[data-row-id="${focusTarget.rowId}"]`);
    if (!targetInput) {
      return;
    }

    targetInput.focus();
    if (focusTarget.caret === "end") {
      const end = targetInput.value.length;
      targetInput.setSelectionRange(end, end);
    }
  }
}

function handleChecklistEnter(rowId: string): void {
  const currentIndex = checklistDraftRows.findIndex((row) => row.id === rowId);
  if (currentIndex === -1) {
    return;
  }

  const nextRows = insertChecklistRowAfter(checklistDraftRows, rowId, createChecklistRowId);
  const nextIndex = Math.min(currentIndex + 1, nextRows.length - 1);
  checklistDraftRows = nextRows;
  renderChecklistDraft({ rowId: nextRows[nextIndex].id });
}

function handleChecklistRowDelete(rowId: string): void {
  const currentIndex = checklistDraftRows.findIndex((row) => row.id === rowId);
  if (currentIndex === -1) {
    return;
  }

  if (checklistDraftRows.length === 1) {
    renderChecklistDraft({ rowId });
    return;
  }

  checklistDraftRows = removeChecklistRow(checklistDraftRows, rowId, createChecklistRowId);
  const nextIndex = Math.max(0, currentIndex - 1);
  const nextRow = checklistDraftRows[Math.min(nextIndex, checklistDraftRows.length - 1)];
  renderChecklistDraft({ rowId: nextRow.id, caret: "end" });
}

function resetCreateDraft(): void {
  const titleInput = document.getElementById("taskTitle") as HTMLInputElement | null;
  const goodDomains = document.getElementById("goodDomains") as HTMLTextAreaElement | null;
  const badDomains = document.getElementById("badDomains") as HTMLTextAreaElement | null;

  if (titleInput) {
    titleInput.value = "";
  }

  if (goodDomains) {
    goodDomains.value = currentDomainLists.good.join("\n");
  }

  if (badDomains) {
    badDomains.value = currentDomainLists.bad.join("\n");
  }

  checklistDraftRows = createChecklistDraft([], createChecklistRowId);
  renderChecklistDraft();
  clearNotice("taskFormNotice");
}

function enterCreateMode(slot?: FarmPlacement): void {
  uiState = openCreateTaskModal(slot);
  if (slot) {
    currentFarmFieldIndex = slot.fieldIndex;
  }
  clearFarmNotice();
  resetCreateDraft();
  renderUI();
}

function enterResumeTaskMode(taskId?: string): void {
  uiState = openResumeTaskModal(taskId);
  clearFarmNotice();
  clearNotice("activeTaskNotice");
  renderUI();
}

function enterActiveMode(taskId: string, fieldIndex?: number): void {
  uiState = openActiveTaskModal(taskId);
  if (typeof fieldIndex === "number") {
    currentFarmFieldIndex = Math.max(0, Math.min(MAX_FIELDS - 1, fieldIndex));
  }
  clearFarmNotice();
  clearNotice("activeTaskNotice");
  renderUI();
}

function getFarmTaskBadge(task: Task): string {
  return getFarmStatusLabel(task.status);
}

function applySlotPosition(element: HTMLElement, slotIndex: number): void {
  const layout = SLOT_LAYOUT[slotIndex] ?? SLOT_LAYOUT[0];
  element.style.setProperty("--slot-x", `${layout.x}%`);
  element.style.setProperty("--slot-y", `${layout.y}%`);
  const visualYOffset = slotIndex === 0 ? "100px" : slotIndex === 1 ? "50px" : "0px";
  element.style.setProperty("--slot-y-offset", visualYOffset);
}

function updateFarmFieldControls(sectionId: "home"): void {
  const title = document.getElementById(`${sectionId}FarmFieldName`);
  const prevButton = document.getElementById(`${sectionId}FarmPrevBtn`) as HTMLButtonElement | null;
  const nextButton = document.getElementById(`${sectionId}FarmNextBtn`) as HTMLButtonElement | null;
  const navigation = getFarmNavigationState(currentFarmFieldIndex);
  const fieldName = getFarmFieldName(currentFarmFieldIndex);

  if (title) {
    title.replaceChildren();
    title.setAttribute("aria-label", fieldName);

    const signImageSrc = FIELD_SIGN_IMAGES[currentFarmFieldIndex];
    const useSign = typeof signImageSrc === "string";
    title.classList.toggle("farm-field-sign", useSign);

    if (useSign) {
      const signImage = document.createElement("img");
      signImage.className = "farm-field-sign-image";
      signImage.src = signImageSrc;
      signImage.alt = fieldName;
      signImage.decoding = "async";
      signImage.draggable = false;
      title.appendChild(signImage);
    } else {
      title.textContent = fieldName;
    }
  }

  if (prevButton) {
    prevButton.disabled = !navigation.canGoPrev;
  }

  if (nextButton) {
    nextButton.disabled = !navigation.canGoNext;
  }
}

async function handleFarmTaskSelection(taskId: string): Promise<void> {
  if (!latestResponse) {
    return;
  }

  const selection = resolveFarmTaskSelection(latestResponse.gameState, taskId);

  if (selection.type === "not-found") {
    setFarmNotice(UI.labels.noActiveTask, true);
    return;
  }

  if (selection.type === "completed") {
    clearFarmNotice();
    enterResumeTaskMode(selection.task.id);
    return;
  }

  if (selection.type === "blocked") {
    setFarmNotice(labels.taskSwitchBlocked, true);
    return;
  }

  if (selection.type === "open-active") {
    clearFarmNotice();
    enterActiveMode(selection.task.id, selection.task.fieldIndex);
    return;
  }

  clearFarmNotice();
  enterResumeTaskMode(selection.task.id);
}

function renderFarmSlotCard(slot: FarmFieldSlot<Task>): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "farm-card";
  card.dataset.fieldIndex = String(slot.fieldIndex);
  card.dataset.slotIndex = String(slot.slotIndex);
  applySlotPosition(card, slot.slotIndex);

  const penImage = document.createElement("img");
  penImage.className = "farm-card-pen";
  penImage.src = FIELD_PEN_IMAGES[slot.fieldIndex] ?? FARM_PEN_IMAGE;
  penImage.alt = "";
  penImage.decoding = "async";
  penImage.draggable = false;
  penImage.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");
  content.className = "farm-card-content";

  card.append(penImage, content);

  if (!slot.task) {
    card.classList.add("empty-slot");
    card.dataset.slotState = "empty";

    const createButton = document.createElement("button");
    createButton.type = "button";
    createButton.className = "farm-card-create-button";
    createButton.textContent = UI.labels.createTaskInSlot;
    createButton.addEventListener("click", (event) => {
      event.stopPropagation();
      enterCreateMode({ fieldIndex: slot.fieldIndex, slotIndex: slot.slotIndex });
    });

    content.appendChild(createButton);
    return card;
  }

  const task = slot.task;
  card.classList.add("clickable", task.status);
  card.dataset.taskId = task.id;
  card.dataset.taskStatus = task.status;
  card.dataset.slotState = "occupied";
  card.title = task.status === "completed" ? UI.labels.completedTask : task.title;

  const taskButton = document.createElement("button");
  taskButton.type = "button";
  taskButton.className = "farm-card-task";
  taskButton.addEventListener("click", async () => {
    await handleFarmTaskSelection(task.id);
  });

  const monsterImage = createMonsterNode(
    `farm-slot:${task.id}`,
    task,
    "farm-card-task-monster-shell",
    "farm-card-task-monster"
  );

  const title = document.createElement("div");
  title.className = "farm-card-task-title";
  title.textContent = task.title;

  const status = document.createElement("div");
  status.className = "farm-card-task-status";
  status.textContent = getFarmTaskBadge(task);

  taskButton.append(monsterImage, title, status);
  content.appendChild(taskButton);
  return card;
}

function renderFarmField(containerId: string, tasks: Task[]): void {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const backgroundImage = FIELD_BACKGROUND_IMAGES[currentFarmFieldIndex] ?? "./assets/farm-bg.png";
  container.style.setProperty("--field-bg-image", `url("${backgroundImage}")`);
  container.innerHTML = "";

  const slots = createFarmFieldSlots(tasks, currentFarmFieldIndex);
  slots.forEach((slot) => {
    container.appendChild(renderFarmSlotCard(slot));
  });
}

function renderFarmSection(sectionId: "home", tasks: Task[]): void {
  updateFarmFieldControls(sectionId);
  renderFarmField(`${sectionId}FarmField`, tasks);
}

function renderShopModal(response: FarmResponse): void {
  const content = document.getElementById("shopContent");
  if (!content) {
    return;
  }

  content.innerHTML = "";

  response.shop.forEach((item) => {
    const isOwned = response.gameState.inventory.includes(item.id);
    const row = document.createElement("div");
    row.className = "task-card";

    const title = document.createElement("div");
    title.innerHTML = `<strong>${item.title}</strong>`;

    const meta = document.createElement("div");
    meta.className = "small";
    meta.textContent = `${item.price} ${UI.labels.points.toLowerCase()}`;

    const button = document.createElement("button");
    button.textContent = isOwned ? UI.labels.shopOwned : UI.labels.shopBuy;
    button.disabled = isOwned || item.price === 0;
    button.addEventListener("click", async () => {
      await chrome.runtime.sendMessage({ type: "buyItem", payload: { itemId: item.id } });
      await refresh();
    });

    row.append(title, meta, button);
    content.appendChild(row);
  });
}

function renderAchievementsModal(gameState: GameState): void {
  const content = document.getElementById("achievementsContent");
  if (!content) {
    return;
  }

  content.innerHTML = "";

  const items = [
    { title: UI.labels.focusAchievement, count: gameState.achievements.focus10Count },
    { title: UI.labels.streakAchievement, count: gameState.achievements.taskStreakRewardCount },
    { title: UI.labels.maxLevelAchievement, count: gameState.achievements.maxLevelRewardCount }
  ];

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "task-card";

    const title = document.createElement("div");
    title.innerHTML = `<strong>${item.title}</strong>`;

    const status = document.createElement("div");
    status.className = "small";
    status.textContent = `${item.count > 0 ? UI.labels.completed : UI.labels.notCompleted} В· ${item.count}`;

    card.append(title, status);
    content.appendChild(card);
  });
}

function renderActiveTaskPanel(response: FarmResponse): void {
  const container = document.getElementById("activeTaskContent");
  if (!container) {
    return;
  }

  container.innerHTML = "";

  const task = getSelectedTask(response);
  if (!task) {
    setNotice("activeTaskNotice", UI.labels.noActiveTask, true);
    return;
  }

  clearNotice("activeTaskNotice");

  const title = document.createElement("div");
  title.innerHTML = `<strong>${task.title}</strong>`;

  const monster = createMonsterNode(`farm-modal:${task.id}`, task, "task-monster-shell", "task-monster");

  const details = document.createElement("div");
  details.className = "small";
  details.textContent = `${UI.labels.stage}: ${task.stage}/4 В· ${UI.labels.mood}: ${task.mood}`;

  const checklistTitle = document.createElement("div");
  checklistTitle.className = "small";
  checklistTitle.textContent = UI.labels.checklistTitle;

  const checklist = document.createElement("div");
  checklist.className = "task-checklist";

  task.microtasks.forEach((item, index) => {
    const row = document.createElement("label");
    row.className = "task-checklist-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.done;
    checkbox.disabled = task.status !== "active";
    checkbox.addEventListener("change", async () => {
      await chrome.runtime.sendMessage({ type: "toggleMicrotask", payload: { taskId: task.id, index } });
      await refresh();
    });

    const text = document.createElement("span");
    text.textContent = item.text;

    row.append(checkbox, text);
    checklist.appendChild(row);
  });

  const actions = document.createElement("div");
  actions.className = "inline-actions";

  if (task.status === "completed") {
    container.append(title, monster, details, checklistTitle, checklist);
    return;
  }

  const pauseOrResumeButton = document.createElement("button");
  pauseOrResumeButton.textContent = task.status === "active" ? UI.labels.pause : UI.labels.resume;
  pauseOrResumeButton.addEventListener("click", async () => {
    const message =
      task.status === "active"
        ? { type: "pauseTask", payload: { taskId: task.id } }
        : { type: "activateTask", payload: { taskId: task.id } };
    const result = (await chrome.runtime.sendMessage(message)) as MessageResponse;

    if (result.ok === false) {
      setNotice("activeTaskNotice", result.error ?? labels.taskSwitchBlocked, true);
      return;
    }

    enterActiveMode(task.id, task.fieldIndex);
    await refresh();
  });

  const finishButton = document.createElement("button");
  finishButton.textContent = UI.labels.finishTask;
  finishButton.addEventListener("click", async () => {
    const result = (await chrome.runtime.sendMessage({
      type: "completeTask",
      payload: { taskId: task.id }
    })) as MessageResponse;

    if (result.ok === false) {
      setNotice("activeTaskNotice", result.error ?? UI.labels.taskCompleteFailed, true);
      return;
    }

    uiState = closeFarmModal();
    await refresh();
  });

  actions.append(pauseOrResumeButton, finishButton);

  container.append(title, monster, details, checklistTitle, checklist, actions);
}

function renderFarmToolbars(response: FarmResponse): void {
  document.querySelectorAll<HTMLElement>('[data-role="farm-points"]').forEach((element) => {
    element.textContent = String(response.gameState.points);
  });
}

function renderModalShell(response: FarmResponse): void {
  const taskModal = document.getElementById("taskModal");
  const shopModalElement = document.getElementById("shopModal");
  const achievementsModalElement = document.getElementById("achievementsModal");
  const title = document.getElementById("taskModalTitle");
  const createContent = document.getElementById("createTaskModalContent");
  const activeContent = document.getElementById("activeTaskModalContent");
  const isTaskModal = uiState.modal === "createTask" || uiState.modal === "resumeTask" || uiState.modal === "activeTask";

  if (taskModal) {
    taskModal.hidden = !isTaskModal;
  }

  if (shopModalElement) {
    shopModalElement.hidden = uiState.modal !== "shop";
  }

  if (achievementsModalElement) {
    achievementsModalElement.hidden = uiState.modal !== "achievements";
  }

  if (createContent) {
    createContent.hidden = uiState.modal !== "createTask";
  }

  if (activeContent) {
    activeContent.hidden = uiState.modal !== "resumeTask" && uiState.modal !== "activeTask";
  }

  if (title) {
    const titles: Record<string, string> = {
      none: "Задача",
      createTask: UI.labels.createModeTitle,
      resumeTask: UI.labels.selectModeTitle,
      activeTask: UI.labels.activeModeTitle,
      shop: "Задача",
      achievements: "Задача"
    };
    title.textContent = titles[uiState.modal];
  }

  document.body.classList.toggle("modal-open", uiState.modal !== "none");

  if (uiState.modal === "createTask") {
    const createEmoji = document.getElementById("createTaskMonsterImage") as HTMLImageElement | null;
    if (createEmoji) {
      createEmoji.src = resolveMonsterImage({ stage: 0, mood: "normal", activeElapsedMs: 0 });
      createEmoji.alt = UI.labels.createMonster;
      createEmoji.onerror = () => {
        createEmoji.onerror = null;
        createEmoji.src = MONSTER_IMAGE_FALLBACK;
      };
    }
  }

  if (uiState.modal === "resumeTask") {
    renderActiveTaskPanel(response);
  }

  if (uiState.modal === "activeTask") {
    renderActiveTaskPanel(response);
  }
}

function renderUI(): void {
  if (!latestResponse) {
    return;
  }

  currentFarmFieldIndex = Math.max(0, Math.min(MAX_FIELDS - 1, currentFarmFieldIndex));

  const homeScreen = document.getElementById("homeScreen");

  if (homeScreen) {
    homeScreen.hidden = false;
  }

  renderFarmSection("home", latestResponse.gameState.tasks);
  renderFarmToolbars(latestResponse);
  renderShopModal(latestResponse);
  renderAchievementsModal(latestResponse.gameState);
  renderModalShell(latestResponse);

  const activeSnapshotKeys = new Set(latestResponse.gameState.tasks.map((task) => `farm-slot:${task.id}`));
  const selectedTask = getSelectedTask(latestResponse);
  if (selectedTask && (uiState.modal === "activeTask" || uiState.modal === "resumeTask")) {
    activeSnapshotKeys.add(`farm-modal:${selectedTask.id}`);
  }
  pruneMonsterSnapshots(activeSnapshotKeys);
}

async function loadDomainLists(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({ type: "getDomainLists" })) as DomainListsResponse;
  currentDomainLists = response;

  if (uiState.modal === "createTask") {
    const goodDomains = document.getElementById("goodDomains") as HTMLTextAreaElement | null;
    const badDomains = document.getElementById("badDomains") as HTMLTextAreaElement | null;

    if (goodDomains && goodDomains.value.length === 0) {
      goodDomains.value = response.good.join("\n");
    }

    if (badDomains && badDomains.value.length === 0) {
      badDomains.value = response.bad.join("\n");
    }
  }
}

async function refresh(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({ type: "getGameState" })) as FarmResponse;
  latestResponse = response;
  syncUiStateWithData(response);
  renderUI();
}

async function saveTaskFromCreateModal(): Promise<void> {
  const titleInput = document.getElementById("taskTitle") as HTMLInputElement | null;
  const goodDomains = document.getElementById("goodDomains") as HTMLTextAreaElement | null;
  const badDomains = document.getElementById("badDomains") as HTMLTextAreaElement | null;
  const title = titleInput?.value.trim() ?? "";

  if (!title) {
    setNotice("taskFormNotice", UI.labels.taskNameRequired, true);
    return;
  }

  const good = normalizeDomainList(splitDomainTextarea(goodDomains?.value ?? ""));
  const bad = normalizeDomainList(splitDomainTextarea(badDomains?.value ?? ""));

  const domainResponse = (await chrome.runtime.sendMessage({
    type: "saveDomainLists",
    payload: { good, bad }
  })) as SaveDomainListsResponse;

  if (domainResponse.ok === false) {
    setNotice("taskFormNotice", domainResponse.error ?? UI.labels.domainSaveFailed, true);
    return;
  }

  currentDomainLists = domainResponse.lists ?? { good, bad };

  const createResponse = (await chrome.runtime.sendMessage({
    type: "createTask",
    payload: {
      title,
      microtasks: getChecklistItemsFromDraft(),
      fieldIndex: uiState.selectedEmptySlotForCreate?.fieldIndex,
      slotIndex: uiState.selectedEmptySlotForCreate?.slotIndex
    }
  })) as CreateTaskResponse;

  if (createResponse.ok === false || !createResponse.task) {
    setNotice("taskFormNotice", createResponse.error ?? UI.labels.taskCreateFailed, true);
    return;
  }

  resetCreateDraft();
  setNotice("taskFormNotice", UI.labels.taskCreated);
  enterActiveMode(createResponse.task.id, createResponse.task.fieldIndex);
  await refresh();
}

function setupNavigation(): void {
  const moveToPreviousField = (): void => {
    currentFarmFieldIndex = Math.max(0, currentFarmFieldIndex - 1);
    renderUI();
  };

  const moveToNextField = (): void => {
    currentFarmFieldIndex = Math.min(MAX_FIELDS - 1, currentFarmFieldIndex + 1);
    renderUI();
  };

  document.getElementById("homeFarmPrevBtn")?.addEventListener("click", moveToPreviousField);
  document.getElementById("homeFarmNextBtn")?.addEventListener("click", moveToNextField);
}

function setupCreateModal(): void {
  document.getElementById("saveTaskBtn")?.addEventListener("click", async () => {
    await saveTaskFromCreateModal();
  });
}

function setupModals(): void {
  document.querySelectorAll<HTMLElement>('[data-action="open-shop"]').forEach((button) => {
    button.addEventListener("click", () => {
      uiState = openShopModal();
      renderUI();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-action="open-achievements"]').forEach((button) => {
    button.addEventListener("click", () => {
      uiState = openAchievementsModal();
      renderUI();
    });
  });

  document.getElementById("closeTaskModalBtn")?.addEventListener("click", () => {
    closeCurrentModal();
  });

  document.getElementById("closeShopModalBtn")?.addEventListener("click", () => {
    closeCurrentModal();
  });

  document.getElementById("closeAchievementsModalBtn")?.addEventListener("click", () => {
    closeCurrentModal();
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal && modal instanceof HTMLDivElement) {
        closeCurrentModal();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCurrentModal();
    }
  });
}

setupNavigation();
setupCreateModal();
setupModals();
renderChecklistDraft();
void loadDomainLists();
void refresh();
setInterval(() => {
  void refresh();
}, 2000);
