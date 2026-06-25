import { DailyBoard } from "@/components/daily-board";
import { getDailySnapshot } from "@/lib/daily-server";
import { todayLocalISO } from "@/lib/l10";

export const dynamic = "force-dynamic";

// Opens the daily sync for ?date=yyyy-mm-dd (from the dashboard launcher),
// defaulting to today when absent or malformed.
export default async function DailyPage({
  searchParams
}: {
  searchParams: { date?: string };
}) {
  const today = todayLocalISO();
  const requested = searchParams.date;
  const date = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  const snapshot = await getDailySnapshot(date);
  return <DailyBoard initialSnapshot={snapshot} today={today} />;
}
