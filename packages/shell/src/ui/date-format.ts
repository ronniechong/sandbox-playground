// `undefined` locale defers to the visitor's own — see Intl docs for both
// constructors below.
const ABSOLUTE = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const FULL = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' });
const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** Short relative label for recent dates, falling back to an absolute date beyond ~30 days. */
export function relativeLabel(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const days = Math.round((then.getTime() - now.getTime()) / 86_400_000);
  if (Math.abs(days) < 1) return RELATIVE.format(0, 'day');
  if (Math.abs(days) < 30) return RELATIVE.format(days, 'day');
  return ABSOLUTE.format(then);
}

/** Full date+time, for use as a title/tooltip on the relative label. */
export function fullLabel(iso: string): string {
  return FULL.format(new Date(iso));
}
