import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

// Password gate for the internal boards. `next` is where to send the user after
// unlocking (validated to a same-site path in the form).
export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = typeof searchParams.next === "string" ? searchParams.next : "/dashboard";
  return <LoginForm next={next} />;
}
