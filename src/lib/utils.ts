// Minimal class-name combiner: drop falsy values and join. Enough for the
// conditional Tailwind classes used across the board (no tailwind-merge needed
// for this small surface).
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}
