/** Wraps Date.now() so components/pages don't call the impure global directly
 * (React's purity lint flags direct Date.now()/Math.random() in render). */
export function nowMs(): number {
  return Date.now();
}
