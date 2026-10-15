/** Removes the query string from a URL/path, e.g. for logging — `?email=` style params shouldn't land in logs. */
export function stripQuery(url: string): string {
  const index = url.indexOf('?');
  return index === -1 ? url : url.slice(0, index);
}

/**
 * Some framework-generated messages (e.g. Express's "Cannot GET /x?y=z")
 * quote the full URL inline, so stripping the request's own `url` field
 * isn't enough — this removes that same query string wherever it shows up
 * in freeform text too.
 */
export function stripQueryFromText<T extends string | string[] | undefined>(
  text: T,
  url?: string,
): T {
  if (!text || !url) {
    return text;
  }
  const query = url.slice(url.indexOf('?'));
  if (url.indexOf('?') === -1 || query.length <= 1) {
    return text;
  }
  if (Array.isArray(text)) {
    return text.map((line) => line.split(query).join('')) as T;
  }
  return (text as string).split(query).join('') as T;
}
