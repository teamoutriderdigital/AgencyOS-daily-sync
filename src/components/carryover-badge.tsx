// Small "Week N Carryover" tag shown on to-dos / issues that the weekly sync
// rolled forward from an earlier week. Renders nothing when the item didn't
// carry over. Shared by the IDS and to-do rows.
export function CarryoverBadge({ fromWeek }: { fromWeek: number | null }) {
  if (fromWeek == null) return null;
  return (
    <span
      className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
      title={`Carried forward from week ${fromWeek}`}
    >
      ↻ Week {fromWeek} Carryover
    </span>
  );
}
