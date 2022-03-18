import { exists } from "@saberhq/solana-contrib";

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

/**
 * Applies a function to a null/undefined inner value if it is null or undefined,
 * otherwise returns null/undefined.
 *
 * @param obj
 * @param fn
 * @returns
 */
export const mapSome = <T, U>(
  obj: NonNullable<T> | null | undefined,
  fn: (obj: NonNullable<T>) => U
): U | null | undefined => (exists(obj) ? fn(obj) : obj);
