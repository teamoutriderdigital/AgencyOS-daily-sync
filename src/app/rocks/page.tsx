import { RocksBoard } from "@/components/rocks-board";
import { getRocksSnapshot } from "@/lib/rocks-server";

export const dynamic = "force-dynamic";

// The Q3 Rocks "Finalize & Assign" decision meeting. A one-off shared-state
// board (no date scope): the whole team edits the same rocks, decisions, and
// checklist live during the sync.
export default async function RocksPage() {
  const snapshot = await getRocksSnapshot();
  return <RocksBoard initialSnapshot={snapshot} />;
}
