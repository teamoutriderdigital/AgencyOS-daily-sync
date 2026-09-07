// Rules 1, 2, 3 and 5 of docs/board-naming.md, checked instead of hoped for.
//
// board-language.ts renames eleven legacy titles. That repairs those eleven and
// nothing else — a title typed today is unchecked. This flags the specific
// things Kas objected to, next to the title, while it is being written.
//
// Every check is deliberately high-precision: a hint that fires on good titles
// gets ignored within a week, which is worse than no hint. Nothing here blocks
// saving. The board belongs to the person typing.

export type NamingProblem = { rule: number; note: string };

// "0/32", "14 / 17" — the exact thing Kas called out. A ratio is progress, and
// progress goes stale the moment somebody closes a task.
const RATIO = /\b\d+\s*\/\s*\d+\b/;
const PERCENT = /\b\d{1,3}\s*%/;
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/;
// A Plane reference: SBD-304, ROCK-12. Fine at the end in brackets, noise mid-sentence.
const REFERENCE = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/;
const REFERENCE_AT_END = /\((?:[A-Z][A-Z0-9]{1,9}-\d+(?:,\s*)?)+\)\s*$/;
const READ_ALOUD_LIMIT = 120;

export function titleProblems(title: string): NamingProblem[] {
  const text = (title ?? "").trim();
  if (!text) return [];
  const problems: NamingProblem[] = [];
  if (RATIO.test(text)) {
    problems.push({ rule: 1, note: `“${text.match(RATIO)![0]}” is a progress count, not a job. Say what has to be done.` });
  }
  if (PERCENT.test(text)) {
    problems.push({ rule: 2, note: "A percentage here goes stale as soon as the work moves — keep it in the progress note." });
  }
  if (ISO_DATE.test(text)) {
    problems.push({ rule: 5, note: "Put the date in the due-date field, not in the title." });
  }
  if (REFERENCE.test(text) && !REFERENCE_AT_END.test(text)) {
    problems.push({ rule: 3, note: `Move ${text.match(REFERENCE)![0]} to the end in brackets so the title reads first.` });
  }
  if (text.length > READ_ALOUD_LIMIT) {
    problems.push({ rule: 7, note: `${text.length} characters — too long to read out. Put the detail in Discuss.` });
  }
  return problems;
}

// One line, because a stack of warnings beside a text box is its own kind of noise.
export function namingHint(title: string): string | null {
  const [first, ...rest] = titleProblems(title);
  if (!first) return null;
  return rest.length ? `${first.note} (+${rest.length} more)` : first.note;
}
