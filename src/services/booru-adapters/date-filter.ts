export function isOnOrAfter(date: string, dateAfter?: string) {
  return !dateAfter || new Date(date).getTime() >= new Date(`${dateAfter}T00:00:00Z`).getTime();
}
