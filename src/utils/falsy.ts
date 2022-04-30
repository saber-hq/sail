/**
 * Returns undefined if any argument is undefined, or null
 * if argument is null.
 *
 * This is particularly useful for dealing with the results of
 * multiple queries.
 *
 * @param args
 * @returns
 */
export const noneProduct = <Args extends unknown[]>(
  ...args: Args
): null | undefined => {
  if (!args.every((arg) => arg !== undefined)) {
    return undefined;
  }
  if (!args.every((arg) => arg !== null)) {
    return null;
  }
  throw new Error("failed check");
};
