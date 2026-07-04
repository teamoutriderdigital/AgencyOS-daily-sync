import { WeeklyBoard } from "@/components/weekly-board";
import { getWeeklySnapshot } from "@/lib/weekly-server";

export const dynamic = "force-dynamic";

// The weekly L10 board: per-owner rock tracker, plus IDS and to-dos scoped to
// the selected ISO week with carryover from prior weeks.
export default async function WeeklyPage() {
  const snapshot = await getWeeklySnapshot();
  return <WeeklyBoard initialSnapshot={snapshot} />;
}
