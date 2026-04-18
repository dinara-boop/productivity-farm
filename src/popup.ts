import {
  renderMonsterTransition,
  type MonsterTransitionSnapshot
} from "./lib/monster-transition.js";
import { getPopupViewModel, type PopupStatusResponse } from "./lib/popup.js";

let previousPopupMonsterSnapshot: MonsterTransitionSnapshot | null = null;
let previousPopupTaskId: string | null = null;

function renderPopup(status: PopupStatusResponse): void {
  const view = getPopupViewModel(status);
  const popupTitle = document.getElementById("popupTitle");
  const taskCard = document.getElementById("taskCard");
  const openFarmBtn = document.getElementById("openFarmBtn") as HTMLButtonElement | null;
  const taskActionBtn = document.getElementById("taskActionBtn") as HTMLButtonElement | null;
  const monsterImageHost = document.getElementById("monsterImageHost") as HTMLDivElement | null;
  const taskTitle = document.getElementById("taskTitle");
  const monsterState = document.getElementById("monsterState");
  const elapsedTime = document.getElementById("elapsedTime");

  if (popupTitle) {
    popupTitle.textContent = view.popupTitle;
  }

  if (openFarmBtn) {
    openFarmBtn.textContent = view.openFarmButtonText;
  }

  if (taskCard) {
    taskCard.hidden = !view.showTaskCard;
  }

  if (!view.showTaskCard) {
    if (taskActionBtn) {
      taskActionBtn.hidden = true;
      taskActionBtn.dataset.action = "";
      taskActionBtn.dataset.taskId = "";
    }

    if (monsterImageHost) {
      monsterImageHost.hidden = true;
      monsterImageHost.replaceChildren();
    }

    if (taskTitle) {
      taskTitle.textContent = "";
    }

    if (monsterState) {
      monsterState.textContent = "";
    }

    if (elapsedTime) {
      elapsedTime.textContent = "";
    }

    previousPopupMonsterSnapshot = null;
    previousPopupTaskId = null;
    return;
  }

  if (taskActionBtn) {
    taskActionBtn.hidden = false;
    taskActionBtn.textContent = view.taskActionButtonText;
    taskActionBtn.dataset.action = view.taskAction;
    taskActionBtn.dataset.taskId = view.taskId;
  }

  if (monsterImageHost) {
    monsterImageHost.hidden = false;
    const nextSnapshot: MonsterTransitionSnapshot = {
      stage: view.monsterVisualStage,
      mood: view.monsterMood,
      imageSrc: view.monsterImageSrc,
      alt: view.taskTitle
    };

    renderMonsterTransition({
      host: monsterImageHost,
      imageClassName: "monster-image",
      next: nextSnapshot,
      previous: previousPopupTaskId === view.taskId ? previousPopupMonsterSnapshot : null
    });

    previousPopupMonsterSnapshot = nextSnapshot;
    previousPopupTaskId = view.taskId;
  }

  if (taskTitle) {
    taskTitle.textContent = view.taskTitle;
  }

  if (monsterState) {
    monsterState.textContent = view.monsterStateText;
  }

  if (elapsedTime) {
    elapsedTime.textContent = view.elapsedText;
  }
}

async function fetchStatus(): Promise<void> {
  const status = (await chrome.runtime.sendMessage({ type: "getGameState" })) as PopupStatusResponse;
  renderPopup(status);
}

async function handleTaskAction(button: HTMLButtonElement): Promise<void> {
  const action = button.dataset.action;
  const taskId = button.dataset.taskId;

  if (action === "pause") {
    await chrome.runtime.sendMessage({ type: "pauseActiveTask" });
    await fetchStatus();
    return;
  }

  if (action === "resume" && taskId) {
    await chrome.runtime.sendMessage({ type: "activateTask", payload: { taskId } });
    await fetchStatus();
  }
}

function setupActions(): void {
  const taskActionBtn = document.getElementById("taskActionBtn") as HTMLButtonElement | null;
  const openFarmBtn = document.getElementById("openFarmBtn");

  taskActionBtn?.addEventListener("click", async () => {
    await handleTaskAction(taskActionBtn);
  });

  openFarmBtn?.addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("farm.html") });
  });
}

if (typeof document !== "undefined") {
  setupActions();
  void fetchStatus();
  setInterval(() => {
    void fetchStatus();
  }, 1000);
}

export { renderPopup };
