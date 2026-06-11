// Unit helpers: detect time units (hours/minutes, EN + CZ spellings) and
// convert habit values into the goal's unit when they differ.

const normalize = (unit: string | null | undefined) => (unit || "").trim().toLowerCase();

const HOUR_UNITS = new Set([
  "h", "hr", "hrs", "hour", "hours",
  "hod", "hod.", "hodin", "hodina", "hodiny",
]);

const MINUTE_UNITS = new Set([
  "min", "min.", "mins", "minute", "minutes",
  "minut", "minuta", "minuty",
]);

export function isHourUnit(unit: string | null | undefined): boolean {
  return HOUR_UNITS.has(normalize(unit));
}

export function isMinuteUnit(unit: string | null | undefined): boolean {
  return MINUTE_UNITS.has(normalize(unit));
}

export function isTimeUnit(unit: string | null | undefined): boolean {
  return isHourUnit(unit) || isMinuteUnit(unit);
}

/** The complementary time unit ("minutes" for an hour unit and vice versa), or null. */
export function timeAltUnit(unit: string | null | undefined): string | null {
  if (isHourUnit(unit)) return "minutes";
  if (isMinuteUnit(unit)) return "hours";
  return null;
}

/** True when both units mean the same time unit (e.g. "min" and "minutes"). */
export function sameTimeUnit(a: string | null | undefined, b: string | null | undefined): boolean {
  return (isHourUnit(a) && isHourUnit(b)) || (isMinuteUnit(a) && isMinuteUnit(b));
}

/**
 * Multiplier converting a value in `fromUnit` into `toUnit`.
 * Only hours <-> minutes are converted; anything else returns 1 (no conversion).
 */
export function conversionFactor(
  fromUnit: string | null | undefined,
  toUnit: string | null | undefined,
): number {
  if (isMinuteUnit(fromUnit) && isHourUnit(toUnit)) return 1 / 60;
  if (isHourUnit(fromUnit) && isMinuteUnit(toUnit)) return 60;
  return 1;
}
