/**
 * Performs a GET request, returning `null` if 404.
 *
 * @param url
 * @param signal
 * @returns
 */
export const fetchNullable = async <T>(
  url: string,
  signal?: AbortSignal
): Promise<T | null> => {
  const resp = await fetch(url, { signal });
  if (resp.status === 404) {
    return null;
  }
  const info = (await resp.json()) as T;
  return info;
};

const sessionCache: Record<string, unknown> = {};

/**
 * Performs a GET request with a cache, returning `null` if 404.
 *
 * The cache expires on browser reload.
 *
 * @param url
 * @param signal
 * @returns
 */
export const fetchNullableWithSessionCache = async <T>(
  url: string,
  signal?: AbortSignal
): Promise<T | null> => {
  if (sessionCache[url]) {
    return sessionCache[url] as T | null;
  }
  const result = await fetchNullable<T>(url, signal);
  sessionCache[url] = result;
  return result;
};
