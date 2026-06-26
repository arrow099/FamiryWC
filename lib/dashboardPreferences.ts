export const DASHBOARD_TAB_LABELS = ["Leaderboard", "Groups", "Knockout", "Schedule", "Stats"] as const;
export const LAST_DASHBOARD_TAB_STORAGE_KEY = "famirywc:last-dashboard-tab";
export const LAST_DASHBOARD_TAB_COOKIE_KEY = "famirywc-last-dashboard-tab";

export function dashboardTabIndex(value: string | null | undefined): number {
  const index = DASHBOARD_TAB_LABELS.findIndex((label) => label === value);
  return index >= 0 ? index : 0;
}
