export type FarmSelectableTask = {
  id: string;
  status: "active" | "paused" | "completed";
};

export type FarmSelectableState<TTask extends FarmSelectableTask = FarmSelectableTask> = {
  tasks: TTask[];
  activeTaskId: string | null;
};

export type FarmTaskSelectionResult<TTask extends FarmSelectableTask = FarmSelectableTask> =
  | { type: "not-found" }
  | { type: "completed"; task: TTask }
  | { type: "blocked"; task: TTask; error: "active-task-exists" }
  | { type: "open-active"; task: TTask }
  | { type: "activate"; task: TTask };

export function resolveFarmTaskSelection<TTask extends FarmSelectableTask>(
  gameState: FarmSelectableState<TTask>,
  taskId: string
): FarmTaskSelectionResult<TTask> {
  const task = gameState.tasks.find((item) => item.id === taskId);
  if (!task) {
    return { type: "not-found" };
  }

  if (task.status === "completed") {
    return { type: "completed", task };
  }

  if (task.status === "active" && gameState.activeTaskId === taskId) {
    return { type: "open-active", task };
  }

  if (gameState.activeTaskId !== null && gameState.activeTaskId !== taskId) {
    return { type: "blocked", task, error: "active-task-exists" };
  }

  return { type: "activate", task };
}
