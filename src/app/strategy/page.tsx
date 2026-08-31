import { StrategyBoard } from "@/components/strategy-board";
import { getStrategySnapshot } from "@/lib/strategy-server";
import { getClients } from "@/lib/clients-server";
import { currentMonthISO } from "@/lib/strategy";

export const dynamic = "force-dynamic";

// Monthly client strategy meetings: one card per client per month, each with
// meeting notes and action items. Opens on ?month=yyyy-mm (or yyyy-mm-01),
// defaulting to the current month.
export default async function StrategyPage({
  searchParams
}: {
  searchParams: { month?: string };
}) {
  const currentMonth = currentMonthISO();
  const requested = searchParams.month;
  const month =
    requested && /^\d{4}-\d{2}(-01)?$/.test(requested)
      ? `${requested.slice(0, 7)}-01`
      : currentMonth;

  const [snapshot, clients] = await Promise.all([getStrategySnapshot(month), getClients()]);
  // Churned clients drop off the board entirely; the archive split (hidden but
  // restorable) happens in the board. Past months for a churned client stay
  // reachable because the board also lists any client with saved meetings.
  const roster = clients.filter((c) => c.stage !== "Churned");

  return <StrategyBoard initialSnapshot={snapshot} currentMonth={currentMonth} clients={roster} />;
}
