import { DashboardBoard } from "@/components/dashboard-board";
import { getTodoOverview } from "@/lib/dashboard-server";
import { getHeadlines } from "@/lib/daily-server";
import { todayLocalISO } from "@/lib/l10";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const today = todayLocalISO();
  const [items, headlines] = await Promise.all([getTodoOverview(), getHeadlines(today)]);
  return <DashboardBoard initialItems={items} initialHeadlines={headlines} today={today} />;
}
