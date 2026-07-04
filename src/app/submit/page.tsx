import { TopicSubmitForm } from "@/components/topic-submit-form";

export const dynamic = "force-dynamic";

// Shareable public form for dropping a topic/issue into the IDS queue without
// opening the board. Linked from the "Copy shareable link" button in the nav.
export default function SubmitPage() {
  return <TopicSubmitForm />;
}
