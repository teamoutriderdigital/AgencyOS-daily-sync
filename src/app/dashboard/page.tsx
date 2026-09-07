import { DashboardBoard } from "@/components/dashboard-board";
import { getTodoOverview } from "@/lib/dashboard-server";
import { getHeadlines, getHeadlineTasks, getKnownClients } from "@/lib/daily-server";
import { todayLocalISO } from "@/lib/l10";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const today = todayLocalISO();
  const [items, headlines, headlineTasks, knownClients] = await Promise.all([
    getTodoOverview(),
    getHeadlines(today),
    getHeadlineTasks(today),
    getKnownClients()
  ]);
  return (
    <DashboardBoard
      initialItems={items}
      initialHeadlines={headlines}
      initialHeadlineTasks={headlineTasks}
      knownClients={knownClients}
      today={today}
    />
  );
}
