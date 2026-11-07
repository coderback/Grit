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
 *
 * `resultCount` is how many results the search showed, when known.
 */
export function recordSearch(
  query: string,
  pick?: { position: number; name: string; foodId?: string },
  resultCount?: number,
) {
  const q = query.trim();
  // Shorter queries aren't searched
  if (q.length < 3) return;
  void api
    .post('/food/search-events', {
      query: q.slice(0, 200),
      ...(pick ? { position: pick.position, pickedName: pick.name.slice(0, 200) } : {}),
      ...(pick?.foodId ? { pickedId: pick.foodId.slice(0, 60) } : {}),
      ...(resultCount != null ? { resultCount: Math.min(1000, Math.max(0, Math.round(resultCount))) } : {}),
      ...deviceLocale(),
    })
    .catch(() => {});
}
