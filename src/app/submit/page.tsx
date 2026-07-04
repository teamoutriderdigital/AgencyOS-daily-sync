import { TopicSubmitForm } from "@/components/topic-submit-form";
import { getClients } from "@/lib/clients-server";

export const dynamic = "force-dynamic";

// Shareable public form for dropping a topic/issue into the IDS queue without
// opening the board. Linked from the "Copy shareable link" button in the nav.
// The client picker is fed from the same clients list as the weekly tracker.
export default async function SubmitPage() {
  const clients = await getClients();
  return <TopicSubmitForm clients={clients.map((c) => c.name)} />;
}
