/** Plage année civile (1er jan – 31 déc). */
export function getCalendarYearRange(year = new Date().getFullYear()) {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`
  };
}

export function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isInDateRange(
  rawDate: string | Date | undefined,
  dateFrom?: string,
  dateTo?: string
): boolean {
  if (!rawDate) return false;
  const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
  if (Number.isNaN(date.getTime())) return false;

  if (dateFrom) {
    const from = parseDateOnly(dateFrom);
    if (date < from) return false;
  }

  if (dateTo) {
    const to = parseDateOnly(dateTo);
    to.setHours(23, 59, 59, 999);
    if (date > to) return false;
  }

  return true;
}

/** Liste des clés mois YYYY-MM entre deux dates incluses. */
export function getMonthKeysInRange(dateFrom: string, dateTo: string): string[] {
  const start = parseDateOnly(dateFrom);
  const end = parseDateOnly(dateTo);
  const months: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    months.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

export function formatPeriodLabel(dateFrom: string, dateTo: string): string {
  const from = parseDateOnly(dateFrom).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const to = parseDateOnly(dateTo).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  return `${from} → ${to}`;
}
