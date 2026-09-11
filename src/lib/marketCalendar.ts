import { MarketSession } from "./providers/types";

// NYSE full-day holidays. Extend this table each year — deliberately not
// computed from rules (Good Friday, observed weekends, etc. have enough
// edge cases that a hand-checked table is safer for a personal tool).
const NYSE_HOLIDAYS = new Set<string>([
  // 2025
  "2025-01-01", "2025-01-09", "2025-01-20", "2025-02-17", "2025-04-18",
  "2025-05-26", "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25",
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
  "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
  // 2027
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31",
  "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24",
]);

// Extract Y-M-D and H:M in America/New_York without pulling in a tz library.
function nyParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutesSinceMidnight: parseInt(parts.hour, 10) * 60 + parseInt(parts.minute, 10),
    weekday: parts.weekday, // "Mon", "Tue", ...
  };
}

export function isMarketHoliday(date: Date): boolean {
  return NYSE_HOLIDAYS.has(nyParts(date).dateKey);
}

export function isWeekend(date: Date): boolean {
  const { weekday } = nyParts(date);
  return weekday === "Sat" || weekday === "Sun";
}

export function isTradingDay(date: Date): boolean {
  return !isWeekend(date) && !isMarketHoliday(date);
}

/**
 * Which named session a timestamp falls into, in America/New_York time.
 * Pre-market: 4:00–9:30, Regular: 9:30–16:00, After-hours: 16:00–20:00,
 * otherwise treated as closed (falls back to PREVIOUS_CLOSE/AFTER_HOURS
 * framing since there's no live session to attribute a quote to).
 */
export function currentMarketSession(date: Date = new Date()): MarketSession {
  if (!isTradingDay(date)) return "PREVIOUS_CLOSE";
  const { minutesSinceMidnight: m } = nyParts(date);
  if (m < 4 * 60) return "PREVIOUS_CLOSE";
  if (m < 9 * 60 + 30) return "PRE_MARKET";
  if (m < 16 * 60) return "INTRADAY";
  if (m < 20 * 60) return "AFTER_HOURS";
  return "AFTER_HOURS";
}

export function isRegularSessionOpen(date: Date = new Date()): boolean {
  return isTradingDay(date) && currentMarketSession(date) === "INTRADAY";
}
