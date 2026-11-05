import { api } from '@/lib/api';

/** The phone's language and country, e.g. "en-GB" and "GB", if available. */
export function deviceLocale(): { lang?: string; country?: string } {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    const country = /[-_]([A-Z]{2})\b/.exec(tag)?.[1];
    return { lang: tag.slice(0, 20), country };
  } catch {
    return {};
  }
}

/**
 * Records what the user picked from a food search, or that they picked
 * nothing. Measures first-search success, and where searches miss by
 * country and language. Fire-and-forget: it never blocks logging.
 */
export function recordSearch(query: string, pick?: { position: number; name: string }) {
  const q = query.trim();
  if (q.length < 2) return;
  void api
    .post('/food/search-events', {
      query: q.slice(0, 200),
      ...(pick ? { position: pick.position, pickedName: pick.name.slice(0, 200) } : {}),
      ...deviceLocale(),
    })
    .catch(() => {});
}
