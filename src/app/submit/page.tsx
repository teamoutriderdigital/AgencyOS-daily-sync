import { TopicSubmitForm } from "@/components/topic-submit-form";
import { getClients } from "@/lib/clients-server";
import { getOpenIdsItems } from "@/lib/ids-server";

export const dynamic = "force-dynamic";

// Shareable public form for dropping a topic/issue into the IDS queue without
// opening the board. Linked from the "Copy shareable link" button in the nav.
// The client picker is fed from the same clients list as the weekly tracker.
// Below the form we show the currently-open items so submitters can see what's
// already in the queue and upvote it instead of filing a duplicate.
export default async function SubmitPage() {
  const [clients, openItems] = await Promise.all([getClients(), getOpenIdsItems()]);
  return <TopicSubmitForm clients={clients.map((c) => c.name)} openItems={openItems} />;
}
