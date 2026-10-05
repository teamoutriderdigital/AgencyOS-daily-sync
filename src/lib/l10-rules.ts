// The L10 rules the board enforces, kept pure so the server actions, the
// components and tests/l10-rules.test.cjs share one definition.
//
//   1. Every solved issue ends in a to-do with an owner and a date within a week.
//   2. Anyone who rates the meeting under 8 says why; the reason becomes an issue.
//   3. A rock that goes off track becomes an issue instead of a side conversation.

export const TODO_WINDOW_DAYS = 7;
export const RATING_BAR = 8;

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Default due date for a to-do coming out of an issue: one week from today.
export function defaultTodoDue(today: string): string {
  return addDays(today, TODO_WINDOW_DAYS);
}

// Why a solved issue's to-do cannot be saved yet, or null when it can.
export function solveTodoProblem(
  todo: {
    item: string;
    assignee: string | null | undefined;
    due_date: string | null | undefined;
  },
  today: string,
): string | null {
  if (!todo.item.trim()) return "Write the to-do.";
  if (!todo.assignee) return "Pick an owner.";
  if (!todo.due_date) return "Pick a date.";
  if (todo.due_date < today) return "The date is in the past.";
  if (todo.due_date > addDays(today, TODO_WINDOW_DAYS))
    return `Pick a date within ${TODO_WINDOW_DAYS} days.`;
  return null;
}

// The line appended to an issue's Solve notes when it closes.
export function solvedNote(todo: {
  item: string;
  assignee: string;
  due_date: string;
}): string {
  return `To-do: ${todo.item.trim()} (${todo.assignee}, by ${todo.due_date})`;
}

export function ratingNeedsReason(rating: number | null): boolean {
  return rating != null && rating < RATING_BAR;
}

// Issue title for an under-8 rating, so next week opens with it.
export function ratingIssueTitle(
  member: string,
  rating: number,
  reason: string,
): string {
  return `Meeting rated ${rating} by ${member}: ${reason.trim()}`;
}

export function offTrackIssueTitle(rockTitle: string): string {
  return `Rock off track: ${rockTitle.trim() || "untitled rock"}`;
}
