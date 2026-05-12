// lib/utils/week.ts
// Week number calculation utility for idempotency

/**
 * Get ISO week number for a given date
 * Returns format: YYYY-WXX (e.g., "2026-W19")
 */
export function getWeekIdentifier(date: Date = new Date()): string {
  const year = date.getFullYear();
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Calculate ISO week number (1-53)
 * ISO week starts on Monday, week 1 contains first Thursday of year
 */
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  target.setDate(target.getDate() - dayNr + 3); // Nearest Thursday
  const firstThursday = target.valueOf();
  target.setMonth(0, 1); // January 1st
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000); // 604800000 = 7 * 24 * 3600 * 1000
}

/**
 * Get human-readable week description
 * Returns format: "Week 19, 2026" or "Week 19, 2026 (May 4-10)"
 */
export function getWeekDescription(date: Date = new Date(), includeRange: boolean = false): string {
  const week = getISOWeek(date);
  const year = date.getFullYear();
  
  if (!includeRange) {
    return `Week ${week}, ${year}`;
  }
  
  // Calculate Monday and Sunday of this week
  const dayOfWeek = (date.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(date);
  monday.setDate(date.getDate() - dayOfWeek);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mondayStr = `${monthNames[monday.getMonth()]} ${monday.getDate()}`;
  const sundayStr = `${monthNames[sunday.getMonth()]} ${sunday.getDate()}`;
  
  return `Week ${week}, ${year} (${mondayStr}-${sundayStr})`;
}
