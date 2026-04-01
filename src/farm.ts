type Microtask = { text: string; done: boolean };
type Task = {
  id: string;
  title: string;
  microtasks: Microtask[];
  completed: boolean;
  growthUnits: number;
  stage: 1 | 2 | 3 | 4;
  mood: "normal" | "sad" | "sick" | "dead";
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
  trackerState: { mood: string; growthUnits: number; paused: boolean };
  currentDomain: string | null;
  currentDomainType: string;
  gameState: GameState;
  shop: Array<{ id: string; title: string; price: number }>;
};

const emojis = {
  normal: "🙂",
  sad: "🙁",
  sick: "🤒",
  dead: "💀"
};

function render(response: FarmResponse): void {
  const { gameState } = response;
  const activeTask = gameState.tasks.find((task) => task.id === gameState.activeTaskId);

  const domainEl = document.getElementById("headerDomain");
  const typeEl = document.getElementById("headerDomainType");
  const pointsEl = document.getElementById("headerPoints");
  const monsterEmoji = document.getElementById("monsterEmoji");
  const monsterStage = document.getElementById("monsterStage");
  const monsterMood = document.getElementById("monsterMood");
  const monsterGrowth = document.getElementById("monsterGrowth");

  if (domainEl) domainEl.textContent = `Домен: ${response.currentDomain ?? "—"}`;
  if (typeEl) typeEl.textContent = `Тип: ${response.currentDomainType}`;
  if (pointsEl) pointsEl.textContent = `Очки: ${gameState.points}`;

  const mood = activeTask?.mood ?? response.trackerState.mood;
  const stage = activeTask?.stage ?? 1;
  const growthUnits = activeTask?.growthUnits ?? response.trackerState.growthUnits;

  if (monsterEmoji) monsterEmoji.textContent = emojis[mood as keyof typeof emojis] ?? "🙂";
  if (monsterStage) monsterStage.textContent = `Стадия: ${stage}/4`;
  if (monsterMood) monsterMood.textContent = `Настроение: ${mood}`;
  if (monsterGrowth) monsterGrowth.textContent = `Рост: ${growthUnits} ед.`;

  const tasksEl = document.getElementById("tasks");
  if (tasksEl) {
    tasksEl.innerHTML = "";

    gameState.tasks.forEach((task) => {
      const wrapper = document.createElement("div");
      wrapper.className = "task";
      const activeLabel = task.id === gameState.activeTaskId ? "(активная)" : "";

      wrapper.innerHTML = `<strong>${task.title}</strong> ${activeLabel}<div class="small">Стадия ${task.stage}/4 · ${task.mood}</div>`;

      task.microtasks.forEach((item, index) => {
        const line = document.createElement("label");
        line.className = "small";
        line.style.display = "block";
        line.innerHTML = `<input type="checkbox" ${item.done ? "checked" : ""} ${task.completed ? "disabled" : ""}/> ${item.text}`;

        line.querySelector("input")?.addEventListener("change", async () => {
          await chrome.runtime.sendMessage({ type: "toggleMicrotask", payload: { taskId: task.id, index } });
          await refresh();
        });

        wrapper.appendChild(line);
      });

      if (!task.completed) {
        const completeBtn = document.createElement("button");
        completeBtn.textContent = "Задача завершена";
        completeBtn.addEventListener("click", async () => {
          await chrome.runtime.sendMessage({ type: "completeTask", payload: { taskId: task.id } });
          await refresh();
        });
        wrapper.appendChild(completeBtn);

        if (task.id !== gameState.activeTaskId) {
          const activateBtn = document.createElement("button");
          activateBtn.textContent = "Сделать активной";
          activateBtn.addEventListener("click", async () => {
            await chrome.runtime.sendMessage({ type: "activateTask", payload: { taskId: task.id } });
            await refresh();
          });
          wrapper.appendChild(activateBtn);
        }
      } else {
        const doneInfo = document.createElement("div");
        doneInfo.className = "small";
        doneInfo.textContent = "Задача выполнена";
        wrapper.appendChild(doneInfo);
      }

      tasksEl.appendChild(wrapper);
    });
  }

  const focusEl = document.getElementById("achFocus");
  const streakEl = document.getElementById("achStreak");
  const maxEl = document.getElementById("achMax");
  if (focusEl) focusEl.textContent = `10 мин без отвлечений: ${gameState.achievements.focus10Count}`;
  if (streakEl) streakEl.textContent = `3 задачи подряд: ${gameState.achievements.taskStreakRewardCount}`;
  if (maxEl) maxEl.textContent = `Макс уровень монстра: ${gameState.achievements.maxLevelRewardCount}`;

  const shopEl = document.getElementById("shop");
  if (shopEl) {
    shopEl.innerHTML = "";
    response.shop.forEach((item) => {
      const row = document.createElement("div");
      const isOwned = gameState.inventory.includes(item.id);
      row.className = "small";
      row.textContent = `${item.title} — ${item.price} очков`;

      const btn = document.createElement("button");
      btn.disabled = isOwned || item.price === 0;
      btn.textContent = isOwned ? "Куплено" : "Купить";
      btn.addEventListener("click", async () => {
        await chrome.runtime.sendMessage({ type: "buyItem", payload: { itemId: item.id } });
        await refresh();
      });

      row.appendChild(document.createElement("br"));
      row.appendChild(btn);
      shopEl.appendChild(row);
    });
  }

  const inventoryEl = document.getElementById("inventory");
  if (inventoryEl) {
    inventoryEl.textContent = gameState.inventory.length
      ? gameState.inventory.join(", ")
      : "Пока пусто";
  }
}

async function refresh(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({ type: "getGameState" })) as FarmResponse;
  render(response);
}

function setupCreateTaskForm(): void {
  const btn = document.getElementById("createTaskBtn");
  const titleInput = document.getElementById("taskTitle") as HTMLInputElement | null;
  const microtasksInput = document.getElementById("microtasks") as HTMLInputElement | null;

  btn?.addEventListener("click", async () => {
    const title = titleInput?.value.trim() ?? "";
    const rawMicrotasks = microtasksInput?.value.trim() ?? "";

    if (!title) return;

    const microtasks = rawMicrotasks
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);

    await chrome.runtime.sendMessage({
      type: "createTask",
      payload: { title, microtasks }
    });

    if (titleInput) titleInput.value = "";
    if (microtasksInput) microtasksInput.value = "";

    await refresh();
  });
}

function setupReviveAction(): void {
  const btn = document.getElementById("reviveBtn");
  btn?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "reviveMonster" });
    await refresh();
  });
}

setupCreateTaskForm();
setupReviveAction();
void refresh();
setInterval(() => {
  void refresh();
}, 2000);
