/**
 * Utility for combining classNames
 * Simple implementation for merging Tailwind CSS classes
 */

export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ');
}