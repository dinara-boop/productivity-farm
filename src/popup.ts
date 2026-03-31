type StatusResponse = {
  trackerState: { mood: string; paused: boolean };
  currentDomain: string | null;
  currentDomainType: string;
};

async function fetchStatus(): Promise<void> {
  const res = (await chrome.runtime.sendMessage({ type: "getStatus" })) as StatusResponse;

  const monsterState = document.getElementById("monsterState");
  const domain = document.getElementById("domain");
  const domainType = document.getElementById("domainType");

  if (monsterState) {
    monsterState.textContent = `Состояние: ${res.trackerState.mood}${res.trackerState.paused ? " (пауза)" : ""}`;
  }

  if (domain) {
    domain.textContent = `Текущий домен: ${res.currentDomain ?? "—"}`;
  }

  if (domainType) {
    domainType.textContent = `Тип: ${res.currentDomainType}`;
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
    await chrome.tabs.create({ url: "https://example.com/farm" });
  });
}

void fetchStatus();
setupActions();
