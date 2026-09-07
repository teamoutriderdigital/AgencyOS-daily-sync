import { DashboardBoard } from "@/components/dashboard-board";
import { getTodoOverview } from "@/lib/dashboard-server";
import { todayLocalISO } from "@/lib/l10";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const today = todayLocalISO();
  const items = await getTodoOverview();
  return <DashboardBoard initialItems={items} today={today} />;
}
