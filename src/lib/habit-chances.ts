import { ChanceEntry, HabitChances } from "@shared/schema";

/**
 * Helpers for the `rewards.habit_chances` JSON column.
 *
 * The value per habit is either a plain number (legacy format = win chance
 * in %, quantity 1) or `{ chance, quantity }` where `quantity` is how many
 * pieces of the reward a single win grants. Plain numbers are kept when
 * quantity is 1 so existing data and older readers stay valid.
 */

export function parseHabitChances(raw: string | null | undefined): HabitChances {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getChance(entry: ChanceEntry | undefined): number {
  if (entry === undefined || entry === null) return 0;
  if (typeof entry === "number") return entry;
  return typeof entry.chance === "number" ? entry.chance : 0;
}

export function getQuantity(entry: ChanceEntry | undefined): number {
  if (entry === undefined || entry === null || typeof entry === "number") return 1;
  const q = Math.round(Number(entry.quantity));
  return Number.isFinite(q) && q > 1 ? q : 1;
}

/** Builds the JSON value: plain number for quantity 1 (backward compatible). */
export function makeChanceEntry(chance: number, quantity: number): ChanceEntry {
  const q = Math.round(Number(quantity));
  return Number.isFinite(q) && q > 1 ? { chance, quantity: q } : chance;
}
