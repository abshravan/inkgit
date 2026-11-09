const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Formats content dates. Date-only values are interpreted in UTC so they never shift a day. */
export function formatDate(value: string): string {
  const time = Date.parse(value);
  return Number.isNaN(time) ? value : dateFormatter.format(time);
}

export function formatReadingTime(minutes: number): string {
  return `${minutes} min read`;
}
