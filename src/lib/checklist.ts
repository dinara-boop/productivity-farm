export interface ChecklistDraftRow {
  id: string;
  text: string;
}

export function sanitizeChecklistItems(items: readonly string[]): string[] {
  return items
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function createChecklistDraft(
  items: readonly string[],
  createId: () => string
): ChecklistDraftRow[] {
  const sanitized = sanitizeChecklistItems(items).map((text) => ({
    id: createId(),
    text
  }));

  return [...sanitized, createEmptyChecklistRow(createId)];
}

export function updateChecklistDraftRow(
  rows: readonly ChecklistDraftRow[],
  rowId: string,
  nextText: string
): ChecklistDraftRow[] {
  return rows.map((row) => (row.id === rowId ? { ...row, text: nextText } : row));
}

export function insertChecklistRowAfter(
  rows: readonly ChecklistDraftRow[],
  rowId: string,
  createId: () => string
): ChecklistDraftRow[] {
  const index = rows.findIndex((row) => row.id === rowId);
  if (index === -1) {
    return [...rows];
  }

  const nextRow = rows[index + 1];
  if (nextRow && nextRow.text.trim().length === 0) {
    return [...rows];
  }

  const nextRows = [...rows];
  nextRows.splice(index + 1, 0, createEmptyChecklistRow(createId));
  return nextRows;
}

export function removeChecklistRow(
  rows: readonly ChecklistDraftRow[],
  rowId: string,
  createId: () => string
): ChecklistDraftRow[] {
  const nextRows = rows.filter((row) => row.id !== rowId);

  if (nextRows.length === 0) {
    return [createEmptyChecklistRow(createId)];
  }

  if (nextRows.some((row) => row.text.trim().length === 0)) {
    return nextRows;
  }

  return [...nextRows, createEmptyChecklistRow(createId)];
}

export function createEmptyChecklistRow(createId: () => string): ChecklistDraftRow {
  return {
    id: createId(),
    text: ""
  };
}
