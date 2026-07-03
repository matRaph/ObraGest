export function parseIsoDate(value: string): { day: string; month: string; year: string } {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return { day: "", month: "", year: "" };
  return { day: match[3], month: match[2], year: match[1] };
}

export function isValidDate(day: number, month: number, year: number): boolean {
  if (month < 1 || month > 12) return false;
  if (year < 1 || year > 9999) return false;
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function segmentsToIso(day: string, month: string, year: string): string | null {
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return null;
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (!isValidDate(d, m, y)) return null;
  return `${year}-${month}-${day}`;
}

export function parsePastedDate(text: string): { day: string; month: string; year: string } | null {
  const br = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const day = br[1].padStart(2, "0");
    const month = br[2].padStart(2, "0");
    const year = br[3];
    if (segmentsToIso(day, month, year)) return { day, month, year };
  }
  const iso = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { day: iso[3], month: iso[2], year: iso[1] };
  return null;
}

export function padSegments(day: string, month: string, year: string) {
  return {
    day: day.padStart(2, "0").slice(0, 2),
    month: month.padStart(2, "0").slice(0, 2),
    year: year.slice(0, 4),
  };
}
