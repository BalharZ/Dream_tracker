import { CalendarEvent } from "@shared/schema";

// Helpers for exporting calendar events to Google Calendar (URL) and
// Apple/Outlook/anything (.ics download). Times are exported as floating
// local time (no time zone) — the event lands at the same wall-clock time
// the user entered, which is what you want for personal plans.

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" → "YYYYMMDD" */
function compactDate(date: string) {
  return date.replace(/-/g, "");
}

/** "HH:MM" or "HH:MM:SS" → "HHMMSS" */
function compactTime(time: string) {
  const [h = "00", m = "00", s = "00"] = time.split(":");
  return `${pad(+h)}${pad(+m)}${pad(+s)}`;
}

/** "YYYY-MM-DD" + n days → "YYYY-MM-DD" */
export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** Default end = start + 1 hour (capped at 23:59) when the user set none. */
function effectiveEnd(ev: CalendarEvent): string {
  if (ev.end_time) return ev.end_time;
  const [h = 0, m = 0] = (ev.start_time ?? "00:00").split(":").map(Number);
  return h >= 23 ? "23:59:00" : `${pad(h + 1)}:${pad(m)}:00`;
}

/** Pre-filled "add to Google Calendar" link for one event. */
export function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({ action: "TEMPLATE", text: ev.title });
  if (ev.start_time) {
    params.set(
      "dates",
      `${compactDate(ev.date)}T${compactTime(ev.start_time)}/${compactDate(ev.date)}T${compactTime(effectiveEnd(ev))}`
    );
  } else {
    // All-day: end date is exclusive
    params.set("dates", `${compactDate(ev.date)}/${compactDate(addDays(ev.date, 1))}`);
  }
  if (ev.description) params.set("details", ev.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escape text per RFC 5545 (backslash, semicolon, comma, newline). */
function escapeIcs(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function eventToVevent(ev: CalendarEvent): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:dream-tracker-event-${ev.id}@dream-tracker`,
    `DTSTAMP:${compactDate(ev.date)}T000000`,
    `SUMMARY:${escapeIcs(ev.title)}`,
  ];
  if (ev.start_time) {
    lines.push(`DTSTART:${compactDate(ev.date)}T${compactTime(ev.start_time)}`);
    lines.push(`DTEND:${compactDate(ev.date)}T${compactTime(effectiveEnd(ev))}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(ev.date)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(addDays(ev.date, 1))}`);
  }
  if (ev.description) lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
  lines.push("END:VEVENT");
  return lines;
}

/** Build a VCALENDAR file with the given events. */
export function buildIcs(events: CalendarEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dream Tracker//Calendar//EN",
    ...events.flatMap(eventToVevent),
    "END:VCALENDAR",
  ];
  // RFC 5545 wants CRLF line endings
  return lines.join("\r\n") + "\r\n";
}

/** Trigger a browser download of the events as an .ics file. */
export function downloadIcs(filename: string, events: CalendarEvent[]) {
  const blob = new Blob([buildIcs(events)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
