import type { Match } from "@/lib/schemas/appData";

export function selectMobileHeaderMatch(matches: Match[], nowMs = Date.now()): Match | undefined {
  const sorted = [...matches].sort((a, b) => (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? ""));
  const live = sorted.find((match) => match.status === "in");
  if (live) return live;

  const upcoming = sorted.find((match) => {
    if (match.status === "post" || match.status === "postponed" || match.status === "cancelled" || !match.kickoffAt) return false;
    return new Date(match.kickoffAt).getTime() >= nowMs;
  });
  if (upcoming) return upcoming;

  return [...sorted].reverse().find((match) => match.status === "post") ?? sorted.at(-1);
}
