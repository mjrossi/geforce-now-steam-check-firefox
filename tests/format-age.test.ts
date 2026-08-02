import { describe, expect, test } from "vitest";
import { formatAge } from "../src/shared/format-age";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatAge", () => {
  test("sub-minute ages read as 'just now'", () => {
    expect(formatAge(0)).toBe("just now");
    expect(formatAge(MINUTE - 1)).toBe("just now");
  });

  test("clock skew (negative age) does not produce a future time", () => {
    expect(formatAge(-5 * MINUTE)).toBe("just now");
  });

  test("minutes up to the hour boundary", () => {
    expect(formatAge(MINUTE)).toBe("1 min ago");
    expect(formatAge(12 * MINUTE)).toBe("12 min ago");
    expect(formatAge(HOUR - 1)).toBe("59 min ago");
  });

  test("hours up to the day boundary", () => {
    expect(formatAge(HOUR)).toBe("1 h ago");
    expect(formatAge(3 * HOUR + 40 * MINUTE)).toBe("3 h ago");
    expect(formatAge(DAY - 1)).toBe("23 h ago");
  });

  test("days, singular and plural", () => {
    expect(formatAge(DAY)).toBe("1 day ago");
    expect(formatAge(2 * DAY)).toBe("2 days ago");
    expect(formatAge(30 * DAY)).toBe("30 days ago");
  });
});
