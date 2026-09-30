import { QuarterlyBoard } from "@/components/quarterly-board";
import { getRocksSnapshot } from "@/lib/rocks-server";

export const dynamic = "force-dynamic";

// End-of-quarter rock review: tick each rock Done and/or Carry, then start the
// next quarter with the carried rocks. Shared live state, like /rocks.
export default async function QuarterlyPage({ searchParams }: { searchParams: { q?: string } }) {
  const snapshot = await getRocksSnapshot();
  return <QuarterlyBoard initialSnapshot={snapshot} requestedQuarter={searchParams.q ?? null} />;
}
