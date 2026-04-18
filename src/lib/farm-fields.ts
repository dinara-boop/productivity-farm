export const MAX_FIELDS = 3;
export const SLOTS_PER_FIELD = 4;
export const TOTAL_FARM_SLOTS = MAX_FIELDS * SLOTS_PER_FIELD;

export const FIELD_NAMES = ["Цветочный сад", "Северный луг", "Кристалльное поле"] as const;

export const SLOT_LAYOUT = [
  { x: 24, y: 30 },
  { x: 68, y: 30 },
  { x: 31, y: 71 },
  { x: 73, y: 66 }
] as const;

export type FarmPlacement = {
  fieldIndex: number;
  slotIndex: number;
};

export type FarmFieldTask = FarmPlacement & {
  id: string;
  status: "active" | "paused" | "completed";
};

export type FarmFieldSlot<TTask extends FarmFieldTask = FarmFieldTask> = FarmPlacement & {
  task: TTask | null;
};

function getPlacementKey(fieldIndex: number, slotIndex: number): string {
  return `${fieldIndex}:${slotIndex}`;
}

export function isValidFarmPlacement(placement: Partial<FarmPlacement>): placement is FarmPlacement {
  return (
    Number.isInteger(placement.fieldIndex) &&
    Number.isInteger(placement.slotIndex) &&
    placement.fieldIndex! >= 0 &&
    placement.fieldIndex! < MAX_FIELDS &&
    placement.slotIndex! >= 0 &&
    placement.slotIndex! < SLOTS_PER_FIELD
  );
}

export function findFirstFreeFarmSlot(tasks: Array<Partial<FarmPlacement>>): FarmPlacement | null {
  const occupied = new Set(
    tasks.filter(isValidFarmPlacement).map((task) => getPlacementKey(task.fieldIndex, task.slotIndex))
  );

  for (let fieldIndex = 0; fieldIndex < MAX_FIELDS; fieldIndex += 1) {
    for (let slotIndex = 0; slotIndex < SLOTS_PER_FIELD; slotIndex += 1) {
      const key = getPlacementKey(fieldIndex, slotIndex);
      if (!occupied.has(key)) {
        return { fieldIndex, slotIndex };
      }
    }
  }

  return null;
}

export function isFarmSlotOccupied(tasks: Array<Partial<FarmPlacement>>, placement: FarmPlacement): boolean {
  return tasks.some(
    (task) =>
      isValidFarmPlacement(task) &&
      task.fieldIndex === placement.fieldIndex &&
      task.slotIndex === placement.slotIndex
  );
}

export function normalizeFarmTaskPlacements<TTask extends Partial<FarmPlacement>>(
  tasks: TTask[]
): Array<TTask & FarmPlacement> {
  const occupied = new Set<string>();
  const normalized: Array<TTask & FarmPlacement> = [];
  const missingPlacementIndexes: number[] = [];

  tasks.forEach((task, index) => {
    if (isValidFarmPlacement(task)) {
      const key = getPlacementKey(task.fieldIndex, task.slotIndex);
      if (!occupied.has(key)) {
        occupied.add(key);
        normalized[index] = task as TTask & FarmPlacement;
        return;
      }
    }

    missingPlacementIndexes.push(index);
  });

  missingPlacementIndexes.forEach((index) => {
    const placement = findFirstFreeFarmSlot(
      normalized.filter(Boolean).map((task) => ({ fieldIndex: task.fieldIndex, slotIndex: task.slotIndex }))
    ) ?? { fieldIndex: MAX_FIELDS - 1, slotIndex: SLOTS_PER_FIELD - 1 };

    occupied.add(getPlacementKey(placement.fieldIndex, placement.slotIndex));
    normalized[index] = {
      ...tasks[index],
      ...placement
    } as TTask & FarmPlacement;
  });

  return normalized;
}

export function createFarmFieldSlots<TTask extends FarmFieldTask>(
  tasks: TTask[],
  fieldIndex: number
): Array<FarmFieldSlot<TTask>> {
  const slots: Array<FarmFieldSlot<TTask>> = [];

  for (let slotIndex = 0; slotIndex < SLOTS_PER_FIELD; slotIndex += 1) {
    const task = tasks.find((item) => item.fieldIndex === fieldIndex && item.slotIndex === slotIndex) ?? null;
    slots.push({ fieldIndex, slotIndex, task });
  }

  return slots;
}

export function getFarmFieldName(fieldIndex: number): string {
  return FIELD_NAMES[fieldIndex] ?? FIELD_NAMES[0];
}

export function getFarmNavigationState(currentFieldIndex: number): { canGoPrev: boolean; canGoNext: boolean } {
  return {
    canGoPrev: currentFieldIndex > 0,
    canGoNext: currentFieldIndex < MAX_FIELDS - 1
  };
}

export function getFarmStatusLabel(status: FarmFieldTask["status"]): string {
  switch (status) {
    case "active":
      return "активная";
    case "completed":
      return "завершена";
    case "paused":
    default:
      return "на паузе";
  }
}
