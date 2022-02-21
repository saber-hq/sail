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
