export function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function teamIdFromAbbr(abbr: string): string {
  return `team_${slug(abbr)}`;
}

export function matchIdFromIndex(index: number): string {
  return `match_${String(index + 1).padStart(3, "0")}`;
}
