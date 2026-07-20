import { AdminPanel } from "@/components/admin-panel";

export const dynamic = "force-dynamic";

// Operator-only maintenance page: dry-run-then-confirm controls for the
// live-data actions that re-seed rocks and reconcile IDS. Guarded by the same
// shared-password middleware gate as the other internal boards (see
// middleware.ts matcher).
export default function AdminPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <h1 className="font-display text-lg font-semibold tracking-tight text-text">Admin</h1>
      <AdminPanel />
    </div>
  );
}
