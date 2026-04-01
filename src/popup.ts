type StatusResponse = {
  trackerState: { mood: string; paused: boolean };
  currentDomain: string | null;
  currentDomainType: string;
  gameState?: {
    tasks: Array<{ id: string; title: string }>;
    activeTaskId: string | null;
  };
};

let isPaused = false;

async function fetchStatus(): Promise<void> {
  const res = (await chrome.runtime.sendMessage({ type: "getGameState" })) as StatusResponse;

  const monsterState = document.getElementById("monsterState");
  const domain = document.getElementById("domain");
  const domainType = document.getElementById("domainType");
  const activeTask = document.getElementById("activeTask");
  const pauseBtn = document.getElementById("pauseBtn") as HTMLButtonElement | null;

  isPaused = res.trackerState.paused;

  if (monsterState) {
    monsterState.textContent = `Состояние: ${res.trackerState.mood}${isPaused ? " (пауза)" : ""}`;
  }

  if (domain) {
    domain.textContent = `Текущий домен: ${res.currentDomain ?? "—"}`;
  }

  if (domainType) {
    domainType.textContent = `Тип: ${res.currentDomainType}`;
  }

  const taskName = res.gameState?.tasks.find((task) => task.id === res.gameState?.activeTaskId)?.title ?? "нет";
  if (activeTask) {
    activeTask.textContent = `Активная задача: ${taskName}`;
  }

  if (pauseBtn) {
    pauseBtn.textContent = isPaused ? "Возобновить трекинг" : "Пауза трекинга";
  }
}

function setupActions(): void {
  const pauseBtn = document.getElementById("pauseBtn");
  const openFarmBtn = document.getElementById("openFarmBtn");

  pauseBtn?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "togglePause" });
    await fetchStatus();
  });

  openFarmBtn?.addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("farm.html") });
  });
}

void fetchStatus();
setupActions();
