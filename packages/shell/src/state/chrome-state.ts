/**
 * Chrome visibility is encoded as `?chrome=0` on the URL rather than in
 * memory, so a reload lands directly in the right mode (see M06 AC:
 * reloading a `?chrome=0` URL must land directly in chromeless mode).
 */
export function isChromeHidden(search: string): boolean {
  return new URLSearchParams(search).get('chrome') === '0';
}

/** Returns a full "?..." search string with `chrome` set/removed. */
export function withChromeHidden(search: string, hidden: boolean): string {
  const params = new URLSearchParams(search);
  if (hidden) {
    params.set('chrome', '0');
  } else {
    params.delete('chrome');
  }
  const result = params.toString();
  return result ? `?${result}` : '';
}
