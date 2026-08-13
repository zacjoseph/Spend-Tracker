export const RATE_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export type RateFreshnessTone = 'fresh' | 'stale' | 'error' | 'refreshing' | 'unknown';

export function formatUpdated(value: string | null) {
  if (!value) return 'Using saved reference rates';
  return `Updated ${new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function getRateFreshness(
  lastRateUpdated: string | null,
  rateStatus: 'idle' | 'refreshing' | 'error',
): { tone: RateFreshnessTone; title: string; detail: string } {
  if (rateStatus === 'refreshing') {
    return { tone: 'refreshing', title: 'Updating rates…', detail: 'Fetching latest exchange rates' };
  }
  if (rateStatus === 'error') {
    return { tone: 'error', title: 'Rates unavailable', detail: 'Using saved rates · tap to retry' };
  }
  if (!lastRateUpdated) {
    return { tone: 'unknown', title: 'Saved reference rates', detail: 'Tap to fetch live rates' };
  }

  const updated = new Date(lastRateUpdated);
  const ageMs = Date.now() - updated.getTime();
  const timeLabel = updated.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  if (ageMs > RATE_REFRESH_INTERVAL_MS) {
    return { tone: 'stale', title: 'Rates may be stale', detail: `Last updated ${timeLabel} · tap to refresh` };
  }

  return { tone: 'fresh', title: 'Rates up to date', detail: `Updated ${timeLabel}` };
}
