/** Tiny prefixed console logger so background/popup/onboarding/content output is
 *  easy to spot and grep in the devtools console. Lifecycle events (permission
 *  grants, feed fetches, install) log unconditionally because they are rare and
 *  are exactly what you need to diagnose "nothing shows up" reports; noisy
 *  per-lookup detail stays behind the `gfn-debug` storage flag in the
 *  background. */
const PREFIX = "[gfn-check]";

export const log = {
  info: (...args: unknown[]): void => console.info(PREFIX, ...args),
  warn: (...args: unknown[]): void => console.warn(PREFIX, ...args),
  error: (...args: unknown[]): void => console.error(PREFIX, ...args),
};
