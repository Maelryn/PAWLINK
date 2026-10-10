/**
 * The web's `hashHue` (apps/web/lib/utils.ts), ported so the confidence numbers
 * the mock provider produces match what the browser used to show for the same
 * text. Nothing here needs to be stable forever — only stable between the two
 * implementations of the same mock.
 */

const SEED = [109, 101, 104, 100, 105].reduce((acc, c) => acc * 31 + c, 0) % 360;

/** A 0–359 hue derived from the text; deterministic, and not a real confidence. */
export function hashHue(value: string): number {
  let h = SEED;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) % 360;
  }
  return h;
}
