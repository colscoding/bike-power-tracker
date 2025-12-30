/**
 * Utility functions
 *
 * @module utils
 */

/**
 * Ensures the input is a string.
 * If the input is not a string, it will be JSON stringified.
 *
 * @param input - The value to convert to a string
 * @returns The string representation of the input
 *
 * @example
 * ensureString('hello'); // 'hello'
 * ensureString({ foo: 'bar' }); // '{"foo":"bar"}'
 * ensureString(123); // '123'
 */
export const ensureString = (input: unknown): string => {
    return typeof input === 'string' ? input : JSON.stringify(input);
};
